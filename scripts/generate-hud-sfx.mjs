#!/usr/bin/env node

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SAMPLE_RATE = 44_100;

function createBuffer(seconds) {
  return new Float32Array(Math.max(1, Math.floor(seconds * SAMPLE_RATE)));
}

function oscValue(type, phase) {
  const wrapped = ((phase / (Math.PI * 2)) % 1 + 1) % 1;
  if (type === "triangle") {
    return 1 - 4 * Math.abs(wrapped - 0.5);
  }
  if (type === "square") {
    return wrapped < 0.5 ? 1 : -1;
  }
  if (type === "sawtooth") {
    return 2 * wrapped - 1;
  }
  return Math.sin(phase);
}

function envelope(progress, attack, release) {
  if (progress <= 0 || progress >= 1) {
    return 0;
  }

  const attackPortion = Math.max(0.0001, attack);
  const releasePortion = Math.max(0.0001, release);

  if (progress < attackPortion) {
    return progress / attackPortion;
  }

  if (progress > 1 - releasePortion) {
    return (1 - progress) / releasePortion;
  }

  return 1;
}

function addTone(
  buffer,
  {
    start = 0,
    duration = 0.08,
    freqStart = 500,
    freqEnd = freqStart,
    gain = 0.2,
    type = "sine",
    attack = 0.05,
    release = 0.25,
    vibratoDepth = 0,
    vibratoRate = 0,
  },
) {
  const startIndex = Math.max(0, Math.floor(start * SAMPLE_RATE));
  const samples = Math.max(1, Math.floor(duration * SAMPLE_RATE));
  const endIndex = Math.min(buffer.length, startIndex + samples);
  let phase = 0;

  for (let i = startIndex; i < endIndex; i += 1) {
    const localIndex = i - startIndex;
    const progress = localIndex / Math.max(1, samples - 1);
    const freq = freqStart + (freqEnd - freqStart) * progress;
    const vib =
      vibratoDepth && vibratoRate
        ? Math.sin((2 * Math.PI * vibratoRate * localIndex) / SAMPLE_RATE) *
          vibratoDepth
        : 0;
    phase += (2 * Math.PI * (freq + vib)) / SAMPLE_RATE;

    const env = envelope(progress, attack, release);
    buffer[i] += oscValue(type, phase) * gain * env;
  }
}

function addNoise(
  buffer,
  {
    start = 0,
    duration = 0.08,
    gain = 0.06,
    attack = 0.02,
    release = 0.3,
    color = "white",
  },
) {
  const startIndex = Math.max(0, Math.floor(start * SAMPLE_RATE));
  const samples = Math.max(1, Math.floor(duration * SAMPLE_RATE));
  const endIndex = Math.min(buffer.length, startIndex + samples);
  let last = 0;

  for (let i = startIndex; i < endIndex; i += 1) {
    const localIndex = i - startIndex;
    const progress = localIndex / Math.max(1, samples - 1);
    const env = envelope(progress, attack, release);

    const white = Math.random() * 2 - 1;
    let sample = white;
    if (color === "pink") {
      sample = white * 0.55 + last * 0.45;
      last = sample;
    } else if (color === "blue") {
      sample = white - last * 0.85;
      last = white;
    }

    buffer[i] += sample * gain * env;
  }
}

function addEcho(buffer, { delay = 0.11, decay = 0.28, repeats = 2 } = {}) {
  const delaySamples = Math.max(1, Math.floor(delay * SAMPLE_RATE));
  for (let repeat = 1; repeat <= repeats; repeat += 1) {
    const scale = decay ** repeat;
    for (let i = 0; i < buffer.length - delaySamples * repeat; i += 1) {
      buffer[i + delaySamples * repeat] += buffer[i] * scale;
    }
  }
}

function finalize(buffer) {
  let peak = 0;
  for (let i = 0; i < buffer.length; i += 1) {
    const clipped = buffer[i] / (1 + Math.abs(buffer[i]));
    buffer[i] = clipped;
    peak = Math.max(peak, Math.abs(clipped));
  }

  const target = 0.82;
  const scale = peak > 0.0001 ? target / peak : 1;
  for (let i = 0; i < buffer.length; i += 1) {
    buffer[i] *= scale;
  }

  return buffer;
}

