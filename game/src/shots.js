// Screenshot scenes: each one plays the real rules forward from a fresh world for a
// fixed number of steps, steered by an autopilot that flies the course the way a
// careful pilot would. The frame is what a short game really looks like, and the
// same seed always gives the same frame.
import { CONFIG } from './config.js';
import { createWorld, stepWorld, SCREEN_PLAY, SCREEN_TITLE } from './world.js';
import { steerToward } from './physics.js';
import { nextTarget } from './missions.js';
import { groundHeight } from './terrain.js';
import { clamp } from './random.js';

const STEP = 1 / 60;

/** Autopilot: aim at the next target, or at the runway threshold when coming home. */
function autopilot(world) {
  const plane = world.plane;
  const mission = world.mission;
  const target = nextTarget(mission);
  if (mission.kind === 'home' && mission.beaconPassed) {
    // One continuous glideslope home: aim six metres under the touchdown zone
    // (230 m past the north threshold, with 390 m of runway left to roll out).
    // The line in is only about three degrees, so the wheels kiss, not thud.
    const R = CONFIG.runway;
    const tx = R.x;
    const tz = R.z + R.length / 2 - 230;
    const ty = groundHeight(tx, tz) - 6;
    const dist = Math.hypot(tx - plane.x, tz - plane.z);
    const input = steerToward(plane, tx, ty, tz, clamp(dist / 25, 26, 55), STEP);
    input.flaps = dist < 700;
    // Flare: close to the ground, ease the nose up to a shallow descent.
    const agl = plane.y - groundHeight(plane.x, plane.z);
    if (agl < 8) {
      input.pitch = clamp((-0.06 - plane.pitch) * 2.5, -1, 1);
      input.throttle = clamp((26 - plane.speed) / 20, -1, 1);
    }
    return input;
  }
  if (!target) {
    return { pitch: 0, roll: 0, throttle: 0.4, flaps: false, brakes: false };
  }
  const speed = mission.kind === 'slalom' ? 64 : 68;
  return steerToward(plane, target.x, target.y, target.z, speed, STEP);
}

/** Run the world forward `seconds` at 60 Hz with the autopilot on the stick. */
function flyForward(world, seconds) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    if (world.screen !== SCREEN_PLAY) break;
    stepWorld(world, autopilot(world), STEP);
  }
}

/**
 * Stage the named scene and return the screen to draw over it. Scenes:
 *  cover   — Ring Run, mid-flight: chase view, HUD lit, the next ring ahead.
 *  rings   — Slalom, threading a gate at speed.
 *  landing — Home Run, wheels kissing the runway with touchdown smoke.
 */
export function stageShot(name, missionId) {
  const world = createWorld(missionId);
  world.screen = SCREEN_PLAY;
  if (name === 'rings') {
    // Start the slalom from the threshold, fly it properly, stop at a gate.
    flyForward(world, 26);
    return { world, screen: SCREEN_PLAY };
  }
  if (name === 'landing') {
    // Fly Home Run out to the beacon, then bring her home; stop just after the
    // wheels kiss the runway, with the touchdown smoke still in the air.
    for (let chunk = 0; chunk < 24; chunk += 1) {
      flyForward(world, 5);
      if (world.screen !== SCREEN_PLAY) break;
      if (world.events.includes('touchdown')) {
        flyForward(world, 1.2);
        break;
      }
    }
    return { world, screen: world.screen };
  }
  // cover: Ring Run, twenty seconds in, ring ahead, valley below.
  flyForward(world, 20);
  return { world, screen: SCREEN_PLAY };
}

/** The title scene behind the menu: a slow orbit over the valley at sunset. */
export function stageTitleBackdrop() {
  const world = createWorld('rings');
  world.screen = SCREEN_TITLE;
  const plane = world.plane;
  plane.airborne = true;
  plane.y = 210;
  plane.x = -420;
  plane.z = 900;
  plane.heading = 0.5;
  plane.speed = 62;
  plane.throttle = 0.65;
  return world;
}
