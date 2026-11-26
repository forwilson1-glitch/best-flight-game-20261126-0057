// A small deterministic toolbox: a seeded generator, smooth value noise for the
// hills, and the angle and clamp helpers the flight model leans on. The same
// seed always grows the same valley, the same pines and the same clouds, so a
// screenshot taken today matches a screenshot taken tomorrow, frame for frame.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Smooth 1-D value noise in [0, 1): a hashed lattice, cosine-blended. */
export function valueNoise1D(x, seed) {
  const xi = Math.floor(x);
  const xf = x - xi;
  const hash = (n) => {
    let h = (n * 374761393 + seed * 668265263) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const u = (1 - Math.cos(xf * Math.PI)) / 2;
  return hash(xi) * (1 - u) + hash(xi + 1) * u;
}

/** Smooth 2-D value noise in [0, 1), the same lattice in two dimensions. */
export function valueNoise2D(x, y, seed) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const hash = (nx, ny) => {
    let h = (nx * 374761393 + ny * 668265263 + seed * 974634211) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const u = (1 - Math.cos(xf * Math.PI)) / 2;
  const v = (1 - Math.cos(yf * Math.PI)) / 2;
  const a = hash(xi, yi);
  const b = hash(xi + 1, yi);
  const c = hash(xi, yi + 1);
  const d = hash(xi + 1, yi + 1);
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}

/** Keep a number inside [lo, hi]. */
export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Straight-line blend between a and b. */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** The classic smoothstep curve, 0 at edge0 and 1 at edge1. */
export function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/** The shortest signed turn from one heading to another, in (-PI, PI]. */
export function angleDelta(from, to) {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d <= -Math.PI) d += Math.PI * 2;
  return d;
}
