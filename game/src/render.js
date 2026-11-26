// The view out of the windscreen: a sunset sky, a projected heightfield valley, the
// runway, the pines, the rings ahead, and the Kestrel in chase view. All of it is
// drawn from the world with a plain perspective projection — no library, no images.
import { CONFIG } from './config.js';
import { groundHeight, terrainColour, isLake, SUN_DIRECTION } from './terrain.js';
import { drawAircraft } from './aircraft.js';
import { clamp, lerp } from './random.js';

const SKY_TOP = '#1c2a52';
const SKY_MID = '#7a5a7e';
const SKY_HORIZON = '#f4a259';

/** Build the camera basis from the aircraft's heading and pitch. */
function cameraBasis(plane) {
  const heading = plane.heading;
  const pitch = plane.pitch;
  const fwd = {
    x: Math.sin(heading) * Math.cos(pitch),
    y: Math.sin(pitch),
    z: Math.cos(heading) * Math.cos(pitch),
  };
  const right = { x: Math.cos(heading), y: 0, z: -Math.sin(heading) };
  // up = fwd x right, normalised.
  const up = {
    x: fwd.y * right.z - fwd.z * right.y,
    y: fwd.z * right.x - fwd.x * right.z,
    z: fwd.x * right.y - fwd.y * right.x,
  };
  const len = Math.hypot(up.x, up.y, up.z) || 1;
  up.x /= len; up.y /= len; up.z /= len;
  // Chase position: behind and above the aircraft, smoothed by the caller.
  const cam = {
    x: plane.x - fwd.x * CONFIG.cameraDistance + up.x * CONFIG.cameraHeight,
    y: plane.y - fwd.y * CONFIG.cameraDistance + up.y * CONFIG.cameraHeight,
    z: plane.z - fwd.z * CONFIG.cameraDistance + up.z * CONFIG.cameraHeight,
  };
  return { cam, fwd, right, up };
}

/** Project a world point into screen space; null when behind the camera. */
function project(cam, fwd, right, up, p, w, h, focal) {
  const dx = p.x - cam.x;
  const dy = p.y - cam.y;
  const dz = p.z - cam.z;
  const cx = dx * right.x + dy * right.y + dz * right.z;
  const cy = dx * up.x + dy * up.y + dz * up.z;
  const cz = dx * fwd.x + dy * fwd.y + dz * fwd.z;
  if (cz < 2) return null;
  return {
    x: w / 2 + (cx / cz) * focal,
    y: h * 0.46 - (cy / cz) * focal,
    depth: cz,
    scale: focal / cz,
  };
}

function drawSky(ctx, w, h, plane) {
  const grad = ctx.createLinearGradient(0, 0, 0, h * 0.62);
  grad.addColorStop(0, SKY_TOP);
  grad.addColorStop(0.55, SKY_MID);
  grad.addColorStop(1, SKY_HORIZON);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h * 0.62 + 2);
  // The low sun, placed by heading so it stays put as you turn.
  const sunAngle = Math.atan2(SUN_DIRECTION.x, SUN_DIRECTION.z) - plane.heading;
  const sx = w / 2 + Math.sin(sunAngle) * w * 0.42;
  const sy = h * 0.34 - SUN_DIRECTION.y * h * 0.4;
  const glow = ctx.createRadialGradient(sx, sy, 4, sx, sy, 190);
  glow.addColorStop(0, 'rgba(255,214,140,0.95)');
  glow.addColorStop(0.25, 'rgba(255,170,90,0.55)');
  glow.addColorStop(1, 'rgba(255,150,80,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(sx - 200, sy - 200, 400, 400);
  ctx.fillStyle = '#ffe9b0';
  ctx.beginPath();
  ctx.arc(sx, sy, 26, 0, Math.PI * 2);
  ctx.fill();
}

