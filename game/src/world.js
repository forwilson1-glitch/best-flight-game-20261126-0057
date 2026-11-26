// The world: one aeroplane, one mission, the fuel in its tanks, the damage on
// its airframe, and the smoke and sparks that say what just happened. The
// renderer draws from here and the HUD reports from here, so this file is the
// one place where the game decides what is true.
import { CONFIG } from './config.js';
import { createAircraft, stepFlight } from './physics.js';
import { createMission, checkTargets, judgeLanding, finishMission, nextTarget, remainingCount } from './missions.js';
import { groundHeight } from './terrain.js';
import { clamp } from './random.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_CRASHED = 'crashed';
export const SCREEN_COMPLETE = 'complete';

/** A fresh world: the aeroplane on the runway, the first mission armed, clock at zero. */
export function createWorld(missionId) {
  return {
    plane: createAircraft(),
    mission: createMission(missionId),
    screen: SCREEN_TITLE,
    time: 0,
    best: 0,
    crashReason: '',
    particles: [],
    flash: '',
    flashAt: -10,
    touchdownAt: -10,
    speedAtTouchdown: 0,
    events: [],
  };
}

/** Swap to another mission from the title screen, keeping the session's best score. */
export function setMission(world, missionId) {
  const best = world.best;
  const fresh = createWorld(missionId);
  fresh.best = best;
  return fresh;
}

/** A burst of smoke or sparks at a point in the world. */
function addParticles(world, kind, x, y, z, count) {
  for (let i = 0; i < count; i += 1) {
    world.particles.push({
      kind,
      x: x + (Math.random() - 0.5) * 6,
      y: y + (Math.random() - 0.5) * 3,
      z: z + (Math.random() - 0.5) * 6,
      vx: (Math.random() - 0.5) * 8,
      vy: 1 + Math.random() * 4,
      vz: (Math.random() - 0.5) * 8,
      life: 0.9 + Math.random() * 0.9,
      age: 0,
      size: 3 + Math.random() * 7,
    });
  }
}

/** One fixed step of the whole world. `input` is the pilot's stick and throttle. */
export function stepWorld(world, input, dt) {
  if (world.screen !== SCREEN_PLAY) return;
  const plane = world.plane;
  const mission = world.mission;
  const prevZ = plane.z;
  world.time += dt;
  mission.elapsed += dt;

  // Fuel: the engine drinks, and an empty tank only glides.
  const burn = plane.throttle < 0.7
    ? CONFIG.fuelBurnCruise * (0.4 + plane.throttle)
    : CONFIG.fuelBurnFull * plane.throttle;
  plane.fuel = Math.max(0, plane.fuel - burn * dt);
  if (plane.fuel <= 0 && plane.throttle > 0.05) plane.throttle = 0;

  const event = stepFlight(plane, input, dt);
  if (event === 'takeoff') {
    world.flash = 'AIRBORNE';
    world.flashAt = world.time;
  }

  // On the ground the wheels stay on the ground: never sink through the strip.
  if (!plane.airborne) {
    const groundNow = groundHeight(plane.x, plane.z);
    if (plane.y < groundNow + 0.6) {
      plane.y = groundNow + 0.6;
      plane.pitch = 0;
    }
  }

  // Rings, gates, the beacon.
  const hit = checkTargets(mission, plane, prevZ, world.time);
  if (hit === 'ring' || hit === 'gate') {
    addParticles(world, 'spark', plane.x, plane.y, plane.z, 14);
    world.events.push(hit);
  }
  if (hit === 'fuel') world.events.push('fuel');

  // The ground: the runway forgives, the hills do not.
  const ground = groundHeight(plane.x, plane.z);
  const agl = plane.y - ground;
  if (agl <= 0.6 && plane.airborne) {
    const verdict = judgeLanding(plane, ground);
    if (verdict === 'landed') {
      plane.y = ground + 0.6;
      plane.airborne = false;
      plane.pitch = 0;
      plane.roll *= 0.4;
      plane.speed = Math.max(0, plane.speed - 26 * dt);
      world.touchdownAt = world.time;
      world.speedAtTouchdown = plane.speed;
      addParticles(world, 'smoke', plane.x, plane.y, plane.z, 10);
      world.events.push('touchdown');
      if (mission.kind === 'home' && mission.beaconPassed && !mission.done) {
        finishMission(mission, plane, world.time);
        world.screen = SCREEN_COMPLETE;
        world.flash = 'MISSION COMPLETE';
        world.flashAt = world.time;
      } else if (mission.kind === 'home' && !mission.beaconPassed) {
        world.flash = 'TOUCHDOWN — BUT THE BEACON IS STILL OUT THERE';
        world.flashAt = world.time;
      }
      if (plane.speed < 2) {
        plane.throttle = 0;
      }
    } else if (verdict === 'hard') {
      plane.damage += CONFIG.damageHardLanding;
      plane.y = ground + 0.6;
      plane.airborne = false;
      plane.pitch = 0;
      plane.speed = Math.max(0, plane.speed - 30 * dt);
      addParticles(world, 'smoke', plane.x, plane.y, plane.z, 16);
      world.flash = 'HARD LANDING — AIRFRAME DAMAGED';
      world.flashAt = world.time;
      world.events.push('hard');
      world.events.push('touchdown'); // a hard landing is still a touchdown
      if (plane.damage >= 100) crash(world, 'The airframe gave out on a hard landing.');
    } else {
      crash(world, plane.speed > 62
        ? 'Too fast for the runway — the Kestrel broke up on touchdown.'
        : 'The Kestrel came down off the runway, in the rough.');
    }
  }
  if (!plane.airborne && plane.y <= ground + 0.6 && plane.speed < 0.5 && mission.kind === 'home' && mission.beaconPassed && !mission.done) {
    finishMission(mission, plane, world.time);
    world.screen = SCREEN_COMPLETE;
  }

  // Out of fuel over the hills: a forced landing is a crash anywhere but the strip.
  if (plane.fuel <= 0 && plane.airborne && agl < 4 && plane.speed < 25) {
    crash(world, 'Out of fuel — the Kestrel settled into the valley floor.');
  }

  // Course complete: every ring flown, or every gate cleared.
  if (!mission.done && mission.kind !== 'home' && remainingCount(mission) === 0) {
    finishMission(mission, plane, world.time);
    world.screen = SCREEN_COMPLETE;
    world.flash = 'MISSION COMPLETE';
    world.flashAt = world.time;
  }

  // Particles drift, rise or fall, and fade out.
  for (const p of world.particles) {
    p.age += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.z += p.vz * dt;
    p.vy += (p.kind === 'smoke' ? 1.5 : -2) * dt;
  }
  world.particles = world.particles.filter((p) => p.age < p.life);
}

/** The end of the flight: smoke, sparks and a reason on the screen. */
function crash(world, reason) {
  const plane = world.plane;
  world.screen = SCREEN_CRASHED;
  world.crashReason = reason;
  world.flash = 'CRASHED';
  world.flashAt = world.time;
  addParticles(world, 'smoke', plane.x, plane.y, plane.z, 26);
  addParticles(world, 'spark', plane.x, plane.y, plane.z, 18);
  world.events.push('crash');
}

/** Restart the same mission, the aeroplane back on the threshold. */
export function restartWorld(world) {
  const best = Math.max(world.best, world.mission.score);
  const fresh = createWorld(world.mission.id);
  fresh.best = best;
  fresh.screen = SCREEN_PLAY;
  fresh.mission.startedAt = 0;
  return fresh;
}
