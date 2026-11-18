// Synthesised sound: every effect and the music loop are built with WebAudio,
// so the game ships no audio files at all.
let ctx = null;
let master = null;
let muted = false;
let musicTimer = null;
let sirenNodes = null;

export function initAudio() {
  if (ctx) return;
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  } catch (err) {
    ctx = null;
  }
}

export function resumeAudio() {
  if (ctx && ctx.state === 'suspended') ctx.resume();
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : 0.5;
  return muted;
}

export function isMuted() {
  return muted;
}

function noiseBuffer(duration) {
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * duration), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function blip(freq, dur, type, vol, slideTo) {
  if (!ctx || muted) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type || 'square';
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
  gain.gain.setValueAtTime(vol || 0.2, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  osc.connect(gain); gain.connect(master);
  osc.start(); osc.stop(ctx.currentTime + dur);
}

function noiseHit(dur, vol, lowpass) {
  if (!ctx || muted) return;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(dur);
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = lowpass || 1200;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(vol || 0.3, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  src.connect(filter); filter.connect(gain); gain.connect(master);
  src.start();
}

export const sfx = {
  shot() { noiseHit(0.12, 0.35, 3000); blip(220, 0.08, 'square', 0.12, 60); },
  enemyShot() { noiseHit(0.1, 0.18, 2200); },
  hit() { blip(180, 0.06, 'triangle', 0.2, 90); },
  pickup() { blip(660, 0.09, 'sine', 0.25, 990); blip(990, 0.12, 'sine', 0.2, 1320); },
  cash() { blip(880, 0.07, 'sine', 0.22); setTimeout(() => blip(1174, 0.1, 'sine', 0.22), 70); },
  carDoor() { noiseHit(0.08, 0.2, 800); },
  crash() { noiseHit(0.25, 0.4, 500); blip(70, 0.2, 'sine', 0.3, 40); },
  explosion() {
    noiseHit(0.7, 0.6, 900);
    blip(120, 0.6, 'sine', 0.4, 30);
  },
  sirenBlip() { blip(900, 0.15, 'sine', 0.12, 1400); },
  mission() {
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(f, 0.16, 'triangle', 0.25), i * 110));
  },
  fail() { [392, 330, 262].forEach((f, i) => setTimeout(() => blip(f, 0.2, 'sawtooth', 0.15), i * 140)); },
  busted() { [220, 175, 147].forEach((f, i) => setTimeout(() => blip(f, 0.25, 'square', 0.18), i * 160)); },
  horn() { blip(370, 0.18, 'square', 0.15, 370); },
};

let engineOsc = null;
let engineGain = null;

export function setEngine(speedRatio, on) {
  if (!ctx || muted) return;
  if (!Number.isFinite(speedRatio)) speedRatio = 0;
  if (on && !engineOsc) {
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineGain = ctx.createGain();
    engineGain.gain.value = 0.0;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    engineOsc.connect(filter); filter.connect(engineGain); engineGain.connect(master);
    engineOsc.start();
  }
  if (!engineOsc) return;
  if (!on) {
    engineGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
    return;
  }
  engineOsc.frequency.setTargetAtTime(50 + speedRatio * 160, ctx.currentTime, 0.08);
  engineGain.gain.setTargetAtTime(0.05 + speedRatio * 0.05, ctx.currentTime, 0.1);
}

export function setSiren(on) {
  if (!ctx) return;
  if (on && !sirenNodes) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 750;
    const lfo = ctx.createOscillator();
    lfo.type = 'square';
    lfo.frequency.value = 0.9;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 220;
    lfo.connect(lfoGain); lfoGain.connect(osc.frequency);
    const gain = ctx.createGain();
    gain.gain.value = 0.045;
    osc.connect(gain); gain.connect(master);
    osc.start(); lfo.start();
    sirenNodes = { osc, lfo, gain };
  } else if (!on && sirenNodes) {
    try { sirenNodes.osc.stop(); sirenNodes.lfo.stop(); } catch (err) { /* already stopped */ }
    sirenNodes = null;
  }
}

// A lazy coastal groove: bass line + hats on a scheduler, quiet under the SFX.
const BASS = [55, 0, 55, 65.4, 55, 0, 49, 58.3];
let musicStep = 0;
export function startMusic() {
  if (!ctx || musicTimer) return;
  musicTimer = setInterval(() => {
    if (muted || !ctx) return;
    const step = musicStep % 8;
    const freq = BASS[step];
    if (freq) blip(freq, 0.22, 'triangle', 0.16);
    if (step % 2 === 0) noiseHit(0.03, 0.05, 6000);
    musicStep += 1;
  }, 240);
}

export function stopMusic() {
  if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
}
