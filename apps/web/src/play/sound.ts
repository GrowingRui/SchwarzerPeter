/**
 * Table sounds, made on the fly with Web Audio (no sound files to download).
 * Off until the player switches them on; the choice is kept in this browser only.
 */

export type Sound = 'draw' | 'pair' | 'turn' | 'peter' | 'shuffle' | 'out' | 'win' | 'lose' | 'pop' | 'tick';

const STORAGE_KEY = 'sp.sound';

let on = load();
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
const listeners = new Set<() => void>();

function load(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export const soundOn = () => on;

export function setSoundOn(next: boolean) {
  on = next;
  try {
    localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
  } catch {
    /* private mode: only this visit */
  }
  // Switching on is a click, so the browser lets the audio start now, with a pop to show it works.
  if (next) void audio()?.resume().then(() => play('pop'));
  listeners.forEach((l) => l());
}

export function subscribeSound(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

function audio(): AudioContext | null {
  if (ctx) return ctx;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  ctx = new Ctor();
  master = ctx.createGain();
  master.gain.value = 0.5;
  master.connect(ctx.destination);
  return ctx;
}

// Sound saved as on from an earlier visit: the first tap anywhere wakes the audio.
if (typeof window !== 'undefined') {
  const wake = () => {
    if (on) audio()?.resume();
  };
  window.addEventListener('pointerdown', wake, { passive: true });
  window.addEventListener('keydown', wake);
}

/** A short tone with a quick attack and a soft tail. */
function tone(c: AudioContext, freq: number, at: number, length: number, opts: { type?: OscillatorType; gain?: number; glideTo?: number } = {}) {
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = opts.type ?? 'sine';
  osc.frequency.setValueAtTime(freq, at);
  if (opts.glideTo) osc.frequency.exponentialRampToValueAtTime(opts.glideTo, at + length);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(opts.gain ?? 0.3, at + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, at + length);
  osc.connect(g).connect(master!);
  osc.start(at);
  osc.stop(at + length + 0.05);
}

let noiseBuffer: AudioBuffer | null = null;
/** Filtered noise: the paper sound of a card sliding. */
function swish(c: AudioContext, at: number, length: number, from: number, to: number, gain = 0.25) {
  if (!noiseBuffer) {
    noiseBuffer = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  const src = c.createBufferSource();
  src.buffer = noiseBuffer;
  const filter = c.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = 1.2;
  filter.frequency.setValueAtTime(from, at);
  filter.frequency.exponentialRampToValueAtTime(to, at + length);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + length * 0.25);
  g.gain.exponentialRampToValueAtTime(0.0001, at + length);
  src.connect(filter).connect(g).connect(master!);
  src.start(at, Math.random() * 0.5);
  src.stop(at + length + 0.05);
}

export function play(sound: Sound) {
  if (!on) return;
  const c = audio();
  if (!c || c.state !== 'running') return;
  const t = c.currentTime + 0.01;
  switch (sound) {
    case 'draw':
      swish(c, t, 0.22, 3200, 900);
      break;
    case 'pair': // two cards tapped down on the wood
      tone(c, 520, t, 0.12, { type: 'triangle', gain: 0.28 });
      tone(c, 780, t + 0.09, 0.16, { type: 'triangle', gain: 0.22 });
      break;
    case 'turn': // a small brass bell
      tone(c, 880, t, 0.5, { gain: 0.16 });
      tone(c, 1320, t + 0.07, 0.6, { gain: 0.1 });
      break;
    case 'peter': // a cat's grumble, low and out of tune
      tone(c, 220, t, 0.55, { type: 'sawtooth', gain: 0.08, glideTo: 150 });
      tone(c, 311, t, 0.55, { type: 'triangle', gain: 0.12, glideTo: 208 });
      break;
    case 'shuffle':
      for (let i = 0; i < 6; i++) swish(c, t + i * 0.045, 0.06, 4200, 2000, 0.16);
      break;
    case 'out':
      [523, 659, 784].forEach((f, i) => tone(c, f, t + i * 0.09, 0.3, { gain: 0.16 }));
      break;
    case 'win':
      [523, 659, 784, 1047].forEach((f, i) => tone(c, f, t + i * 0.11, 0.5, { type: 'triangle', gain: 0.2 }));
      break;
    case 'lose':
      [392, 349, 311, 262].forEach((f, i) => tone(c, f, t + i * 0.16, 0.45, { type: 'triangle', gain: 0.2 }));
      break;
    case 'pop':
      tone(c, 600, t, 0.09, { gain: 0.14, glideTo: 900 });
      break;
    case 'tick':
      tone(c, 1500, t, 0.05, { type: 'square', gain: 0.04 });
      break;
  }
}