/** The valley floor: projected heightfield strips, far to near. */
function drawTerrain(ctx, w, h, basis, focal) {
  const { cam, fwd, right, up } = basis;
  // Base ground colour below the horizon, so no gap ever shows.
  ctx.fillStyle = '#4d6b3f';
  ctx.fillRect(0, h * 0.46, w, h * 0.54);
  const rows = 26;
  const cols = 30;
  const span = 520;
  // Row distances grow with distance: dense near, sparse far.
  const dists = [];
  let d = 14;
  for (let i = 0; i < rows; i += 1) {
    dists.push(d);
    d *= 1.17;
  }
  // Project the grid once, then paint the quads far to near.
  const grid = [];
  for (let i = 0; i < rows; i += 1) {
    const row = [];
    const dist = dists[i];
    for (let j = 0; j <= cols; j += 1) {
      const across = -span + (2 * span * j) / cols;
      const wx = cam.x + fwd.x * dist + right.x * across;
      const wz = cam.z + fwd.z * dist + right.z * across;
      const wy = groundHeight(wx, wz);
      const p = project(cam, fwd, right, up, { x: wx, y: wy, z: wz }, w, h, focal);
      row.push({ p, h: wy, x: wx, z: wz });
    }
    grid.push(row);
  }
  for (let i = rows - 1; i > 0; i -= 1) {
    const far = grid[i];
    const near = grid[i - 1];
    for (let j = 0; j < cols; j += 1) {
      const a = far[j];
      const b = far[j + 1];
      const c = near[j + 1];
      const e = near[j];
      if (!a.p || !b.p || !c.p || !e.p) continue;
      const midH = (a.h + b.h + c.h + e.h) / 4;
      const slope = clamp(Math.abs(a.h - e.h) / 22 + Math.abs(b.h - a.h) / 30, 0, 1);
      const sun = clamp(0.5 + (a.h - e.h) / 30, 0, 1);
      ctx.fillStyle = isLake((a.x + c.x) / 2, (a.z + c.z) / 2)
        ? 'rgba(86,140,178,0.9)'
        : terrainColour(midH, slope, sun);
      ctx.beginPath();
      ctx.moveTo(a.p.x, a.p.y);
      ctx.lineTo(b.p.x, b.p.y);
      ctx.lineTo(c.p.x, c.p.y);
      ctx.lineTo(e.p.x, e.p.y);
      ctx.closePath();
      ctx.fill();
    }
  }
}

/** The runway: a dark strip with dashes, threshold bars and edge lights.
 *  Drawn in short segments along its length, so the part behind the camera is
 *  skipped while the rest still shows. */
