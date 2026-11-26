// Sunset Ridge — Valley Run: the game loop, the screens, and the wiring between
// the stick, the world, the renderer and the instruments. The world steps at a
// fixed 60 Hz, so the flight model feels the same on every machine.
import { MISSIONS } from './config.js';
import { createWorld, stepWorld, restartWorld, setMission, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSED, SCREEN_CRASHED, SCREEN_COMPLETE } from './world.js';
import { renderScene } from './render.js';
import { drawHUD, drawTitle, drawEndScreen } from './hud.js';
import { createInput, attachInput, pollInput } from './input.js';
import { createAudio, startAudio, updateAudio, playRingChime, playTouchdown, playCrash } from './audio.js';
import { buildScenery } from './terrain.js';
import { stageShot, stageTitleBackdrop } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');

const scenery = buildScenery();
const input = createInput();
attachInput(input, canvas);
const audio = createAudio();

let selected = 0;
let world = createWorld(MISSIONS[selected].id);
let backdrop = stageTitleBackdrop();
let lastTime = performance.now();
let accumulator = 0;
const STEP = 1 / 60;

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

if (shotName) {
  // Deterministic screenshot mode: stage the scene, draw one frame, stop.
  // ?shot=title stages the menu over the valley; the others stage a mission.
  if (shotName === 'title') {
    world = stageTitleBackdrop();
    renderScene(ctx, canvas.width, canvas.height, world, scenery, world.time);
    drawTitle(ctx, canvas.width, canvas.height, 0, 0);
    document.title = 'Sunset Ridge — title';
  } else {
    const missionId = shotName === 'landing' ? 'home' : shotName === 'rings' ? 'slalom' : 'rings';
    const staged = stageShot(shotName, missionId, canvas.width, canvas.height);
    world = staged.world;
    renderScene(ctx, canvas.width, canvas.height, world, scenery, world.time);
    // The HUD is part of the shot: it shows the instruments lit and the mission
    // state, whether the scene ends mid-flight, on the runway or complete.
    drawHUD(ctx, canvas.width, canvas.height, world, MISSIONS.find((m) => m.id === missionId));
    document.title = `Sunset Ridge — ${shotName}`;
  }
} else {
  requestAnimationFrame(frame);
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;
  const pressed = pollInput(input, now / 1000);

  if (world.screen === SCREEN_TITLE) {
    if (pressed.has('mission1')) selected = 0;
    if (pressed.has('mission2')) selected = 1;
    if (pressed.has('mission3')) selected = 2;
    if (pressed.has('enter')) {
      startAudio(audio);
      world = createWorld(MISSIONS[selected].id);
      world.screen = SCREEN_PLAY;
      statusEl.textContent = `Flying ${MISSIONS[selected].name}.`;
    }
    // The backdrop drifts slowly across the valley.
    backdrop.plane.z += 8 * dt;
    backdrop.plane.heading = 0.5 + Math.sin(now / 9000) * 0.15;
    renderScene(ctx, canvas.width, canvas.height, backdrop, scenery, now / 1000);
    drawTitle(ctx, canvas.width, canvas.height, selected, world.best);
    return;
  }

  if (pressed.has('pause') && (world.screen === SCREEN_PLAY || world.screen === SCREEN_PAUSED)) {
    world.screen = world.screen === SCREEN_PLAY ? SCREEN_PAUSED : SCREEN_PLAY;
  }
  if (pressed.has('restart') && world.screen !== SCREEN_TITLE) {
    world = restartWorld(world);
    statusEl.textContent = 'Restarted.';
  }
  if (pressed.has('menu') && (world.screen === SCREEN_CRASHED || world.screen === SCREEN_COMPLETE)) {
    world = setMission(world, MISSIONS[selected].id);
    world.screen = SCREEN_TITLE;
    backdrop = stageTitleBackdrop();
  }
  if (pressed.has('enter') && (world.screen === SCREEN_CRASHED || world.screen === SCREEN_COMPLETE)) {
    world = restartWorld(world);
  }

  if (world.screen === SCREEN_PLAY) {
    startAudio(audio);
    accumulator += dt;
    let guard = 0;
    while (accumulator >= STEP && guard < 5) {
      const before = world.events.length;
      stepWorld(world, input, STEP);
      accumulator -= STEP;
      guard += 1;
      for (let i = before; i < world.events.length; i += 1) {
        const ev = world.events[i];
        if (ev === 'ring' || ev === 'gate') playRingChime(audio);
        if (ev === 'touchdown') playTouchdown(audio);
        if (ev === 'crash') playCrash(audio);
      }
    }
    updateAudio(audio, world.plane);
    renderScene(ctx, canvas.width, canvas.height, world, scenery, now / 1000);
    drawHUD(ctx, canvas.width, canvas.height, world, MISSIONS.find((m) => m.id === world.mission.id));
    if (world.screen === SCREEN_CRASHED) statusEl.textContent = `Crashed: ${world.crashReason}`;
    if (world.screen === SCREEN_COMPLETE) statusEl.textContent = `Mission complete. Score ${world.mission.score}.`;
    return;
  }

  if (world.screen === SCREEN_PAUSED) {
    renderScene(ctx, canvas.width, canvas.height, world, scenery, now / 1000);
    drawHUD(ctx, canvas.width, canvas.height, world, MISSIONS.find((m) => m.id === world.mission.id));
    ctx.fillStyle = 'rgba(8,12,24,0.55)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 44px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', canvas.width / 2, canvas.height / 2);
    ctx.fillStyle = 'rgba(235,242,250,0.7)';
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillText('P — resume      R — restart', canvas.width / 2, canvas.height / 2 + 36);
    return;
  }

  // Crashed or complete: hold the last frame of the world under the end screen.
  renderScene(ctx, canvas.width, canvas.height, world, scenery, now / 1000);
  drawEndScreen(ctx, canvas.width, canvas.height, world, MISSIONS.find((m) => m.id === world.mission.id));
}
