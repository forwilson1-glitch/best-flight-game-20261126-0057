// The flight model: throttle, pitch, roll and the air they work in. It is
// arcade-true rather than a simulator — speed chases the throttle, the nose
// follows the stick, a banked wing turns the aeroplane, and a slow wing drops
// the nose, so slow flight is a decision the pilot makes, not a free ride.
import { CONFIG } from './config.js';
import { clamp, angleDelta } from './random.js';

/** A fresh aeroplane: parked on the threshold, facing north up the valley. */
export function createAircraft() {
  return {
    x: CONFIG.runway.x,
    y: 2, // wheels on the ground; the runway itself sits at height 0
    z: -CONFIG.runway.length / 2 + 40,
    heading: 0, // 0 means north, +z
    pitch: 0,
    roll: 0,
    speed: 0,
    throttle: 0,
    flaps: false,
    fuel: CONFIG.fuelCapacity,
    damage: 0,
    airborne: false,
    verticalSpeed: 0,
    groundSpeed: 0,
    propAngle: 0,
  };
}

/**
 * One step of the flight model. `input` is the stick: pitch -1..1 (pulling up
 * is +1), roll -1..1, throttle -1..1 (a change, not a setting), flaps and
 * brakes as booleans. Returns 'takeoff' | 'stall' | null.
 */
export function stepFlight(plane, input, dt) {
  const cfg = CONFIG;
  const maxSpeed = input.flaps ? cfg.maxSpeedFlaps : cfg.maxSpeed;
  const minSpeed = input.flaps ? cfg.minSpeedFlaps : cfg.minSpeed;

  // The throttle lever moves, and the engine answers a beat later.
  plane.throttle = clamp(plane.throttle + input.throttle * dt * 0.9, 0, 1);
  if (input.brakes) plane.throttle = Math.max(0, plane.throttle - dt * 1.5);

  // Speed chases the throttle's target while drag grows with speed squared.
  const target = plane.throttle * maxSpeed;
  const drag = cfg.drag * plane.speed * plane.speed / maxSpeed;
  plane.speed += (cfg.accel * plane.throttle - drag) * dt;
  if (plane.speed < target) plane.speed = Math.min(plane.speed + cfg.accel * dt, target);
  plane.speed = clamp(plane.speed, 0, maxSpeed + 6);

  // The stick moves pitch and roll, and both relax toward level flight.
  const authority = clamp(plane.speed / 45, 0.25, 1);
  plane.pitch = clamp(
    plane.pitch + input.pitch * cfg.pitchRate * authority * dt - plane.pitch * cfg.pitchStability * dt,
    -cfg.maxPitch, cfg.maxPitch,
  );
  plane.roll = clamp(
    plane.roll + input.roll * cfg.rollRate * authority * dt - plane.roll * cfg.rollStability * dt,
    -cfg.maxRoll, cfg.maxRoll,
  );

  // A banked wing turns the nose; a slow wing lets it drop.
  const wasAirborne = plane.airborne;
  plane.heading += -plane.roll * cfg.turnRate * clamp(plane.speed / 60, 0, 1.4) * dt;
  let event = null;
  if (plane.airborne && plane.speed < minSpeed) {
    plane.pitch -= 0.9 * dt; // the stall: the nose falls through the horizon
    if (plane.pitch < -0.35) event = 'stall';
  }

  // And through the air it goes.
  const cosP = Math.cos(plane.pitch);
  plane.verticalSpeed = plane.speed * Math.sin(plane.pitch);
  plane.x += plane.speed * cosP * Math.sin(plane.heading) * dt;
  plane.z += plane.speed * cosP * Math.cos(plane.heading) * dt;
  plane.y += plane.verticalSpeed * dt;
  plane.groundSpeed = plane.speed * cosP;
  plane.propAngle += (2 + plane.throttle * 38) * dt;

  // Liftoff: quick enough and pulling up, or simply quick enough on the strip.
  if (!plane.airborne && plane.speed > minSpeed * 0.85 && plane.pitch > 0.04) {
    plane.airborne = true;
    event = 'takeoff';
  }
  if (!wasAirborne && plane.airborne) event = 'takeoff';
  return event;
}

/**
 * The autopilot's steering: the stick inputs that point the nose at a target
 * point at a chosen speed. Bank is capped, so the autopilot never rolls the
 * aeroplane onto its back the way a panicked pilot would.
 */
export function steerToward(plane, targetX, targetY, targetZ, targetSpeed, dt) {
  const dx = targetX - plane.x;
  const dy = targetY - plane.y;
  const dz = targetZ - plane.z;
  const dist = Math.hypot(dx, dz);
  const wantHeading = Math.atan2(dx, dz);
  const headingErr = angleDelta(plane.heading, wantHeading);
  const wantPitch = clamp(Math.atan2(dy, Math.max(30, dist)) * 0.9, -0.12, 0.35);
  const pitchErr = wantPitch - plane.pitch;
  const wantRoll = clamp(-headingErr * 1.1, -0.85, 0.85);
  return {
    pitch: clamp(pitchErr * 2.2, -1, 1),
    roll: clamp((wantRoll - plane.roll) * 2.6, -1, 1),
    throttle: clamp((targetSpeed - plane.speed) / 25, -1, 1),
    flaps: plane.speed < 45 && dist < 500,
    brakes: false,
  };
}
