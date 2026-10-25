import { useEffect, useRef, useState } from "react";

/**
 * RMS level (0..1) of an 8-bit time-domain buffer from
 * `AnalyserNode.getByteTimeDomainData` (128 = silence).
 */
export const levelFromTimeDomain = (samples: ArrayLike<number>): number => {
  if (samples.length === 0) {
    return 0;
  }

  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    const v = ((samples[i] as number) - 128) / 128;
    sum += v * v;
  }

  return Math.min(1, Math.sqrt(sum / samples.length));
};

/**
 * Maps an RMS level to a meter position (0..1). Speech sits around
 * 0.02..0.3 RMS, so a perceptual (dB) scale reads much better than linear.
 */
export const meterPosition = (level: number): number => {
  if (level <= 0) {
    return 0;
  }

  const db = 20 * Math.log10(level);
  // -60 dB → 0, 0 dB → 1
  return Math.max(0, Math.min(1, (db + 60) / 60));
};

type Listener = (level: number) => void;

/**
 * Calls `onLevel` ~20×/s with the RMS level of the stream's audio. Uses the
 * timers of the window that owns `elementRef` (so a meter rendered in the
 * Picture-in-Picture window keeps updating when the main tab is hidden).
 */
export const useAudioLevelListener = (
  stream: MediaStream | null,
  onLevel: Listener,
  ownerRef?: React.RefObject<Element | null>,
) => {
  const listenerRef = useRef(onLevel);
  useEffect(() => {
    listenerRef.current = onLevel;
  });

  useEffect(() => {
    if (!stream || stream.getAudioTracks().length === 0) {
      listenerRef.current(0);
      return;
    }

    let context: AudioContext;
    try {
      context = new AudioContext();
    } catch {
      return;
    }

    const source = context.createMediaStreamSource(stream);
    const analyser = context.createAnalyser();
    analyser.fftSize = 1024;
    source.connect(analyser);
    const buffer = new Uint8Array(analyser.fftSize);

    const win = ownerRef?.current?.ownerDocument.defaultView ?? window;
    const interval = win.setInterval(() => {
      if (context.state === "suspended") {
        context.resume().catch(() => undefined);
      }

      analyser.getByteTimeDomainData(buffer);
      listenerRef.current(levelFromTimeDomain(buffer));
    }, 50);

    return () => {
      win.clearInterval(interval);
      source.disconnect();
      context.close().catch(() => undefined);
    };
  }, [ownerRef, stream]);
};

/** Smoothed level (0..1, RMS) of a stream; re-renders ~20×/s. */
export const useAudioLevel = (
  stream: MediaStream | null,
  ownerRef?: React.RefObject<Element | null>,
): number => {
  const [level, setLevel] = useState(0);
  useAudioLevelListener(
    stream,
    (next) => setLevel((old) => (next > old ? next : old * 0.85 + next * 0.15)),
    ownerRef,
  );
  return level;
};

/**
 * Highest level over the last `windowMs`; null until the stream exists.
 * Only re-renders when the "heard" state could change (rounded to 2 digits).
 */
export const useRecentPeak = (
  stream: MediaStream | null,
  windowMs = 4000,
): number | null => {
  const samples = useRef<{ t: number; v: number }[]>([]);
  const [peak, setPeak] = useState<number | null>(null);

  useEffect(() => {
    samples.current = [];
    setPeak(null);
  }, [stream]);

  useAudioLevelListener(stream, (level) => {
    if (!stream) {
      return;
    }

    const now = Date.now();
    samples.current.push({ t: now, v: level });
    while (samples.current.length && samples.current[0]!.t < now - windowMs) {
      samples.current.shift();
    }

    // Wait for ~0.5 s of audio before judging
    const first = samples.current[0];
    if (!first || now - first.t < 500) {
      return;
    }

    const max = samples.current.reduce((a, s) => Math.max(a, s.v), 0);
    const rounded = Math.round(max * 100) / 100;
    setPeak((old) => (old === rounded ? old : rounded));
  });

  return stream ? peak : null;
};
