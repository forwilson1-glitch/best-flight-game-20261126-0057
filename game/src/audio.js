// Sound, synthesised in the browser with WebAudio — no audio files, no network.
// An engine that follows the throttle, wind that follows the speed, and a chime,
// a thud and a crash that each say what just happened.
export function createAudio() {
  return {
    ctx: null,
    engineOsc: null,
    engineGain: null,
    windSource: null,
    windGain: null,
    windFilter: null,
    muted: false,
  };
}

/** Start the audio graph. Must be called from a user gesture. */
export function startAudio(audio) {
  if (audio.ctx) {
    if (audio.ctx.state === 'suspended') audio.ctx.resume();
    return;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  const ctx = new AC();
  audio.ctx = ctx;
  // Engine: two detuned saws through a low-pass, the note rising with the throttle.
  audio.engineOsc = ctx.createOscillator();
  audio.engineOsc.type = 'sawtooth';
  audio.engineOsc.frequency.value = 55;
  const osc2 = ctx.createOscillator();
  osc2.type = 'sawtooth';
  osc2.frequency.value = 55.7;
  audio.engineGain = ctx.createGain();
  audio.engineGain.gain.value = 0;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 420;
  audio.engineOsc.connect(lp);
  osc2.connect(lp);
  lp.connect(audio.engineGain);
  audio.engineGain.connect(ctx.destination);
  audio.engineOsc.start();
  osc2.start();
  audio.engineOsc2 = osc2;
  // Wind: looped noise through a band-pass, louder and brighter with speed.
  const len = ctx.sampleRate * 2;
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
  audio.windSource = ctx.createBufferSource();
  audio.windSource.buffer = buffer;
  audio.windSource.loop = true;
  audio.windFilter = ctx.createBiquadFilter();
  audio.windFilter.type = 'bandpass';
  audio.windFilter.frequency.value = 500;
  audio.windFilter.Q.value = 0.6;
  audio.windGain = ctx.createGain();
  audio.windGain.gain.value = 0;
  audio.windSource.connect(audio.windFilter);
  audio.windFilter.connect(audio.windGain);
  audio.windGain.connect(ctx.destination);
  audio.windSource.start();
}

/** Keep the engine and wind following the aircraft, once a frame. */
export function updateAudio(audio, plane) {
  if (!audio.ctx || audio.muted) return;
  const t = audio.ctx.currentTime;
  const rpm = 48 + plane.throttle * 62 + plane.speed * 0.35;
  audio.engineOsc.frequency.setTargetAtTime(rpm, t, 0.08);
  audio.engineOsc2.frequency.setTargetAtTime(rpm * 1.007, t, 0.08);
  audio.engineGain.gain.setTargetAtTime(plane.airborne ? 0.05 + plane.throttle * 0.06 : 0.02 + plane.throttle * 0.05, t, 0.1);
  const wind = Math.min(1, plane.speed / 90);
  audio.windGain.gain.setTargetAtTime(plane.airborne ? wind * 0.12 : 0, t, 0.15);
  audio.windFilter.frequency.setTargetAtTime(300 + wind * 900, t, 0.15);
}

function blip(audio, freq, dur, type, gain, when = 0) {
  if (!audio.ctx || audio.muted) return;
  const t = audio.ctx.currentTime + when;
  const osc = audio.ctx.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  const g = audio.ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g);
  g.connect(audio.ctx.destination);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

function noiseBurst(audio, dur, gain, filterFreq) {
  if (!audio.ctx || audio.muted) return;
  const ctx = audio.ctx;
  const len = Math.floor(ctx.sampleRate * dur);
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = filterFreq;
  const g = ctx.createGain();
  g.gain.value = gain;
  src.connect(filter);
  filter.connect(g);
  g.connect(ctx.destination);
  src.start();
}

/** The ring chime: two bright notes, a fifth apart. */
export function playRingChime(audio) {
  blip(audio, 880, 0.25, 'sine', 0.16);
  blip(audio, 1318, 0.4, 'sine', 0.14, 0.07);
}

/** The touchdown thud: low sine plus a soft noise burst. */
export function playTouchdown(audio) {
  blip(audio, 70, 0.3, 'sine', 0.3);
  noiseBurst(audio, 0.18, 0.18, 500);
}

/** The crash: a hard noise burst and a falling tone. */
export function playCrash(audio) {
  noiseBurst(audio, 0.7, 0.4, 900);
  blip(audio, 220, 0.8, 'sawtooth', 0.12);
}