function floatTo16BitPCM(floatBuffer) {
  const output = Buffer.alloc(floatBuffer.length * 2);
  for (let i = 0; i < floatBuffer.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, floatBuffer[i]));
    const int = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    output.writeInt16LE(Math.round(int), i * 2);
  }
  return output;
}

function writeWav(filePath, samples) {
  const pcm = floatTo16BitPCM(samples);
  const header = Buffer.alloc(44);
  const byteRate = SAMPLE_RATE * 2;

  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);

  writeFileSync(filePath, Buffer.concat([header, pcm]));
}

function renderTap() {
  const b = createBuffer(0.18);
  addTone(b, {
    start: 0.0,
    duration: 0.045,
    freqStart: 1400,
    freqEnd: 900,
    gain: 0.28,
    type: "triangle",
    attack: 0.03,
    release: 0.4,
  });
  addNoise(b, {
    start: 0.0,
    duration: 0.03,
    gain: 0.07,
    color: "blue",
    attack: 0.01,
    release: 0.4,
  });
  return finalize(b);
}

function renderSend() {
  const b = createBuffer(0.36);
  addTone(b, {
    start: 0.0,
    duration: 0.08,
    freqStart: 360,
    freqEnd: 660,
    gain: 0.22,
    type: "triangle",
    attack: 0.04,
    release: 0.35,
  });
  addTone(b, {
    start: 0.06,
    duration: 0.11,
    freqStart: 700,
    freqEnd: 1160,
    gain: 0.22,
    type: "sine",
    attack: 0.04,
    release: 0.28,
    vibratoDepth: 4,
    vibratoRate: 9,
  });
  addNoise(b, { start: 0, duration: 0.06, gain: 0.03, color: "blue" });
  addEcho(b, { delay: 0.1, decay: 0.24, repeats: 2 });
  return finalize(b);
}

function renderReceive() {
  const b = createBuffer(0.42);
  addTone(b, {
    start: 0.01,
    duration: 0.1,
    freqStart: 480,
    freqEnd: 780,
    gain: 0.18,
    type: "triangle",
    attack: 0.05,
    release: 0.3,
  });
  addTone(b, {
    start: 0.095,
    duration: 0.16,
    freqStart: 820,
    freqEnd: 520,
    gain: 0.2,
    type: "sine",
    attack: 0.04,
    release: 0.35,
    vibratoDepth: 6,
    vibratoRate: 7,
  });
  addEcho(b, { delay: 0.12, decay: 0.22, repeats: 2 });
  return finalize(b);
}

function renderSuccess() {
  const b = createBuffer(0.5);
  addTone(b, {
    start: 0.01,
    duration: 0.1,
    freqStart: 440,
    freqEnd: 440,
    gain: 0.16,
    type: "triangle",
    attack: 0.06,
    release: 0.3,
  });
  addTone(b, {
    start: 0.08,
    duration: 0.11,
    freqStart: 554,
    freqEnd: 554,
    gain: 0.16,
    type: "triangle",
    attack: 0.06,
    release: 0.3,
  });
  addTone(b, {
    start: 0.16,
    duration: 0.16,
    freqStart: 740,
    freqEnd: 780,
    gain: 0.2,
    type: "sine",
    attack: 0.05,
    release: 0.35,
  });
  addEcho(b, { delay: 0.11, decay: 0.28, repeats: 2 });
  return finalize(b);
}

function renderError() {
  const b = createBuffer(0.52);
  addTone(b, {
    start: 0.0,
    duration: 0.13,
    freqStart: 280,
    freqEnd: 210,
    gain: 0.22,
    type: "sawtooth",
    attack: 0.05,
    release: 0.35,
  });
  addTone(b, {
    start: 0.11,
    duration: 0.17,
    freqStart: 220,
    freqEnd: 150,
    gain: 0.2,
    type: "square",
    attack: 0.04,
    release: 0.4,
  });
  addNoise(b, { start: 0.04, duration: 0.2, gain: 0.03, color: "pink" });
  addEcho(b, { delay: 0.09, decay: 0.2, repeats: 2 });
  return finalize(b);
}

