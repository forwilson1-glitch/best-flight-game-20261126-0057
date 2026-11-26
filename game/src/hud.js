// The instruments: the tapes and dials a pilot actually flies by — airspeed and
// altitude tapes, a heading compass, an artificial horizon, throttle and fuel
// gauges. Every number on the HUD is live from the world; nothing is painted on
// for show. Every panel sits a clear margin inside the frame, and no tape ever
// shows a number half cut off at its edge.
import { CONFIG, MISSIONS } from './config.js';
import { clamp } from './random.js';
import { formatTime, remainingCount } from './missions.js';

const INK = 'rgba(235,242,250,0.92)';
const DIM = 'rgba(235,242,250,0.55)';
const GOLD = '#f4b942';
const CYAN = '#57d7e8';
const EDGE = 36; // every HUD panel keeps at least this far from the frame edge

/** One frosted panel with a hairline border. */
function panel(ctx, x, y, w, h, alpha = 0.42) {
  ctx.fillStyle = `rgba(10,16,28,${alpha})`;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(235,242,250,0.18)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

/**
 * A vertical scrolling tape: airspeed on the left, altitude on the right.
 * Numbers sliding in or out at the top and bottom are left out entirely, so a
 * still frame never shows a digit sliced in half.
 */
function tape(ctx, x, y, w, h, value, step, unit, fmt, boxSide = 'right') {
  panel(ctx, x, y, w, h);
  const cy = y + h / 2;
  const range = step * 4;
  const pxPerUnit = (h / 2 - 14) / range;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.font = '12px system-ui, sans-serif';
  ctx.textAlign = 'left';
  const lo = Math.floor((value - range) / step) * step;
  for (let v = lo; v <= value + range + step; v += step) {
    const ty = cy - (v - value) * pxPerUnit;
    if (ty < y + 14 || ty > y + h - 14) continue;
    const major = v % (step * 5) === 0;
    ctx.strokeStyle = major ? INK : DIM;
    ctx.lineWidth = major ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(x + w - (major ? 16 : 10), ty);
    ctx.lineTo(x + w, ty);
    ctx.stroke();
    if (major) {
      ctx.fillStyle = DIM;
      ctx.fillText(fmt(v), x + 6, ty + 4);
    }
  }
  ctx.restore();
  // The current-value box sits on the outside of the tape, so it never leaves
  // the screen: left of the altitude tape, right of the airspeed tape.
  const boxX = boxSide === 'left' ? x - 70 : x + w - 4;
  const caretX = boxSide === 'left' ? x : x + w;
  ctx.fillStyle = '#12233a';
  ctx.beginPath();
  ctx.roundRect(boxX, cy - 13, 66, 26, 4);
  ctx.fill();
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${fmt(value)} ${unit}`, boxX + 33, cy + 5);
  // Centre caret.
  ctx.fillStyle = GOLD;
  ctx.beginPath();
  ctx.moveTo(caretX, cy - 6);
  ctx.lineTo(boxSide === 'left' ? caretX + 8 : caretX - 8, cy);
  ctx.lineTo(caretX, cy + 6);
  ctx.closePath();
  ctx.fill();
}

/** The heading compass tape across the top centre of the screen. */
function headingTape(ctx, w, headingDeg) {
  const x0 = w / 2 - 190;
  const y = 14;
  const width = 380;
  const h = 34;
  panel(ctx, x0, y, width, h);
  const pxPerDeg = width / 120;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y, width, h);
  ctx.clip();
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  const start = Math.floor((headingDeg - 60) / 10) * 10;
  for (let d = start; d <= headingDeg + 60; d += 10) {
    const dd = ((d % 360) + 360) % 360;
    const tx = w / 2 + (d - headingDeg) * pxPerDeg;
    // A heading sliding in or out is left out rather than half drawn.
    if (tx < x0 + 20 || tx > x0 + width - 20) continue;
    const cardinal = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' }[dd];
    ctx.fillStyle = cardinal ? GOLD : DIM;
    ctx.fillText(cardinal || String(dd).padStart(3, '0'), tx, y + 22);
    ctx.strokeStyle = cardinal ? GOLD : DIM;
    ctx.beginPath();
    ctx.moveTo(tx, y + 26);
    ctx.lineTo(tx, y + h - 4);
    ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle = GOLD;
  ctx.beginPath();
  ctx.moveTo(w / 2 - 6, y + h - 2);
  ctx.lineTo(w / 2 + 6, y + h - 2);
  ctx.lineTo(w / 2, y + h + 7);
  ctx.closePath();
  ctx.fill();
}

/** Artificial horizon: sky and ground halves, rolled and pitched with the aircraft. */
function artificialHorizon(ctx, x, y, r, roll, pitch) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(x, y);
  ctx.rotate(-roll);
  const offset = clamp(pitch, -0.5, 0.5) * r * 1.6;
  ctx.fillStyle = '#3f6d8e';
  ctx.fillRect(-r, -r + offset - r, r * 2, r * 2);
  ctx.fillStyle = '#6b4a2f';
  ctx.fillRect(-r, offset, r * 2, r * 2);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-r, offset);
  ctx.lineTo(r, offset);
  ctx.stroke();
  // Pitch ladder.
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 1;
  ctx.font = '9px system-ui, sans-serif';
  for (const deg of [-20, -10, 10, 20]) {
    const ly = offset - (deg * Math.PI / 180) * r * 1.6;
    const len = deg % 20 === 0 ? 22 : 12;
    ctx.beginPath();
    ctx.moveTo(-len, ly);
    ctx.lineTo(len, ly);
    ctx.stroke();
  }
  ctx.restore();
  // Fixed wings and bezel.
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x - r - 2, y);
  ctx.lineTo(x - 10, y);
  ctx.moveTo(x + 10, y);
  ctx.lineTo(x + r + 2, y);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(235,242,250,0.4)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = GOLD;
  ctx.beginPath();
  ctx.arc(x, y, 3, 0, Math.PI * 2);
  ctx.fill();
}

/** A vertical bar gauge (throttle or fuel) with its label and reading. */
function barGauge(ctx, x, y, w, h, frac, colour, label, valueText) {
  panel(ctx, x - 8, y - 22, w + 16, h + 44);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 4);
  ctx.fill();
  const fh = h * clamp(frac, 0, 1);
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.roundRect(x, y + h - fh, w, fh, 4);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, x + w / 2, y - 8);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.fillText(valueText, x + w / 2, y + h + 16);
}

/** Draw the whole HUD over the scene. */
export function drawHUD(ctx, w, h, world, missionDef) {
  const plane = world.plane;
  const mission = world.mission;
  const knots = Math.round(plane.speed * 1.94384);
  const feet = Math.round(plane.y * 3.28084);
  const headingDeg = ((plane.heading * 180 / Math.PI) % 360 + 360) % 360;

  headingTape(ctx, w, headingDeg);
  tape(ctx, 16, 70, 62, 190, knots, 10, 'KT', (v) => String(Math.round(v)), 'right');
  tape(ctx, w - EDGE - 62, 70, 62, 190, feet, 100, 'FT', (v) => String(Math.round(v)), 'left');
  ctx.fillStyle = DIM;
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('AIRSPEED', 16, 62);
  ctx.textAlign = 'right';
  ctx.fillText('ALTITUDE', w - EDGE, 62);

  // Mission panel, top left under the airspeed tape.
  panel(ctx, 16, 276, 250, 92);
  ctx.fillStyle = GOLD;
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(missionDef.name, 28, 300);
  ctx.fillStyle = INK;
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText(missionDef.goal, 28, 320);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px system-ui, sans-serif';
  const left = remainingCount(mission);
  const total = mission.count;
  ctx.fillText(`TARGETS  ${total - left}/${total}`, 28, 342);
  ctx.fillStyle = CYAN;
  ctx.fillText(`TIME  ${formatTime(mission.elapsed)}`, 150, 342);
  ctx.fillStyle = GOLD;
  ctx.fillText(`SCORE  ${mission.score}`, 28, 360);

  // Throttle, fuel and the horizon, bottom corners.
  barGauge(ctx, 28, h - 150, 18, 110, plane.throttle, '#f4b942', 'THR', `${Math.round(plane.throttle * 100)}%`);
  const fuelColour = plane.fuel < 25 ? '#ff5a4e' : '#57d7e8';
  barGauge(ctx, 72, h - 150, 18, 110, plane.fuel / CONFIG.fuelCapacity, fuelColour, 'FUEL', `${Math.round(plane.fuel)}`);
  if (plane.flaps) {
    ctx.fillStyle = CYAN;
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('FLAPS DOWN', 112, h - 96);
  }
  if (plane.damage > 0) {
    ctx.fillStyle = plane.damage > 60 ? '#ff5a4e' : GOLD;
    ctx.fillText(`DAMAGE ${Math.round(plane.damage)}%`, 112, h - 76);
  }
  artificialHorizon(ctx, w - 86, h - 86, 56, plane.roll, plane.pitch);
  ctx.fillStyle = DIM;
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('ATTITUDE', w - 86, h - 18);

  // Stall warning, when the wing is about to quit.
  const minSpeed = plane.flaps ? CONFIG.minSpeedFlaps : CONFIG.minSpeed;
  if (plane.airborne && plane.speed < minSpeed + 6) {
    ctx.fillStyle = '#ff5a4e';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('STALL — NOSE DOWN, POWER UP', w / 2, 84);
  }
  if (plane.fuel < 20 && plane.fuel > 0) {
    ctx.fillStyle = '#ff5a4e';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('LOW FUEL — FIND A GREEN RING', w / 2, 108);
  }

  // Centre flash messages: what just happened, while it is fresh.
  const flashAge = world.time - world.flashAt;
  if (world.flash && flashAge < 2.6) {
    ctx.globalAlpha = clamp(1.2 - flashAge / 2.6, 0, 1);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 30px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(world.flash, w / 2, h * 0.3);
    ctx.globalAlpha = 1;
  }
  const msgAge = world.time - mission.messageAt;
  if (mission.message && msgAge < 2.6) {
    ctx.globalAlpha = clamp(1.2 - msgAge / 2.6, 0, 1);
    ctx.fillStyle = GOLD;
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(mission.message, w / 2, h * 0.3 + 34);
    ctx.globalAlpha = 1;
  }
}

/** Title screen: the game name, the three sorties, and the controls. */
export function drawTitle(ctx, w, h, selected, best) {
  ctx.fillStyle = 'rgba(8,12,24,0.55)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = GOLD;
  ctx.font = 'bold 64px system-ui, sans-serif';
  ctx.fillText('SUNSET RIDGE', w / 2, h * 0.2);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 30px system-ui, sans-serif';
  ctx.fillText('—  V A L L E Y   R U N  —', w / 2, h * 0.2 + 44);
  ctx.fillStyle = DIM;
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText('A sunset flight over the valley. Three sorties. One little aeroplane. Bring her home.', w / 2, h * 0.2 + 76);

  const cardW = 300;
  const gap = 24;
  const totalW = cardW * 3 + gap * 2;
  let x = (w - totalW) / 2;
  const y = h * 0.36;
  MISSIONS.forEach((m, i) => {
    const sel = i === selected;
    ctx.fillStyle = sel ? 'rgba(244,185,66,0.16)' : 'rgba(10,16,28,0.88)';
    ctx.beginPath();
    ctx.roundRect(x, y, cardW, 150, 10);
    ctx.fill();
    ctx.strokeStyle = sel ? GOLD : 'rgba(235,242,250,0.25)';
    ctx.lineWidth = sel ? 2.5 : 1;
    ctx.stroke();
    ctx.fillStyle = sel ? GOLD : INK;
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillText(`PRESS ${m.key}`, x + cardW / 2, y + 28);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 21px system-ui, sans-serif';
    ctx.fillText(m.subtitle.toUpperCase(), x + cardW / 2, y + 60);
    ctx.fillStyle = DIM;
    ctx.font = '13px system-ui, sans-serif';
    wrapText(ctx, m.blurb, x + cardW / 2, y + 86, cardW - 28, 18);
    ctx.fillStyle = DIM;
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText(m.goal, x + cardW / 2, y + 132);
    x += cardW + gap;
  });

  ctx.fillStyle = INK;
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillText('↑ ↓ pitch      ← → bank & turn      W / S throttle      SPACE flaps & brakes      R restart      P pause', w / 2, h * 0.68);
  ctx.fillText('Mouse: steer with the pointer. Touch the rings, mind the fuel, land her gently.', w / 2, h * 0.68 + 26);
  ctx.fillStyle = GOLD;
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillText('PRESS ENTER TO FLY', w / 2, h * 0.78);
  if (best > 0) {
    ctx.fillStyle = DIM;
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillText(`Best score this session: ${best}`, w / 2, h * 0.78 + 30);
  }
}

/** Crash and completion screens. */
export function drawEndScreen(ctx, w, h, world, missionDef) {
  ctx.fillStyle = 'rgba(8,12,24,0.6)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  if (world.screen === 'crashed') {
    ctx.fillStyle = '#ff5a4e';
    ctx.font = 'bold 54px system-ui, sans-serif';
    ctx.fillText('CRASHED', w / 2, h * 0.3);
    ctx.fillStyle = INK;
    ctx.font = '18px system-ui, sans-serif';
    wrapText(ctx, world.crashReason, w / 2, h * 0.3 + 40, 700, 26);
  } else {
    ctx.fillStyle = GOLD;
    ctx.font = 'bold 54px system-ui, sans-serif';
    ctx.fillText('MISSION COMPLETE', w / 2, h * 0.3);
    ctx.fillStyle = INK;
    ctx.font = '18px system-ui, sans-serif';
    ctx.fillText(missionDef.name, w / 2, h * 0.3 + 40);
  }
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.fillText(`SCORE  ${world.mission.score}`, w / 2, h * 0.48);
  ctx.fillStyle = DIM;
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText(`Time ${formatTime(world.mission.elapsed)}   •   Fuel left ${Math.round(world.plane.fuel)}   •   Best ${Math.max(world.best, world.mission.score)}`, w / 2, h * 0.48 + 32);
  ctx.fillStyle = GOLD;
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillText('R — fly again      M — choose another sortie', w / 2, h * 0.62);
}

/** Centred word-wrap for the title cards and the crash reason. */
function wrapText(ctx, text, cx, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let ly = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, cx, ly);
      line = word;
      ly += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, cx, ly);
}