function drawRunway(ctx, w, h, basis, focal) {
  const { cam, fwd, right, up } = basis;
  const R = CONFIG.runway;
  const halfW = R.width / 2;
  const halfL = R.length / 2;
  const SEGMENTS = 12;
  const segLen = R.length / SEGMENTS;
  for (let s = 0; s < SEGMENTS; s += 1) {
    const z0 = R.z - halfL + s * segLen;
    const z1 = z0 + segLen;
    const corners = [
      { x: R.x - halfW, y: 0.4, z: z0 },
      { x: R.x + halfW, y: 0.4, z: z0 },
      { x: R.x + halfW, y: 0.4, z: z1 },
      { x: R.x - halfW, y: 0.4, z: z1 },
    ].map((p) => project(cam, fwd, right, up, p, w, h, focal));
    if (corners.some((p) => !p)) continue;
    ctx.fillStyle = '#2c313c';
    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    corners.slice(1).forEach((p) => ctx.lineTo(p.x, p.y));
    ctx.closePath();
    ctx.fill();
  }
  // Outline, from the farthest visible corner pair to the nearest.
  const outline = [
    { x: R.x - halfW, y: 0.4, z: R.z - halfL },
    { x: R.x + halfW, y: 0.4, z: R.z - halfL },
    { x: R.x + halfW, y: 0.4, z: R.z + halfL },
    { x: R.x - halfW, y: 0.4, z: R.z + halfL },
  ].map((p) => project(cam, fwd, right, up, p, w, h, focal));
  const visibleOutline = outline.filter((p) => p);
  if (visibleOutline.length >= 2) {
    ctx.strokeStyle = '#e8ecf2';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(visibleOutline[0].x, visibleOutline[0].y);
    visibleOutline.slice(1).forEach((p) => ctx.lineTo(p.x, p.y));
    ctx.stroke();
  }
  // Centreline dashes.
  ctx.fillStyle = '#e8ecf2';
  for (let z = R.z - halfL + 30; z < R.z + halfL - 20; z += 60) {
    const a = project(cam, fwd, right, up, { x: R.x, y: 0.5, z }, w, h, focal);
    const b = project(cam, fwd, right, up, { x: R.x, y: 0.5, z: z + 28 }, w, h, focal);
    if (!a || !b) continue;
    ctx.lineWidth = Math.max(1, a.scale * 1.6);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  // Threshold bars at both ends.
  for (const tz of [R.z - halfL + 12, R.z + halfL - 12]) {
    for (let k = -2; k <= 2; k += 1) {
      const a = project(cam, fwd, right, up, { x: R.x + k * 4 - 1.4, y: 0.5, z: tz - 6 }, w, h, focal);
      const b = project(cam, fwd, right, up, { x: R.x + k * 4 + 1.4, y: 0.5, z: tz - 6 }, w, h, focal);
      const c = project(cam, fwd, right, up, { x: R.x + k * 4 + 1.4, y: 0.5, z: tz + 6 }, w, h, focal);
      const e = project(cam, fwd, right, up, { x: R.x + k * 4 - 1.4, y: 0.5, z: tz + 6 }, w, h, focal);
      if (!a || !b || !c || !e) continue;
      ctx.fillStyle = '#f2f5f9';
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(c.x, c.y);
      ctx.lineTo(e.x, e.y);
      ctx.closePath();
      ctx.fill();
    }
  }
}

/** A ring: a glowing circle standing in the air, gold when it is next. */
function drawRing(ctx, w, h, basis, focal, ring, isNext, time) {
  const { cam, fwd, right, up } = basis;
  const N = 26;
  const pts = [];
  // The ring faces along the course (its plane is perpendicular to the valley, i.e. to z).
  for (let i = 0; i <= N; i += 1) {
    const a = (i / N) * Math.PI * 2;
    pts.push(project(cam, fwd, right, up, {
      x: ring.x + Math.cos(a) * ring.radius,
      y: ring.y + Math.sin(a) * ring.radius,
      z: ring.z,
    }, w, h, focal));
  }
  if (pts.some((p) => !p)) return;
  // A ring the camera is about to fly through fills the frame; skip it rather
  // than painting a wall of colour.
  const centre = project(cam, fwd, right, up, ring, w, h, focal);
  if (!centre || centre.depth < 12) return;
  const colour = ring.kind === 'fuel' ? '#3ddc78' : isNext ? '#f4b942' : '#57d7e8';
  const width = Math.min(14, Math.max(2, pts[0].scale * 2.2));
  ctx.save();
  ctx.shadowColor = colour;
  ctx.shadowBlur = isNext ? 18 : 8;
  ctx.strokeStyle = colour;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i <= N; i += 1) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
  if (isNext) {
    // A pulsing chevron pointing through the hole.
    const c = project(cam, fwd, right, up, ring, w, h, focal);
    if (c) {
      const pulse = 1 + 0.12 * Math.sin(time * 5);
      ctx.fillStyle = 'rgba(244,185,66,0.9)';
      ctx.font = `bold ${Math.round(Math.min(30, 15 * c.scale * pulse + 10))}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('▸', c.x, c.y + 6);
    }
  }
  if (ring.passed) {
    const c = project(cam, fwd, right, up, ring, w, h, focal);
    if (c) {
      ctx.fillStyle = 'rgba(61,220,120,0.95)';
      ctx.font = `bold ${Math.max(14, Math.round(20 * c.scale))}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('✓', c.x, c.y + 6);
    }
  }
}

/** Pines as billboards, near to far so the near ones overlap correctly. */
function drawTrees(ctx, w, h, basis, focal, trees) {
  const { cam, fwd, right, up } = basis;
  const visible = [];
  for (const t of trees) {
    const p = project(cam, fwd, right, up, { x: t.x, y: t.h, z: t.z }, w, h, focal);
    if (!p || p.depth > 750 || p.depth < 4) continue;
    if (p.x < -60 || p.x > w + 60 || p.y > h + 40) continue;
    visible.push({ t, p });
  }
  visible.sort((a, b) => b.p.depth - a.p.depth);
  for (const { t, p } of visible) {
    const s = p.scale * t.size;
    const shade = Math.round(40 + 40 * t.shade);
    ctx.fillStyle = `rgb(${shade - 12},${shade + 42},${shade - 6})`;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - s * 1.9);
    ctx.lineTo(p.x - s * 0.55, p.y);
    ctx.lineTo(p.x + s * 0.55, p.y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = `rgb(${shade},${shade + 58},${shade + 8})`;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - s * 2.5);
    ctx.lineTo(p.x - s * 0.4, p.y - s * 0.9);
    ctx.lineTo(p.x + s * 0.4, p.y - s * 0.9);
    ctx.closePath();
    ctx.fill();
  }
}