function renderTaskDone() {
  const b = createBuffer(0.52);
  addTone(b, {
    start: 0.0,
    duration: 0.07,
    freqStart: 470,
    freqEnd: 580,
    gain: 0.15,
    type: "triangle",
    attack: 0.05,
    release: 0.3,
  });
  addTone(b, {
    start: 0.06,
    duration: 0.08,
    freqStart: 650,
    freqEnd: 760,
    gain: 0.15,
    type: "triangle",
    attack: 0.05,
    release: 0.3,
  });
  addTone(b, {
    start: 0.12,
    duration: 0.16,
    freqStart: 820,
    freqEnd: 1120,
    gain: 0.2,
    type: "sine",
    attack: 0.06,
    release: 0.35,
    vibratoDepth: 5,
    vibratoRate: 8,
  });
  addEcho(b, { delay: 0.12, decay: 0.25, repeats: 2 });
  return finalize(b);
}

function renderTaskUndo() {
  const b = createBuffer(0.44);
  addTone(b, {
    start: 0.0,
    duration: 0.1,
    freqStart: 760,
    freqEnd: 560,
    gain: 0.16,
    type: "triangle",
    attack: 0.04,
    release: 0.35,
  });
  addTone(b, {
    start: 0.085,
    duration: 0.13,
    freqStart: 520,
    freqEnd: 330,
    gain: 0.16,
    type: "sine",
    attack: 0.04,
    release: 0.35,
  });
  addEcho(b, { delay: 0.1, decay: 0.22, repeats: 2 });
  return finalize(b);
}

function renderVoiceStart() {
  const b = createBuffer(0.46);
  addTone(b, {
    start: 0.0,
    duration: 0.09,
    freqStart: 250,
    freqEnd: 480,
    gain: 0.17,
    type: "triangle",
    attack: 0.04,
    release: 0.32,
  });
  addTone(b, {
    start: 0.07,
    duration: 0.14,
    freqStart: 680,
    freqEnd: 980,
    gain: 0.19,
    type: "sine",
    attack: 0.04,
    release: 0.35,
    vibratoDepth: 6,
    vibratoRate: 10,
  });
  addNoise(b, { start: 0.0, duration: 0.08, gain: 0.025, color: "blue" });
  addEcho(b, { delay: 0.12, decay: 0.25, repeats: 2 });
  return finalize(b);
}

function renderVoiceStop() {
  const b = createBuffer(0.44);
  addTone(b, {
    start: 0.0,
    duration: 0.09,
    freqStart: 980,
    freqEnd: 700,
    gain: 0.17,
    type: "triangle",
    attack: 0.04,
    release: 0.32,
  });
  addTone(b, {
    start: 0.07,
    duration: 0.13,
    freqStart: 580,
    freqEnd: 240,
    gain: 0.17,
    type: "sine",
    attack: 0.04,
    release: 0.35,
  });
  addEcho(b, { delay: 0.11, decay: 0.23, repeats: 2 });
  return finalize(b);
}

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT_DIR = resolve(ROOT_DIR, "public/sfx");

mkdirSync(OUTPUT_DIR, { recursive: true });

const rendered = {
  "tap.wav": renderTap(),
  "send.wav": renderSend(),
  "receive.wav": renderReceive(),
  "success.wav": renderSuccess(),
  "error.wav": renderError(),
  "task-done.wav": renderTaskDone(),
  "task-undo.wav": renderTaskUndo(),
  "voice-start.wav": renderVoiceStart(),
  "voice-stop.wav": renderVoiceStop(),
};

for (const [fileName, samples] of Object.entries(rendered)) {
  writeWav(resolve(OUTPUT_DIR, fileName), samples);
}

console.log(`Generated ${Object.keys(rendered).length} HUD sound files in public/sfx`);

