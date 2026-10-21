// Semua bunyi dibuat dengan WebAudio, tanpa file audio: efek antarmuka dan
// tiga stasiun radio generatif (lo-fi, gamelan, hujan) yang tidak pernah berulang persis.

import type { StationId } from "../core/types";

let ctx: AudioContext | null = null;
let sfxBus: GainNode | null = null;
let radioBus: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;
let sfxOn = true;
let sfxVolume = 0.6;
let radioVolume = 0.5;
let paused = false;

function audio(): AudioContext | null {
  try {
    if (!ctx) {
      ctx = new AudioContext();
      sfxBus = ctx.createGain();
      sfxBus.gain.value = sfxOn ? sfxVolume : 0;
      sfxBus.connect(ctx.destination);
      radioBus = ctx.createGain();
      radioBus.gain.value = radioVolume * 0.8;
      radioBus.connect(ctx.destination);
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

export function configureSound(on: boolean, volume: number): void {
  sfxOn = on;
  sfxVolume = Math.min(1, Math.max(0, volume));
  if (ctx && sfxBus) sfxBus.gain.setTargetAtTime(sfxOn ? sfxVolume : 0, ctx.currentTime, 0.05);
}

/** Browser biasa baru mengizinkan suara setelah interaksi pertama. */
export function unlockAudio(): void {
  audio();
}

function noise(a: AudioContext): AudioBuffer {
  if (!noiseBuffer) {
    noiseBuffer = a.createBuffer(1, a.sampleRate * 2, a.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  return noiseBuffer;
}

function tone(bus: AudioNode, freqs: number[], duration: number, type: OscillatorType = "triangle", vol = 0.06, delay = 0): void {
  const a = ctx;
  if (!a) return;
  const t0 = a.currentTime + delay;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  const step = duration / Math.max(1, freqs.length - 1);
  osc.frequency.setValueAtTime(freqs[0], t0);
  freqs.forEach((f, i) => osc.frequency.linearRampToValueAtTime(f, t0 + i * step));
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(vol, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain).connect(bus);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

/** Semburan derau berfilter yang dijadwalkan pada waktu t (detik konteks audio). */
function noiseHit(bus: AudioNode, t: number, duration: number, type: BiquadFilterType, freq: number, vol: number, q = 1): void {
  const a = ctx;
  if (!a) return;
  const src = a.createBufferSource();
  src.buffer = noise(a);
  src.loop = true;
  const f = a.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = a.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  src.connect(f).connect(g).connect(bus);
  src.start(t, Math.random() * 1.5);
  src.stop(t + duration + 0.05);
}

// ---------------------------------------------------------------------------
// Efek suara

export type SoundId = "klik" | "beli" | "koin" | "datang" | "pulang" | "elus" | "fokus" | "istirahat" | "centang" | "gagal" | "baru";

const MIN_GAP: Partial<Record<SoundId, number>> = { klik: 40, koin: 120, elus: 150 };
const lastPlayed = new Map<SoundId, number>();

export function playSound(id: SoundId): void {
  if (!sfxOn || sfxVolume <= 0) return;
  const a = audio();
  if (!a || !sfxBus) return;
  const now = performance.now();
  if (now - (lastPlayed.get(id) ?? -Infinity) < (MIN_GAP[id] ?? 30)) return;
  lastPlayed.set(id, now);
  const bus = sfxBus;
  switch (id) {
    case "klik":
      tone(bus, [900, 700], 0.05, "square", 0.02);
      break;
    case "beli":
      tone(bus, [660, 990], 0.1, "square", 0.03);
      tone(bus, [990, 1320], 0.16, "triangle", 0.035, 0.09);
      break;
    case "koin":
      tone(bus, [1046, 1568], 0.14, "square", 0.022);
      break;
    case "datang":
      tone(bus, [784], 0.25, "sine", 0.05);
      tone(bus, [1046], 0.4, "sine", 0.045, 0.14);
      break;
    case "pulang":
      tone(bus, [880, 660], 0.3, "sine", 0.035);
      break;
    case "elus":
      tone(bus, [700, 1100], 0.12, "sine", 0.05);
      tone(bus, [1100, 1400], 0.1, "triangle", 0.025, 0.08);
      break;
    case "centang":
      tone(bus, [880, 1175], 0.12, "triangle", 0.045);
      break;
    case "gagal":
      tone(bus, [240, 180], 0.16, "square", 0.025);
      break;
    case "baru":
      tone(bus, [523, 659], 0.12, "triangle", 0.045);
      tone(bus, [659, 784], 0.12, "triangle", 0.045, 0.12);
      tone(bus, [784, 1046], 0.35, "triangle", 0.05, 0.24);
      break;
    case "fokus":
      // Lonceng tiga kali: sesi fokus selesai.
      for (let i = 0; i < 3; i++) {
        tone(bus, [1318], 0.9, "sine", 0.07, i * 0.5);
        tone(bus, [2636], 0.5, "sine", 0.015, i * 0.5);
      }
      break;
    case "istirahat":
      tone(bus, [784], 0.5, "sine", 0.06);
      tone(bus, [988], 0.7, "sine", 0.05, 0.3);
      break;
  }
}

// ---------------------------------------------------------------------------
// Radio

interface Station {
  stop(): void;
}

let current: { id: StationId; station: Station } | null = null;
let wanted: StationId | null = null;

export function setRadioVolume(volume: number): void {
  radioVolume = Math.min(1, Math.max(0, volume));
  if (ctx && radioBus) radioBus.gain.setTargetAtTime(radioVolume * 0.8, ctx.currentTime, 0.1);
}

/** Pilih stasiun (null = matikan). */
export function setStation(id: StationId | null): void {
  wanted = id;
  applyRadio();
}

/** Radio dijeda saat jendela disembunyikan. */
export function setRadioPaused(p: boolean): void {
  paused = p;
  applyRadio();
}

export function radioPlaying(): StationId | null {
  return current?.id ?? null;
}

function applyRadio(): void {
  const target = paused ? null : wanted;
  if (current && current.id === target) return;
  if (current) {
    current.station.stop();
    current = null;
  }
  if (!target) return;
  const a = audio();
  if (!a || !radioBus) return;
  const make = target === "lofi" ? lofi : target === "gamelan" ? gamelan : rain;
  current = { id: target, station: make(a, radioBus) };
}

/** Penjadwal umum: memanggil `schedule(t)` untuk tiap ketukan hingga 0,6 detik ke depan. */
function sequencer(a: AudioContext, stepSec: number, schedule: (t: number, step: number) => void): () => void {
  let next = a.currentTime + 0.15;
  let step = 0;
  const timer = window.setInterval(() => {
    // Bila timer tertahan (jendela tersembunyi), jangan menumpuk not yang terlambat.
    if (next < a.currentTime) next = a.currentTime + 0.05;
    while (next < a.currentTime + 0.6) {
      schedule(next, step);
      step++;
      next += stepSec;
    }
  }, 120);
  return () => window.clearInterval(timer);
}

function stationBus(a: AudioContext, out: AudioNode, level: number): { bus: GainNode; stop: (extra?: () => void) => void } {
  const bus = a.createGain();
  bus.gain.setValueAtTime(0, a.currentTime);
  bus.gain.linearRampToValueAtTime(level, a.currentTime + 1.5);
  bus.connect(out);
  return {
    bus,
    stop: (extra) => {
      bus.gain.setTargetAtTime(0, a.currentTime, 0.4);
      window.setTimeout(() => {
        extra?.();
        bus.disconnect();
      }, 2500);
    },
  };
}

const midi = (n: number) => 440 * 2 ** ((n - 69) / 12);

/** Lo-fi: akor Rhodes hangat, bas, drum lembut berayun, dan desis piringan hitam. */
function lofi(a: AudioContext, out: AudioNode): Station {
  const { bus, stop } = stationBus(a, out, 0.9);
  const warm = a.createBiquadFilter();
  warm.type = "lowpass";
  warm.frequency.value = 1800;
  warm.connect(bus);

  // Fmaj7 – Em7 – Dm7 – Cmaj7 dan variasi ii–V–I.
  const progressions = [
    [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]],
    [[50, 53, 57, 60], [55, 59, 62, 65], [48, 52, 55, 59], [57, 60, 64, 67]],
  ];
  let prog = progressions[0];
  const pent = [60, 62, 64, 67, 69, 72, 74, 76];

  const keys = (t: number, notes: number[], dur: number) => {
    for (const n of notes) {
      for (const [mult, g, type] of [
        [1, 0.035, "sine"],
        [2, 0.008, "triangle"],
      ] as const) {
        const o = a.createOscillator();
        o.type = type;
        o.frequency.value = midi(n) * mult;
        o.detune.value = (Math.random() - 0.5) * 8;
        const e = a.createGain();
        e.gain.setValueAtTime(0, t);
        e.gain.linearRampToValueAtTime(g, t + 0.03 + Math.random() * 0.03);
        e.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(e).connect(warm);
        o.start(t);
        o.stop(t + dur + 0.1);
      }
    }
  };
  const bass = (t: number, n: number, dur: number) => {
    const o = a.createOscillator();
    o.type = "sine";
    o.frequency.value = midi(n - 12);
    const e = a.createGain();
    e.gain.setValueAtTime(0, t);
    e.gain.linearRampToValueAtTime(0.09, t + 0.02);
    e.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(e).connect(bus);
    o.start(t);
    o.stop(t + dur + 0.05);
  };
  const kick = (t: number) => {
    const o = a.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(110, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.18);
    const e = a.createGain();
    e.gain.setValueAtTime(0.16, t);
    e.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(e).connect(bus);
    o.start(t);
    o.stop(t + 0.35);
  };

  const sixteenth = 60 / 72 / 4;
  const stopSeq = sequencer(a, sixteenth, (t0, step) => {
    const inBar = step % 16;
    const bar = Math.floor(step / 16);
    // Ayunan: ketukan ganjil sedikit terlambat.
    const t = t0 + (step % 2 === 1 ? sixteenth * 0.18 : 0);
    if (inBar === 0) {
      if (bar % 8 === 0) prog = progressions[Math.floor(Math.random() * progressions.length)];
      const chord = prog[bar % 4];
      keys(t, chord, sixteenth * 15);
      bass(t, chord[0], sixteenth * 7);
    }
    if (inBar === 8) bass(t, prog[bar % 4][0] + (Math.random() < 0.5 ? 7 : 0), sixteenth * 6);
    if (inBar === 0 || inBar === 10 || (inBar === 7 && Math.random() < 0.3)) kick(t);
    if (inBar === 4 || inBar === 12) noiseHit(bus, t, 0.18, "bandpass", 1800, 0.05, 0.7);
    if (inBar % 2 === 0) noiseHit(bus, t, 0.05, "highpass", 7000, inBar % 4 === 2 ? 0.018 : 0.01);
    // Melodi jarang-jarang.
    if (inBar % 4 === 2 && Math.random() < 0.28) {
      const n = pent[Math.floor(Math.random() * pent.length)];
      keys(t, [n + 12], sixteenth * 6);
    }
    // Desis dan letupan piringan hitam.
    if (Math.random() < 0.12) noiseHit(bus, t + Math.random() * sixteenth, 0.01, "highpass", 3000, 0.02);
  });
  const crackle = a.createBufferSource();
  crackle.buffer = noise(a);
  crackle.loop = true;
  const cf = a.createBiquadFilter();
  cf.type = "bandpass";
  cf.frequency.value = 1200;
  cf.Q.value = 0.4;
  const cg = a.createGain();
  cg.gain.value = 0.006;
  crackle.connect(cf).connect(cg).connect(bus);
  crackle.start();
  return {
    stop: () => {
      stopSeq();
      stop(() => {
        try {
          crackle.stop();
        } catch {
          // sudah berhenti
        }
        warm.disconnect();
      });
    },
  };
}

/** Gamelan: saron memainkan balungan, bonang menghias, kenong dan gong menandai irama. */
function gamelan(a: AudioContext, out: AudioNode): Station {
  const { bus, stop } = stationBus(a, out, 0.85);
  // Laras slendro kira-kira: lima nada hampir sama jarak.
  const base = 261.6;
  const ratios = [1, 1.149, 1.32, 1.516, 1.741];
  const pitch = (degree: number, octave = 0) => base * ratios[((degree % 5) + 5) % 5] * 2 ** (Math.floor(degree / 5) + octave);
  const metal = (t: number, f: number, vol: number, decay: number) => {
    // Bunyi logam: parsial tak harmonis dengan sedikit getar.
    for (const [m, g] of [
      [1, 1],
      [2.76, 0.32],
      [5.4, 0.12],
    ] as const) {
      const o = a.createOscillator();
      o.type = "sine";
      o.frequency.value = f * m;
      o.detune.value = (Math.random() - 0.5) * 6;
      const e = a.createGain();
      e.gain.setValueAtTime(0, t);
      e.gain.linearRampToValueAtTime(vol * g, t + 0.004);
      e.gain.exponentialRampToValueAtTime(0.0001, t + decay / m);
      o.connect(e).connect(bus);
      o.start(t);
      o.stop(t + decay + 0.1);
    }
  };
  const gong = (t: number, f: number, vol: number, decay: number) => {
    for (const d of [-3, 3]) {
      const o = a.createOscillator();
      o.type = "sine";
      o.frequency.value = f;
      o.detune.value = d;
      const e = a.createGain();
      e.gain.setValueAtTime(0, t);
      e.gain.linearRampToValueAtTime(vol, t + 0.05);
      e.gain.exponentialRampToValueAtTime(0.0001, t + decay);
      o.connect(e).connect(bus);
      o.start(t);
      o.stop(t + decay + 0.1);
    }
  };

  let melody: number[] = [];
  const newPhrase = () => {
    // Balungan 8 ketukan: jalan acak, berakhir di nada dasar.
    const out: number[] = [];
    let d = 2;
    for (let i = 0; i < 7; i++) {
      d = Math.min(7, Math.max(0, d + [-2, -1, 1, 2, 0][Math.floor(Math.random() * 5)]));
      out.push(d);
    }
    out.push(Math.random() < 0.5 ? 0 : 5);
    return out;
  };
  const beat = 60 / 58;
  const stopSeq = sequencer(a, beat / 2, (t, step) => {
    const half = step % 2;
    const b = Math.floor(step / 2);
    if (b % 8 === 0 && half === 0) melody = newPhrase();
    const note = melody[b % 8] ?? 0;
    if (half === 0) metal(t, pitch(note), 0.07, 2.2);
    // Bonang: menghias di antara ketukan, satu oktaf di atas.
    if (Math.random() < 0.7) metal(t, pitch(half === 0 ? note : note + (Math.random() < 0.5 ? 1 : -1), 1), 0.025, 1.1);
    if (half === 0 && b % 4 === 3) metal(t, pitch(note, -1), 0.06, 3.2);
    if (half === 0 && b % 16 === 15) gong(t, 65, 0.16, 7);
  });
  return { stop: () => (stopSeq(), stop()) };
}

/** Hujan: derau berlapis, tetesan, dan guntur di kejauhan. */
function rain(a: AudioContext, out: AudioNode): Station {
  const { bus, stop } = stationBus(a, out, 1);
  const nodes: AudioNode[] = [];
  const layer = (type: BiquadFilterType, freq: number, gain: number) => {
    const src = a.createBufferSource();
    src.buffer = noise(a);
    src.loop = true;
    src.playbackRate.value = 0.9 + Math.random() * 0.2;
    const f = a.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = a.createGain();
    g.gain.value = gain;
    src.connect(f).connect(g).connect(bus);
    src.start(0, Math.random());
    nodes.push(src, f, g);
    return g;
  };
  layer("lowpass", 900, 0.12);
  const hiss = layer("bandpass", 3500, 0.05);
  let nextThunder = a.currentTime + 20 + Math.random() * 40;
  const stopSeq = sequencer(a, 0.1, (t) => {
    if (Math.random() < 0.18) {
      const f = 1800 + Math.random() * 2500;
      tone(bus, [f, f * 0.7], 0.06, "sine", 0.012 + Math.random() * 0.01, t - a.currentTime);
    }
    // Hujan bergelombang pelan.
    hiss.gain.setTargetAtTime(0.035 + Math.random() * 0.03, t, 2);
    if (t > nextThunder) {
      nextThunder = t + 45 + Math.random() * 60;
      noiseHit(bus, t, 4, "lowpass", 140, 0.35);
      noiseHit(bus, t + 0.1, 1.2, "lowpass", 500, 0.08);
    }
  });
  return {
    stop: () => {
      stopSeq();
      stop(() => {
        for (const n of nodes) {
          if (n instanceof AudioBufferSourceNode) {
            try {
              n.stop();
            } catch {
              // sudah berhenti
            }
          }
          n.disconnect();
        }
      });
    },
  };
}
