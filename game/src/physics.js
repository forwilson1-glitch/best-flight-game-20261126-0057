// The flight model: throttle, pitch, roll and the air itself. Arcade-true, not a
// simulator — speed follows the throttle, the nose follows the stick, and the wing
// quits below flying speed, so slow flight is a decision, not a free ride.
import { CONFIG } from './config.js';
import { clamp, angleDelta } from './random.js';

/** A fresh aircraft state, parked on the runway threshold, facing north. */
export function createAircraft() {
  return {
    x: CONFIG.runway.x,
    y: CONFIG.runway.z === 0 ? 2 : 2, // wheels on the ground, runway height is 0
    z: -CONFIG.runway.length / 2 + 40,
    heading: 0, // 0 = north, +z
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
 * One physics step. `input` is { pitch: -1..1 (pull up is +1), roll: -1..1,
 * throttle: -1..1 (change), flaps: boolean, brakes: boolean }.
 * Returns an event string: 'takeoff' | 'stall' | null.
 */
export function stepFlight(plane, input, dt) {
  const cfg = CONFIG;
  const maxSpeed = input.flaps ? cfg.maxSpeedFlaps : cfg.maxSpeed;
  const minSpeed = input.flaps ? cfg.minSpeedFlaps : cfg.minSpeed;

  // Throttle: the lever moves, the engine answers.
  plane.throttle = clamp(plane.throttle + input.throttle * dt * 0.9, 0, 1);
  if (input.brakes) plane.throttle = Math.max(0, plane.throttle - dt * 1.5);

  // Speed chases the throttle's target; drag grows with the square of speed.
  const target = plane.throttle * maxSpeed;
  const drag = cfg.drag * plane.speed * plane.speed / maxSpeed;
  plane.speed += (cfg.accel * plane.throttle - drag) * dt;
  if (plane.speed < target) plane.speed = Math.min(plane.speed + cfg.accel * dt, target);
  plane.speed = clamp(plane.speed, 0, maxSpeed + 6);

  // Pitch and roll answer the stick, then relax toward level flight.
  const authority = clamp(plane.speed / 45, 0.25, 1);
  plane.pitch = clamp(
    plane.pitch + input.pitch * cfg.pitchRate * authority * dt - plane.pitch * cfg.pitchStability * dt,
    -cfg.maxPitch, cfg.maxPitch,
  );
  plane.roll = clamp(
    plane.roll + input.roll * cfg.rollRate * authority * dt - plane.roll * cfg.rollStability * dt,
    -cfg.maxRoll, cfg.maxRoll,
  );

  // A banked wing turns the nose; a slow wing drops it.
  const wasAirborne = plane.airborne;
  plane.heading += -plane.roll * cfg.turnRate * clamp(plane.speed / 60, 0, 1.4) * dt;
  let event = null;
  if (plane.airborne && plane.speed < minSpeed) {
    plane.pitch -= 0.9 * dt; // the stall: the nose falls through
    if (plane.pitch < -0.35) event = 'stall';
  }

  // Move through the air.
  const cosP = Math.cos(plane.pitch);
  plane.verticalSpeed = plane.speed * Math.sin(plane.pitch);
  plane.x += plane.speed * cosP * Math.sin(plane.heading) * dt;
  plane.z += plane.speed * cosP * Math.cos(plane.heading) * dt;
  plane.y += plane.verticalSpeed * dt;
  plane.groundSpeed = plane.speed * cosP;
  plane.propAngle += (2 + plane.throttle * 38) * dt;

  // Liftoff: fast enough and pulling up, or simply fast enough on the runway.
  if (!plane.airborne && plane.speed > minSpeed * 0.85 && plane.pitch > 0.04) {
    plane.airborne = true;
    event = 'takeoff';
  }
  if (!wasAirborne && plane.airborne) event = 'takeoff';
  return event;
}

/** Steer helper for the autopilot: inputs that point the nose at a target. */
export function steerToward(plane, targetX, targetY, targetZ, targetSpeed, dt) {
  const dx = targetX - plane.x;
  const dy = targetY - plane.y;
  const dz = targetZ - plane.z;
  const dist = Math.hypot(dx, dz);
  const wantHeading = Math.atan2(dx, dz);
  const headingErr = angleDelta(plane.heading, wantHeading);
  const wantPitch = clamp(Math.atan2(dy, Math.max(30, dist)) * 0.9, -0.12, 0.35);
  const pitchErr = wantPitch - plane.pitch;
  // Bank into the turn, capped so the autopilot never rolls the aircraft over.
  const wantRoll = clamp(-headingErr * 1.1, -0.85, 0.85);
  return {
    pitch: clamp(pitchErr * 2.2, -1, 1),
    roll: clamp((wantRoll - plane.roll) * 2.6, -1, 1),
    throttle: clamp((targetSpeed - plane.speed) / 25, -1, 1),
    flaps: plane.speed < 45 && dist < 500,
    brakes: false,
  };
}
