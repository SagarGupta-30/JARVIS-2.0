"use client";

import { useCallback, useRef } from "react";

type HudSfxType =
  | "tap"
  | "send"
  | "receive"
  | "success"
  | "error"
  | "task_done"
  | "task_undo"
  | "voice_start"
  | "voice_stop";

type Tone = {
  frequency: number;
  duration: number;
  gain: number;
  type?: OscillatorType;
  offset?: number;
};

const PATTERNS: Record<HudSfxType, Tone[]> = {
  tap: [{ frequency: 620, duration: 0.045, gain: 0.04, type: "triangle" }],
  send: [
    { frequency: 420, duration: 0.05, gain: 0.05, type: "triangle" },
    { frequency: 780, duration: 0.08, gain: 0.06, offset: 0.045, type: "sine" },
  ],
  receive: [
    { frequency: 520, duration: 0.06, gain: 0.05, type: "triangle" },
    { frequency: 880, duration: 0.1, gain: 0.06, offset: 0.055, type: "sine" },
  ],
  success: [
    { frequency: 540, duration: 0.06, gain: 0.045, type: "triangle" },
    { frequency: 810, duration: 0.09, gain: 0.055, offset: 0.05, type: "sine" },
  ],
  error: [
    { frequency: 360, duration: 0.07, gain: 0.06, type: "square" },
    { frequency: 240, duration: 0.12, gain: 0.06, offset: 0.06, type: "sawtooth" },
  ],
  task_done: [
    { frequency: 460, duration: 0.05, gain: 0.05, type: "triangle" },
    { frequency: 690, duration: 0.05, gain: 0.05, offset: 0.045, type: "triangle" },
    { frequency: 980, duration: 0.08, gain: 0.055, offset: 0.09, type: "sine" },
  ],
  task_undo: [
    { frequency: 600, duration: 0.05, gain: 0.045, type: "triangle" },
    { frequency: 420, duration: 0.08, gain: 0.045, offset: 0.045, type: "sine" },
  ],
  voice_start: [
    { frequency: 300, duration: 0.05, gain: 0.05, type: "triangle" },
    { frequency: 900, duration: 0.06, gain: 0.05, offset: 0.04, type: "triangle" },
  ],
  voice_stop: [
    { frequency: 840, duration: 0.05, gain: 0.045, type: "triangle" },
    { frequency: 360, duration: 0.07, gain: 0.04, offset: 0.04, type: "triangle" },
  ],
};

const ASSET_URLS: Record<HudSfxType, string> = {
  tap: "/sfx/tap.wav",
  send: "/sfx/send.wav",
  receive: "/sfx/receive.wav",
  success: "/sfx/success.wav",
  error: "/sfx/error.wav",
  task_done: "/sfx/task-done.wav",
  task_undo: "/sfx/task-undo.wav",
  voice_start: "/sfx/voice-start.wav",
  voice_stop: "/sfx/voice-stop.wav",
};

function createContext() {
  if (typeof window === "undefined") {
    return null;
  }

  const ContextCtor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!ContextCtor) {
    return null;
  }

  return new ContextCtor();
}

function playTone(
  context: AudioContext,
  baseTime: number,
  tone: Tone,
) {
  const start = baseTime + (tone.offset ?? 0);
  const end = start + tone.duration;

  const oscillator = context.createOscillator();
  const filter = context.createBiquadFilter();
  const gainNode = context.createGain();

  oscillator.type = tone.type ?? "triangle";
  oscillator.frequency.setValueAtTime(tone.frequency, start);

  filter.type = "bandpass";
  filter.frequency.setValueAtTime(Math.max(180, tone.frequency), start);
  filter.Q.setValueAtTime(6, start);

  gainNode.gain.setValueAtTime(0.0001, start);
  gainNode.gain.exponentialRampToValueAtTime(Math.max(0.0002, tone.gain), start + 0.008);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, end);

  oscillator.connect(filter);
  filter.connect(gainNode);
  gainNode.connect(context.destination);

  oscillator.start(start);
  oscillator.stop(end + 0.03);
  oscillator.onended = () => {
    oscillator.disconnect();
    filter.disconnect();
    gainNode.disconnect();
  };
}

