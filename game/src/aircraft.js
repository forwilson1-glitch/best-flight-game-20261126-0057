// The Kestrel herself: a sporty prop monoplane in flat vector, drawn with care
// — a fuselage you can see the panels on, a smoked canopy, a spinning prop and
// wingtip lights. She is drawn in screen space, banked with the roll, so the
// chase view always shows her the same size however the valley moves behind.
import { clamp } from './random.js';

/** Draw the aeroplane at screen (cx, cy), banked by `roll` radians. */
export function drawAircraft(ctx, cx, cy, roll, pitch, throttle, propAngle, time) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(clamp(roll, -1.1, 1.1) * 0.9);
  const S = 1; // scale unit: the wingspan comes out near 300 px

  // The paint: sunset gold at the nose, burnt orange in the middle, deep red
  // at the tail; pale wings with a darker edge.
  const body = ctx.createLinearGradient(0, -150, 0, 40);
  body.addColorStop(0, '#e8b64c');
  body.addColorStop(0.45, '#d97b3f');
  body.addColorStop(1, '#8c3d2b');
  const wingGrad = ctx.createLinearGradient(-150, 0, 150, 0);
  wingGrad.addColorStop(0, '#c9d6e8');
  wingGrad.addColorStop(0.5, '#eef3fa');
  wingGrad.addColorStop(1, '#c9d6e8');

  // Main wings: tapered, slightly swept, panel lines, tip lights.
  ctx.fillStyle = wingGrad;
  ctx.beginPath();
  ctx.moveTo(-152, 6);
  ctx.quadraticCurveTo(-120, -16, -58, -12);
  ctx.lineTo(58, -12);
  ctx.quadraticCurveTo(120, -16, 152, 6);
  ctx.quadraticCurveTo(120, 14, 60, 12);
  ctx.lineTo(-60, 12);
  ctx.quadraticCurveTo(-120, 14, -152, 6);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(40,48,66,0.55)';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Panel lines across the wings.
  ctx.strokeStyle = 'rgba(40,48,66,0.28)';
  ctx.lineWidth = 1.5;
  for (const wx of [-100, -60, 60, 100]) {
    ctx.beginPath();
    ctx.moveTo(wx, -12);
    ctx.lineTo(wx * 0.92, 12);
    ctx.stroke();
  }
  // Navigation lights: red on the port tip, green on the starboard tip.
  ctx.fillStyle = '#ff3b30';
  ctx.beginPath(); ctx.arc(-150, 6, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#2fd05a';
  ctx.beginPath(); ctx.arc(150, 6, 5, 0, Math.PI * 2); ctx.fill();

  // Tailplane, lower on the frame because it sits nearer the camera.
  ctx.fillStyle = '#dfe7f2';
  ctx.beginPath();
  ctx.moveTo(-62, 34);
  ctx.quadraticCurveTo(-40, 26, -16, 30);
  ctx.lineTo(16, 30);
  ctx.quadraticCurveTo(40, 26, 62, 34);
  ctx.quadraticCurveTo(40, 44, 0, 42);
  ctx.quadraticCurveTo(-40, 44, -62, 34);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(40,48,66,0.5)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Fuselage: long, tapering from the tail at the bottom to the nose at the top.
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(-14, 44);
  ctx.quadraticCurveTo(-20, -10, -13, -96);
  ctx.quadraticCurveTo(-11, -128, 0, -138);
  ctx.quadraticCurveTo(11, -128, 13, -96);
  ctx.quadraticCurveTo(20, -10, 14, 44);
  ctx.quadraticCurveTo(0, 52, -14, 44);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(60,24,12,0.6)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Belly stripe and a rivet line down the fuselage.
  ctx.strokeStyle = 'rgba(255,235,200,0.5)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-4, -120);
  ctx.lineTo(-4, 40);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(4, -120);
  ctx.lineTo(4, 40);
  ctx.stroke();

  // Canopy: smoked glass with a glint of sky in it.
  const canopy = ctx.createLinearGradient(-8, -100, 8, -58);
  canopy.addColorStop(0, '#bfe3f2');
  canopy.addColorStop(0.5, '#5d8fb0');
  canopy.addColorStop(1, '#2c4d68');
  ctx.fillStyle = canopy;
  ctx.beginPath();
  ctx.moveTo(-9, -58);
  ctx.quadraticCurveTo(-10, -96, 0, -100);
  ctx.quadraticCurveTo(10, -96, 9, -58);
  ctx.quadraticCurveTo(0, -52, -9, -58);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(20,30,44,0.7)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-5, -92);
  ctx.lineTo(1, -70);
  ctx.stroke();

  // Vertical fin with the sunset roundel.
  ctx.fillStyle = '#8c3d2b';
  ctx.beginPath();
  ctx.moveTo(-3, 40);
  ctx.lineTo(-4, 74);
  ctx.quadraticCurveTo(0, 80, 4, 74);
  ctx.lineTo(3, 40);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#f4b942';
  ctx.beginPath(); ctx.arc(0, 60, 7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#d97b3f';
  ctx.beginPath(); ctx.arc(0, 60, 3.5, 0, Math.PI * 2); ctx.fill();

  // Registration on the wings, big enough to read at a glance.
  ctx.fillStyle = 'rgba(30,38,54,0.8)';
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('N77SR', -84, 4);
  ctx.fillText('KESTREL', 84, 4);

  // Propeller: a spinning blur disc at the nose, brighter with the throttle.
  const propR = 26 + throttle * 10;
  const propAlpha = 0.10 + throttle * 0.16;
  ctx.save();
  ctx.translate(0, -142);
  ctx.rotate(propAngle * 0.35);
  ctx.fillStyle = `rgba(210,220,235,${propAlpha})`;
  ctx.beginPath();
  ctx.ellipse(0, 0, 5, propR, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0, 0, propR, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // Spinner cone.
  ctx.fillStyle = '#f4b942';
  ctx.beginPath(); ctx.arc(0, -140, 6, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(60,24,12,0.6)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Exhaust shimmer when the throttle is well open.
  if (throttle > 0.55) {
    const flicker = 0.25 + 0.2 * Math.sin(time * 31) * Math.sin(time * 17);
    ctx.fillStyle = `rgba(255,${Math.round(160 + 60 * flicker)},60,${0.35 + flicker})`;
    ctx.beginPath();
    ctx.moveTo(-7, 46);
    ctx.lineTo(0, 46 + 10 + throttle * 14);
    ctx.lineTo(7, 46);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}
