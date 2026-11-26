// The valley: a deterministic heightfield with the runway carved flat into it,
// the pine forest, the lake and the drifting clouds. Nothing is loaded from
// outside the game — every hill, tree and cloud is computed from one seed, so
// the valley is the same on every machine and in every screenshot.
import { CONFIG } from './config.js';
import { mulberry32, valueNoise2D, clamp, smoothstep } from './random.js';

const SEED = 20261126;
const RUNWAY = CONFIG.runway;

/** Rolling-hill height at (x, z), before the runway corridor is flattened. */
function rawHeight(x, z) {
  const n1 = valueNoise2D(x * 0.004, z * 0.004, SEED);
  const n2 = valueNoise2D(x * 0.011 + 7.3, z * 0.011 + 2.9, SEED + 5);
  const n3 = valueNoise2D(x * 0.03 + 3.1, z * 0.03 + 8.4, SEED + 11);
  const ridge = 1 - Math.abs(2 * n1 - 1); // ridged noise: sharp crests, soft valleys
  let h = 26 + 58 * ridge + 26 * (n2 - 0.5) * 2 + 7 * (n3 - 0.5) * 2;
  // The valley floor follows the runway's line: pull the ground down near x = 0.
  const valley = smoothstep(90, 320, Math.abs(x));
  h = h * (0.25 + 0.75 * valley);
  // A lake sits east of the runway, low and flat.
  const lake = smoothstep(260, 420, x) * smoothstep(900, 700, z) * smoothstep(-900, -700, z);
  h = h * (1 - 0.85 * lake);
  return h;
}

/** How much of the raw height survives at (x, z): 0 on the runway, 1 away. */
function runwayMask(x, z) {
  // The strip is flat, and the approach is cleared 400 m past each end so a
  // landing aeroplane never meets a hillside on the way in.
  const dz = z - RUNWAY.z;
  const along = Math.abs(dz) < RUNWAY.length / 2 + 400
    ? smoothstep(RUNWAY.length / 2, RUNWAY.length / 2 + 400, Math.abs(dz))
    : 1;
  const across = smoothstep(RUNWAY.width / 2 + 6, RUNWAY.width / 2 + 70, Math.abs(x - RUNWAY.x));
  return Math.max(along, across);
}

/** Ground height in metres at world (x, z). */
export function groundHeight(x, z) {
  return rawHeight(x, z) * runwayMask(x, z);
}

/** True on the lake surface, where the ground should read as water. */
export function isLake(x, z) {
  const lake = smoothstep(260, 420, x) * smoothstep(900, 700, z) * smoothstep(-900, -700, z);
  return lake > 0.6 && rawHeight(x, z) < 14;
}

/**
 * The colour of a patch of ground: meadow green on the valley floor, deep pine
 * green on the hillsides, warm sunlit rock on the crests, snow on the tops.
 * Steep faces read as rock whatever their height, and the low sun shades one
 * side of every ridge so the valley has shape instead of flat colour.
 */
export function terrainColour(h, slope, sun) {
  let r;
  let g;
  let b;
  if (h < 12) {
    // Valley floor: warm meadow green.
    r = 96; g = 138; b = 74;
  } else if (h < 42) {
    // Hillsides: deep pine green.
    const t = (h - 12) / 30;
    r = 96 - 34 * t; g = 138 - 42 * t; b = 74 - 18 * t;
  } else if (h < 68) {
    // Rock: sun-warmed brown, not cold grey, so the ridges glow at sunset.
    const t = (h - 42) / 26;
    r = 92 + 34 * t; g = 84 - 4 * t; b = 58 + 18 * t;
  } else {
    // Snow caps.
    const t = Math.min(1, (h - 68) / 18);
    r = 100 + 130 * t; g = 88 + 135 * t; b = 78 + 140 * t;
  }
  if (slope > 0.55) {
    // A steep face is rock, whatever height it stands at.
    r = r * 0.7 + 116 * 0.3; g = g * 0.7 + 94 * 0.3; b = b * 0.7 + 70 * 0.3;
  }
  const shade = 0.62 + 0.38 * sun;
  return `rgb(${Math.round(r * shade)},${Math.round(g * shade)},${Math.round(b * shade)})`;
}

/** The fixed scenery: where the pines stand and where the clouds drift. */
export function buildScenery() {
  const rand = mulberry32(SEED ^ 0x5eed);
  const trees = [];
  // Two plantings: pines scattered across the whole valley, and a thicker stand
  // along the valley floor near the course, so the ground under the flight path
  // reads as forest rather than empty green.
  for (let i = 0; i < 900; i += 1) {
    let x;
    let z;
    if (i < 300) {
      x = (rand() * 2 - 1) * 380;
      z = rand() * 2800 - 200;
    } else {
      x = (rand() * 2 - 1) * 1500;
      z = (rand() * 2 - 1) * 2600 + 400;
    }
    if (Math.abs(x - RUNWAY.x) < RUNWAY.width / 2 + 46 && Math.abs(z) < RUNWAY.length / 2 + 60) continue;
    if (isLake(x, z)) continue;
    const h = groundHeight(x, z);
    if (h > 62) continue; // nothing grows on the snow line
    trees.push({ x, z, h, size: 8 + rand() * 15, shade: 0.75 + rand() * 0.25 });
  }
  const clouds = [];
  for (let i = 0; i < 12; i += 1) {
    clouds.push({
      x: (rand() * 2 - 1) * 1800,
      y: 320 + rand() * 100,
      z: (rand() * 2 - 1) * 2600 + 600,
      size: 80 + rand() * 130,
    });
  }
  return { trees, clouds };
}

/** Where the low sun sits, for the sky glow and the shading of the slopes. */
export const SUN_DIRECTION = { x: -0.45, y: 0.28, z: 0.85 };