export function useHudSfx(enabled: boolean) {
  const contextRef = useRef<AudioContext | null>(null);
  const bufferCacheRef = useRef<Partial<Record<HudSfxType, AudioBuffer>>>({});
  const preloadPromiseRef = useRef<Promise<void> | null>(null);

  const getContext = useCallback(() => {
    if (!enabled) {
      return null;
    }

    if (!contextRef.current) {
      contextRef.current = createContext();
    }

    return contextRef.current;
  }, [enabled]);

  const prime = useCallback(async () => {
    const context = getContext();
    if (!context) {
      return;
    }

    if (context.state === "suspended") {
      try {
        await context.resume();
      } catch {
        // Ignore resume failures when user gesture requirements are not met.
      }
    }

    if (!preloadPromiseRef.current) {
      preloadPromiseRef.current = (async () => {
        const entries = Object.entries(ASSET_URLS) as Array<[HudSfxType, string]>;
        await Promise.all(
          entries.map(async ([type, path]) => {
            if (bufferCacheRef.current[type]) {
              return;
            }

            try {
              const response = await fetch(path, { cache: "force-cache" });
              if (!response.ok) {
                return;
              }

              const bytes = await response.arrayBuffer();
              const decoded = await context.decodeAudioData(bytes.slice(0));
              bufferCacheRef.current[type] = decoded;
            } catch {
              // Ignore preload failures and keep synth fallback available.
            }
          }),
        );
      })();
    }

    await preloadPromiseRef.current;
  }, [getContext]);

  const play = useCallback(
    (type: HudSfxType) => {
      const context = getContext();
      if (!context) {
        return;
      }

      if (context.state === "suspended") {
        void context.resume().catch(() => {});
      }

      const playSynthFallback = () => {
        const tones = PATTERNS[type];
        const now = context.currentTime + 0.001;
        tones.forEach((tone) => playTone(context, now, tone));
      };

      const playFromBuffer = (buffer: AudioBuffer) => {
        const source = context.createBufferSource();
        const filter = context.createBiquadFilter();
        const compressor = context.createDynamicsCompressor();
        const gainNode = context.createGain();

        source.buffer = buffer;
        source.playbackRate.setValueAtTime(
          0.985 + Math.random() * 0.03,
          context.currentTime,
        );

        filter.type = "lowpass";
        filter.frequency.setValueAtTime(7600, context.currentTime);
        filter.Q.setValueAtTime(0.7, context.currentTime);

        compressor.threshold.setValueAtTime(-28, context.currentTime);
        compressor.knee.setValueAtTime(22, context.currentTime);
        compressor.ratio.setValueAtTime(8, context.currentTime);
        compressor.attack.setValueAtTime(0.003, context.currentTime);
        compressor.release.setValueAtTime(0.12, context.currentTime);

        gainNode.gain.setValueAtTime(0.75, context.currentTime);

        source.connect(filter);
        filter.connect(compressor);
        compressor.connect(gainNode);
        gainNode.connect(context.destination);

        source.start(context.currentTime + 0.001);
        source.onended = () => {
          source.disconnect();
          filter.disconnect();
          compressor.disconnect();
          gainNode.disconnect();
        };
      };

      const cached = bufferCacheRef.current[type];
      if (cached) {
        playFromBuffer(cached);
        return;
      }

      playSynthFallback();
      void (async () => {
        const path = ASSET_URLS[type];
        try {
          const response = await fetch(path, { cache: "force-cache" });
          if (!response.ok) {
            return;
          }

          const bytes = await response.arrayBuffer();
          const decoded = await context.decodeAudioData(bytes.slice(0));
          bufferCacheRef.current[type] = decoded;
        } catch {
          // Keep running on synth fallback only.
        }
      })();
    },
    [getContext],
  );

  return { play, prime };
}
