// Runs the ffmpeg / ffprobe binaries that ship with Remotion
// (`bun x remotion ffmpeg`). Arguments are always passed as an array,
// so paths containing spaces work.
import { spawn } from "child_process";

const bunBinary = () => {
  // When the server runs under Bun, reuse the same executable.
  return process.versions.bun ? process.execPath : "bun";
};

export const runRemotionBinary = ({
  tool,
  args,
  signal,
  onStderr,
}: {
  tool: "ffmpeg" | "ffprobe";
  args: string[];
  signal?: AbortSignal;
  onStderr?: (chunk: string) => void;
}): Promise<{ stdout: string; stderr: string }> => {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(makeAbortError());
      return;
    }
    const child = spawn(bunBinary(), ["x", "remotion", tool, ...args], {
      stdio: ["ignore", "pipe", "pipe"],
      signal,
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf-8");
    child.stderr.setEncoding("utf-8");
    child.stdout.on("data", (d: string) => {
      stdout += d;
    });
    child.stderr.on("data", (d: string) => {
      stderr += d;
      onStderr?.(d);
    });
    child.on("error", (err) => {
      reject(signal?.aborted ? makeAbortError() : err);
    });
    child.on("close", (code, sig) => {
      if (signal?.aborted) {
        reject(makeAbortError());
        return;
      }
      if (code !== 0) {
        reject(
          new Error(
            `${tool} exited with code ${code} (signal ${sig}): ${stderr.slice(-2000)}`,
          ),
        );
        return;
      }
      resolve({ stdout, stderr });
    });
  });
};

export const makeAbortError = () => {
  const err = new Error("The operation was aborted");
  err.name = "AbortError";
  return err;
};

export const isAbortError = (e: unknown) => {
  return (
    e instanceof Error &&
    (e.name === "AbortError" ||
      e.message.includes("SIGTERM") ||
      e.message.toLowerCase().includes("cancelled") ||
      e.message.toLowerCase().includes("aborted"))
  );
};

// Extract a 16 kHz mono WAV file (what whisper.cpp expects).
export const extractAudio = async ({
  input,
  output,
  signal,
}: {
  input: string;
  output: string;
  signal?: AbortSignal;
}) => {
  await runRemotionBinary({
    tool: "ffmpeg",
    args: [
      "-hide_banner",
      "-nostdin",
      "-i",
      input,
      "-vn",
      "-ac",
      "1",
      "-ar",
      "16000",
      "-c:a",
      "pcm_s16le",
      "-y",
      output,
    ],
    signal,
  });
};

export const probeMedia = async (
  file: string,
  signal?: AbortSignal,
): Promise<{ hasAudio: boolean; durationMs: number | null }> => {
  const { stdout } = await runRemotionBinary({
    tool: "ffprobe",
    args: [
      "-v",
      "error",
      "-show_entries",
      "format=duration:stream=codec_type,duration",
      "-of",
      "json",
      file,
    ],
    signal,
  });
  const json = JSON.parse(stdout) as {
    streams?: { codec_type?: string; duration?: string }[];
    format?: { duration?: string };
  };
  const streams = json.streams ?? [];
  const hasAudio = streams.some((s) => s.codec_type === "audio");
  const candidates = [json.format?.duration, ...streams.map((s) => s.duration)]
    .map((d) => Number(d))
    .filter((d) => Number.isFinite(d) && d > 0);
  const durationMs =
    candidates.length > 0 ? Math.round((candidates[0] as number) * 1000) : null;
  return { hasAudio, durationMs };
};

// Parses the last `time=HH:MM:SS.xx` from ffmpeg's progress output.
export const parseLastFfmpegTimeMs = (stderr: string): number | null => {
  const matches = [...stderr.matchAll(/time=(\d+):(\d{2}):(\d{2}(?:\.\d+)?)/g)];
  const last = matches[matches.length - 1];
  if (!last) {
    return null;
  }
  const [, h, m, s] = last;
  return Math.round((Number(h) * 3600 + Number(m) * 60 + Number(s)) * 1000);
};

// MediaRecorder WebM files often have no duration in their header.
// Decoding the file is slower but always gives the real duration.
export const decodeDurationMs = async (
  file: string,
  signal?: AbortSignal,
): Promise<number | null> => {
  const { stderr } = await runRemotionBinary({
    tool: "ffmpeg",
    args: ["-hide_banner", "-nostdin", "-i", file, "-f", "null", "-"],
    signal,
  });
  return parseLastFfmpegTimeMs(stderr);
};

// silencedetect with `noise` in dBFS and the minimum silence `durationMs`.
export const detectSilence = async ({
  input,
  noiseDb,
  minDurationMs,
  signal,
}: {
  input: string;
  noiseDb: number;
  minDurationMs: number;
  signal?: AbortSignal;
}): Promise<string> => {
  const { stderr } = await runRemotionBinary({
    tool: "ffmpeg",
    args: [
      "-hide_banner",
      "-nostdin",
      "-i",
      input,
      "-af",
      `silencedetect=noise=${noiseDb}dB:d=${minDurationMs / 1000}`,
      "-f",
      "null",
      "-",
    ],
    signal,
  });
  return stderr;
};
