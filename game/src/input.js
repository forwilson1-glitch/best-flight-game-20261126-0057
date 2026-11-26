// Keyboard and mouse, kept in one place. The game reads a plain input object each
// frame, so the autopilot in shots.js can drive the same aircraft the pilot does.
export function createInput() {
  return {
    keys: new Set(),
    pitch: 0, // +1 pulls the nose up
    roll: 0, // +1 banks right
    throttle: 0, // +1 opens the throttle
    flaps: false,
    brakes: false,
    mouseActive: false,
    mouseX: 0,
    mouseY: 0,
    mouseMovedAt: -10,
    pressed: new Set(), // keys pressed since the last poll
  };
}

const KEYMAP = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ShiftLeft: 'throttleUp', ShiftRight: 'throttleUp',
  ControlLeft: 'throttleDown', ControlRight: 'throttleDown',
  Space: 'flaps',
  KeyR: 'restart', KeyP: 'pause', KeyM: 'menu', Enter: 'enter',
  Digit1: 'mission1', Digit2: 'mission2', Digit3: 'mission3',
};

/** Wire the listeners onto the window; call pollInput once a frame. */
export function attachInput(input, canvas) {
  window.addEventListener('keydown', (e) => {
    const name = KEYMAP[e.code];
    if (!name) return;
    if (name === 'flaps' || name === 'enter') e.preventDefault();
    if (!input.keys.has(name)) input.pressed.add(name);
    input.keys.add(name);
  });
  window.addEventListener('keyup', (e) => {
    const name = KEYMAP[e.code];
    if (name) input.keys.delete(name);
  });
  window.addEventListener('blur', () => input.keys.clear());
  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    input.mouseX = (e.clientX - rect.left) / rect.width;
    input.mouseY = (e.clientY - rect.top) / rect.height;
    input.mouseActive = true;
    input.mouseMovedAt = performance.now() / 1000;
  });
  canvas.addEventListener('mouseleave', () => { input.mouseActive = false; });
}

/** Read the current stick position from keys (and the mouse, when it moved lately). */
export function pollInput(input, now) {
  const k = input.keys;
  let pitch = 0;
  let roll = 0;
  if (k.has('up')) pitch += 1;
  if (k.has('down')) pitch -= 1;
  if (k.has('left')) roll -= 1;
  if (k.has('right')) roll += 1;
  // W/S double as throttle when the arrows are doing the flying; Shift/Ctrl always work.
  let throttle = 0;
  if (k.has('throttleUp')) throttle += 1;
  if (k.has('throttleDown')) throttle -= 1;
  if (input.mouseActive && now - input.mouseMovedAt < 2.5) {
    // Pointer steering: the aircraft follows the pointer like a yoke.
    roll = Math.max(-1, Math.min(1, (input.mouseX - 0.5) * 2.4));
    pitch = Math.max(-1, Math.min(1, (0.52 - input.mouseY) * 2.4));
  }
  input.pitch = pitch;
  input.roll = roll;
  input.throttle = throttle;
  input.flaps = k.has('flaps');
  input.brakes = k.has('flaps');
  const pressed = new Set(input.pressed);
  input.pressed.clear();
  return pressed;
}