/** Soft clouds drifting high over the valley. */
function drawClouds(ctx, w, h, basis, focal, clouds) {
  const { cam, fwd, right, up } = basis;
  for (const c of clouds) {
    const p = project(cam, fwd, right, up, c, w, h, focal);
    if (!p || p.depth > 2600 || p.depth < 10) continue;
    const s = p.scale * c.size;
    ctx.fillStyle = 'rgba(255,244,230,0.75)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, s, s * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(p.x - s * 0.5, p.y + s * 0.06, s * 0.6, s * 0.26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(p.x + s * 0.55, p.y + s * 0.05, s * 0.65, s * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Smoke puffs and ring sparks, projected from the world. */
function drawParticles(ctx, w, h, basis, focal, particles) {
  const { cam, fwd, right, up } = basis;
  for (const p of particles) {
    const s = project(cam, fwd, right, up, p, w, h, focal);
    if (!s) continue;
    const age = p.age / p.life;
    // Cap the on-screen radius: a puff right under the camera must not become
    // a wall of grey.
    const size = Math.min(38, p.size * s.scale * (1 + age * 1.4));
    if (p.kind === 'smoke') {
      ctx.fillStyle = `rgba(220,222,228,${0.55 * (1 - age)})`;
    } else {
      ctx.fillStyle = `rgba(255,214,110,${0.95 * (1 - age)})`;
    }
    ctx.beginPath();
    ctx.arc(s.x, s.y, Math.max(1.5, size), 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Draw the whole scene for one frame. */
export function renderScene(ctx, w, h, world, scenery, time) {
  const plane = world.plane;
  const focal = h * CONFIG.focal;
  const basis = cameraBasis(plane);
  drawSky(ctx, w, h, plane);
  drawClouds(ctx, w, h, basis, focal, scenery.clouds);
  drawTerrain(ctx, w, h, basis, focal);
  drawRunway(ctx, w, h, basis, focal);
  // Rings, nearest last so the next one reads on top.
  const rings = [...world.mission.rings].sort((a, b) => {
    const da = Math.hypot(a.x - plane.x, a.z - plane.z);
    const db = Math.hypot(b.x - plane.x, b.z - plane.z);
    return db - da;
  });
  const next = world.mission.rings.find((r) => !r.passed);
  for (const ring of rings) drawRing(ctx, w, h, basis, focal, ring, ring === next, time);
  drawTrees(ctx, w, h, basis, focal, scenery.trees);
  drawParticles(ctx, w, h, basis, focal, world.particles);

  // The aircraft's shadow on the ground below, so height reads at a glance.
  const ground = groundHeight(plane.x, plane.z);
  if (plane.y - ground < 220) {
    const sp = project(basis.cam, basis.fwd, basis.right, basis.up, { x: plane.x, y: ground + 0.5, z: plane.z }, w, h, focal);
    if (sp) {
      const alpha = clamp(0.4 - (plane.y - ground) / 550, 0.04, 0.4);
      ctx.fillStyle = `rgba(10,14,22,${alpha})`;
      ctx.beginPath();
      ctx.ellipse(sp.x, sp.y, 26 * sp.scale, 7 * sp.scale, -plane.roll * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // The Kestrel, chase view, banked with the roll and riding the pitch.
  const cy = h * 0.52 - plane.pitch * h * 0.28;
  const crashed = world.screen === 'crashed';
  if (crashed) {
    const t = Math.min(1, (world.time - world.flashAt) / 0.8);
    drawAircraft(ctx, w / 2, cy + t * 40, plane.roll + t * 2.2, plane.pitch, 0, plane.propAngle, time);
  } else {
    drawAircraft(ctx, w / 2, cy, plane.roll, plane.pitch, plane.throttle, plane.propAngle, time);
  }
}
