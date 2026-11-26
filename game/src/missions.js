// The three sorties: what the pilot is asked to do, where the rings and gates
// hang in the air, and what each one is worth. The courses are fixed in the
// world, so a second attempt flies the same valley — the skill is in the
// flying, not in memorising a new map each time.
import { CONFIG } from './config.js';
import { groundHeight } from './terrain.js';
import { clamp } from './random.js';

/** One ring or gate, hung high enough to fly through with room to spare. */
function ringAt(x, z, kind) {
  const y = Math.max(groundHeight(x, z) + 70, 130);
  return { x, y, z, radius: CONFIG.ringRadius, kind, passed: false };
}

/** Ring Run: eight gold rings winding down the valley, plus two green fuel rings. */
function buildRingCourse() {
  const pts = [
    [60, 320], [170, 640], [60, 960], [-140, 1260],
    [-260, 1560], [-120, 1860], [80, 2140], [180, 2420],
  ];
  const rings = pts.map(([x, z]) => ringAt(x, z, 'course'));
  const fuel = [ringAt(240, 820, 'fuel'), ringAt(-300, 1720, 'fuel')];
  return { rings: [...rings, ...fuel], count: rings.length };
}

/** Valley Slalom: ten gates, left then right, down that same valley. The gates
 * stay close to the valley line, so each one is approached from behind and
 * seen face-on — a gate you fly at sideways is a line, not a target. They
 * stand 400 m apart down the valley, so the aeroplane has room to turn
 * between them: with a 128 m turn radius, a tighter course asks for a turn
 * the wing cannot make and the autopilot ends up circling a gate it can
 * never thread. */
function buildSlalomCourse() {
  const gates = [];
  for (let i = 0; i < 10; i += 1) {
    const z = 300 + i * 400;
    const x = (i % 2 === 0 ? -1 : 1) * (60 + (i % 3) * 20);
    gates.push(ringAt(x, z, 'gate'));
  }
  return { rings: gates, count: gates.length };
}

/** Home Run: one beacon ring two kilometres out, then home to the strip. */
function buildHomeCourse() {
  const beacon = ringAt(120, 2050, 'beacon');
  return { rings: [beacon], count: 1 };
}

/** A fresh mission state for the given mission id. */
export function createMission(missionId) {
  const base = { id: missionId, startedAt: 0, elapsed: 0, score: 0, done: false, failed: false, message: '', messageAt: 0 };
  if (missionId === 'rings') return { ...base, ...buildRingCourse(), kind: 'rings' };
  if (missionId === 'slalom') return { ...base, ...buildSlalomCourse(), kind: 'slalom', missed: 0 };
  return { ...base, ...buildHomeCourse(), kind: 'home', beaconPassed: false, landed: false };
}

/** The next ring or gate the pilot should aim at, or null when the course is done. */
export function nextTarget(mission) {
  for (const ring of mission.rings) {
    if (!ring.passed) return ring;
  }
  return null;
}

/** How many course rings or gates are still ahead of the pilot. */
export function remainingCount(mission) {
  if (mission.kind === 'rings') return mission.rings.filter((r) => r.kind === 'course' && !r.passed).length;
  return mission.rings.filter((r) => !r.passed).length;
}

/**
 * Check the aeroplane against the next target: flying through the hole scores
 * it. Returns 'ring' | 'fuel' | 'gate' | 'missed' | null. A slalom gate counts
 * as missed once the aeroplane is 120 m past it without threading it.
 */
export function checkTargets(mission, plane, prevZ, now) {
  const target = nextTarget(mission);
  if (!target) return null;
  const dx = plane.x - target.x;
  const dy = plane.y - target.y;
  const dz = plane.z - target.z;
  const radial = Math.hypot(dx, dy);
  if (Math.abs(dz) < 10 && radial < target.radius) {
    target.passed = true;
    if (target.kind === 'fuel') {
      plane.fuel = Math.min(CONFIG.fuelCapacity, plane.fuel + CONFIG.fuelRingRestore);
      mission.message = 'FUEL +45';
      mission.messageAt = now;
      return 'fuel';
    }
    if (target.kind === 'gate') {
      mission.score += CONFIG.ringScore;
      mission.message = `GATE ${mission.rings.filter((r) => r.passed).length}/${mission.count}  +100`;
      mission.messageAt = now;
      return 'gate';
    }
    mission.score += CONFIG.ringScore;
    const n = mission.rings.filter((r) => r.kind === 'course' && r.passed).length;
    mission.message = `RING ${n}/${mission.count}  +100`;
    mission.messageAt = now;
    if (mission.kind === 'home') mission.beaconPassed = true;
    return 'ring';
  }
  // Slalom: sailing past a gate without threading it costs five seconds.
  if (target.kind === 'gate' && plane.z > target.z + 120 && prevZ <= target.z + 120) {
    target.passed = true;
    mission.missed += 1;
    mission.elapsed += CONFIG.gatePenaltySeconds;
    mission.message = `GATE MISSED  +${CONFIG.gatePenaltySeconds}s`;
    mission.messageAt = now;
    return 'missed';
  }
  return null;
}

/**
 * The landing judgement, called when the wheels touch. Returns 'landed' |
 * 'hard' | 'crash'. A good landing is slow, level and gentle, on the runway,
 * into the wind — anything else is a hard landing or a crash.
 */
export function judgeLanding(plane, groundY) {
  const onRunway = Math.abs(plane.x - CONFIG.runway.x) < CONFIG.runway.width / 2 + 4
    && Math.abs(plane.z - CONFIG.runway.z) < CONFIG.runway.length / 2;
  const vs = -plane.verticalSpeed; // positive means descending
  const level = Math.abs(plane.roll) < 0.3 && Math.abs(plane.pitch) < 0.18;
  if (!onRunway) return 'crash';
  if (vs > 7 || plane.speed > 62) return 'crash';
  if (vs > 4.2) return 'hard';
  if (!level && plane.speed > 45) return 'hard';
  return 'landed';
}

/** Finish a mission and work out the final score line. */
export function finishMission(mission, plane, now) {
  mission.done = true;
  const timeBonus = Math.max(0, Math.round((300 - mission.elapsed) * CONFIG.scoreTimeBonusPerSecond));
  let bonus = 0;
  let line = '';
  if (mission.kind === 'home') {
    bonus = CONFIG.landingSoftBonus + Math.round(plane.fuel * CONFIG.fuelBonusPerUnit);
    line = `LANDED  +${CONFIG.landingSoftBonus}  FUEL BONUS +${Math.round(plane.fuel * CONFIG.fuelBonusPerUnit)}`;
  } else if (mission.kind === 'rings') {
    bonus = timeBonus + Math.round(plane.fuel * CONFIG.fuelBonusPerUnit);
    line = `ALL RINGS  TIME BONUS +${timeBonus}  FUEL BONUS +${Math.round(plane.fuel * CONFIG.fuelBonusPerUnit)}`;
  } else {
    const total = mission.elapsed;
    bonus = Math.max(0, Math.round((240 - total) * 3));
    line = `FINISH ${formatTime(total)}  TIME BONUS +${bonus}`;
  }
  mission.score += bonus;
  mission.message = line;
  mission.messageAt = now;
  return line;
}

/** A time as mm:ss.t, for the HUD timer. */
export function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}
