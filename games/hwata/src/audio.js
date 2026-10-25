// 효과음: 소리 파일 없이 브라우저에서 바로 만든다. 첫 터치 뒤에만 소리가 난다.
const MUTE_KEY = 'hwata-mute';
let ac = null;
let muted = false;
try { muted = localStorage.getItem(MUTE_KEY) === '1'; } catch { /* 무시 */ }

export function unlockAudio() {
  if (!ac) {
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { ac = null; }
  }
  if (ac && ac.state === 'suspended') ac.resume().catch(() => {});
}

export const isMuted = () => muted;

export function toggleMute() {
  muted = !muted;
  try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch { /* 무시 */ }
  return muted;
}

function tone(freq, dur, { type = 'square', vol = 0.06, slide = 0, delay = 0 } = {}) {
  if (!ac || muted) return;
  const t = ac.currentTime + delay;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  o.connect(g).connect(ac.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

let noiseBuf = null;
function noise(dur, { vol = 0.12, freq = 800, type = 'lowpass', delay = 0 } = {}) {
  if (!ac || muted) return;
  if (!noiseBuf) {
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.5, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t = ac.currentTime + delay;
  const src = ac.createBufferSource();
  src.buffer = noiseBuf;
  const f = ac.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  const g = ac.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  src.connect(f).connect(g).connect(ac.destination);
  src.start(t);
  src.stop(t + dur + 0.02);
}

export const sfx = {
  chip: () => noise(0.06, { vol: 0.08, freq: 600 }),
  breakDirt: () => { noise(0.14, { vol: 0.16, freq: 420 }); tone(90, 0.1, { type: 'triangle', vol: 0.08, slide: -40 }); },
  breakPot: () => { noise(0.25, { vol: 0.18, freq: 2400, type: 'highpass' }); tone(520, 0.08, { vol: 0.04, delay: 0.03 }); },
  pick: () => { tone(660, 0.06, { vol: 0.05 }); tone(990, 0.08, { vol: 0.05, delay: 0.05 }); },
  pickHq: () => { tone(660, 0.06, { vol: 0.05 }); tone(880, 0.06, { vol: 0.05, delay: 0.05 }); tone(1320, 0.12, { vol: 0.05, delay: 0.1 }); },
  place: () => tone(220, 0.07, { type: 'triangle', vol: 0.1, slide: -60 }),
  shoot: () => noise(0.18, { vol: 0.1, freq: 1800, type: 'highpass' }),
  hit: () => tone(140, 0.12, { type: 'triangle', vol: 0.12, slide: -60 }),
  jump: () => tone(300, 0.09, { type: 'triangle', vol: 0.05, slide: 200 }),
  land: () => noise(0.05, { vol: 0.05, freq: 300 }),
  hurt: () => tone(200, 0.2, { type: 'sawtooth', vol: 0.06, slide: -120 }),
  splash: () => noise(0.25, { vol: 0.1, freq: 1200 }),
  bell: () => { tone(784, 1.2, { type: 'sine', vol: 0.09 }); tone(1176, 0.9, { type: 'sine', vol: 0.03 }); },
  coin: () => { tone(1046, 0.07, { vol: 0.05 }); tone(1568, 0.14, { vol: 0.05, delay: 0.07 }); },
  wrong: () => tone(130, 0.3, { type: 'sawtooth', vol: 0.05 }),
  page: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.18, { type: 'sine', vol: 0.06, delay: i * 0.09 })),
  bubble: () => tone(300 + Math.random() * 200, 0.06, { type: 'sine', vol: 0.04, slide: 200 }),
  click: () => tone(880, 0.03, { vol: 0.03 }),
};
