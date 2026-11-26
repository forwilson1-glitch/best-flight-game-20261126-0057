// Screenshot scenes: each one plays the real rules forward from a fresh world
// for a fixed number of steps, steered by an autopilot that flies the course
// the way a careful pilot would — and then hunts for a composed frame, wings
// near level and the next ring or gate centred ahead, before the picture is
// taken. The frame is what a short game really looks like, and the same seed
// always gives the same frame.
import { CONFIG } from './config.js';
import { createWorld, stepWorld, SCREEN_PLAY, SCREEN_TITLE } from './world.js';
import { steerToward } from './physics.js';
import { nextTarget } from './missions.js';
import { groundHeight } from './terrain.js';
import { projectWorldPoint } from './render.js';
import { clamp } from './random.js';

const STEP = 1 / 60;

/** Autopilot: aim at the next target, or at the runway threshold when coming home. */
export function autopilot(world) {
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
  // Follow the approach line, not the ring itself: the line through the target
  // running south down the valley. Aim at a point on that line 150 m ahead of
  // the aeroplane, so the run-in is straight and the ring is met face-on.
  // Chasing the ring as a point orbits when the approach goes wrong — the
  // aeroplane circles a gate it overshot, banking forever and never threading
  // it. The line always gives a way back in: overshoot, and the aeroplane is
  // sent to a point 200 m south of the target to try the run again.
  if (plane.z > target.z + 30) {
    return steerToward(plane, target.x, target.y, target.z - 200, speed, STEP);
  }
  const aimZ = Math.min(plane.z + 150, target.z);
  return steerToward(plane, target.x, target.y, aimZ, speed, STEP);
}

/** Run the world forward `seconds` at 60 Hz with the autopilot on the stick. */
export function flyForward(world, seconds) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    if (world.screen !== SCREEN_PLAY) break;
    stepWorld(world, autopilot(world), STEP);
  }
}

/**
 * How well a frame is composed for a screenshot: level wings, the next ring
 * or gate centred a touch above the middle of the frame, at a distance where
 * it reads as a target ahead rather than a wall, and a fresh "+100" callout
 * when one has just been scored.
 */
function poseScore(world, w, h) {
  const plane = world.plane;
  const target = nextTarget(world.mission);
  if (!target || !plane.airborne) return -Infinity;
  const sp = projectWorldPoint(plane, w, h, target);
  if (!sp) return -Infinity;
  let score = 100;
  score -= Math.abs(plane.roll) * 140;
  score -= (Math.abs(sp.x - w / 2) / w) * 220;
  score -= (Math.abs(sp.y - h * 0.38) / h) * 140;
  if (sp.depth < 120 || sp.depth > 450) score -= 70;
  else score += 20;
  // Face-on beats edge-on: a ring seen from the side is a thin line, not a
  // target. Compare the projected spans of the rim — a circle facing the
  // camera spans as far across as it does up and down.
  const r = target.radius;
  const rimL = projectWorldPoint(plane, w, h, { x: target.x - r, y: target.y, z: target.z });
  const rimR = projectWorldPoint(plane, w, h, { x: target.x + r, y: target.y, z: target.z });
  const rimT = projectWorldPoint(plane, w, h, { x: target.x, y: target.y + r, z: target.z });
  const rimB = projectWorldPoint(plane, w, h, { x: target.x, y: target.y - r, z: target.z });
  if (rimL && rimR && rimT && rimB) {
    const spanX = Math.abs(rimR.x - rimL.x);
    const spanY = Math.abs(rimT.y - rimB.y);
    const face = Math.min(spanX, spanY) / Math.max(spanX, spanY);
    score += (face - 0.5) * 90;
    if (spanY > 70) score += 15; // big enough to read at a glance
    if (spanY < 30) score -= 30; // too small to see
  }
  const msgAge = world.time - world.mission.messageAt;
  if (world.mission.message && msgAge < 2.6) score += 25;
  return score;
}

/**
 * Fly on from where the world stands, keeping the best-composed frame seen in
 * the window, and return that frame's world. The search is deterministic: the
 * same seed always picks the same frame.
 */
function findPose(world, w, h, maxSeconds) {
  const steps = Math.round(maxSeconds / STEP);
  let best = null;
  let bestScore = -Infinity;
  for (let i = 0; i < steps; i += 1) {
    if (world.screen !== SCREEN_PLAY) break;
    stepWorld(world, autopilot(world), STEP);
    const score = poseScore(world, w, h);
    if (score > bestScore) {
      bestScore = score;
      best = structuredClone(world);
    }
  }
  return best ?? world;
}

/**
 * Stage the named scene and return the world to draw. Scenes:
 *  cover   — Ring Run, mid-flight: chase view, HUD lit, the next ring ahead.
 *  rings   — Slalom, threading a gate at speed.
 *  landing — Home Run, wheels kissing the runway with touchdown smoke.
 *  title   — the menu over the valley at sunset, the three sorties on show.
 */
export function stageShot(name, missionId, w = 1280, h = 800) {
  const world = createWorld(missionId);
  world.screen = SCREEN_PLAY;
  if (name === 'rings') {
    // Fly the slalom properly, then wait for a composed frame at a gate.
    flyForward(world, 26);
    return { world: findPose(world, w, h, 12), screen: SCREEN_PLAY };
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
  if (name === 'title') {
    const backdrop = stageTitleBackdrop();
    return { world: backdrop, screen: SCREEN_TITLE };
  }
  // cover: Ring Run, twenty seconds in, then a composed frame with a ring ahead.
  flyForward(world, 20);
  return { world: findPose(world, w, h, 12), screen: SCREEN_PLAY };
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
