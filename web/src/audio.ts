// Tiny synthesized sound effects (no audio files to host).
let ctx: AudioContext | null = null;
let muted = (() => { try { return localStorage.getItem('jf-muted') === '1'; } catch { return false; } })();

function ac(): AudioContext | null {
  if (muted) return null;
  if (!ctx) {
    try { ctx = new AudioContext(); } catch { return null; }
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(freq: number, dur: number, type: OscillatorType = 'triangle', vol = 0.12, delay = 0, slide = 0) {
  const a = ac();
  if (!a) return;
  const t = a.currentTime + delay;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur: number, vol = 0.1, delay = 0, freq = 1200) {
  const a = ac();
  if (!a) return;
  const t = a.currentTime + delay;
  const buf = a.createBuffer(1, Math.floor(a.sampleRate * dur), a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  const g = a.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(a.destination);
  src.start(t);
}

export const sfx = {
  get muted() { return muted; },
  toggle() {
    muted = !muted;
    try { localStorage.setItem('jf-muted', muted ? '1' : '0'); } catch { /* storage unavailable */ }
    return muted;
  },
  click: () => tone(660, 0.07, 'square', 0.04),
  select: () => { tone(520, 0.08, 'triangle', 0.08); tone(780, 0.09, 'triangle', 0.06, 0.05); },
  place: () => { tone(300, 0.08, 'square', 0.05, 0, 200); noise(0.06, 0.05, 0, 2400); },
  coin: () => { tone(988, 0.08, 'square', 0.05); tone(1319, 0.16, 'square', 0.05, 0.07); },
  dice: () => { for (let i = 0; i < 6; i++) noise(0.04, 0.12, i * 0.05 + Math.random() * 0.02, 1800 + Math.random() * 1500); },
  hit: () => { noise(0.12, 0.18, 0, 600); tone(140, 0.15, 'sawtooth', 0.06, 0, -80); },
  whoosh: () => noise(0.3, 0.06, 0, 900),
  conquer: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, 'triangle', 0.09, i * 0.08)); },
  horn: () => { tone(220, 0.5, 'sawtooth', 0.05, 0, 0); tone(330, 0.5, 'sawtooth', 0.04, 0.05); },
  magic: () => { for (let i = 0; i < 6; i++) tone(600 + i * 140, 0.14, 'sine', 0.05, i * 0.05); },
  thud: () => { tone(90, 0.3, 'sine', 0.25, 0, -40); noise(0.25, 0.15, 0, 300); },
  error: () => { tone(200, 0.12, 'square', 0.05); tone(160, 0.16, 'square', 0.05, 0.08); },
  fanfare: () => { [523, 523, 659, 784, 659, 784, 1047].forEach((f, i) => tone(f, 0.24, 'triangle', 0.1, i * 0.14)); },
  doom: () => { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.32, 'sawtooth', 0.05, i * 0.18)); },
};
