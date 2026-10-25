// Renders the "lesson" composition with the Node APIs and publishes
// <lesson>/published/{lesson.mp4, lesson.srt, lesson.vtt, thumbnail.jpg,
// chapters.json, transcript.md}.
import { BundlerInternals, bundle } from "@remotion/bundler";
import type { EmittedArtifact } from "@remotion/renderer";
import {
  makeCancelSignal,
  renderMedia,
  renderStill,
  selectComposition,
} from "@remotion/renderer";
import fs from "fs";
import net from "net";
import { tmpdir } from "os";
import path from "path";
import { publishedPath } from "../../../config/course";
import { PUBLIC_DIR, readLesson, resolvePublicPath } from "../course-store";
import type { JobContext } from "../production/job-queue";
import {
  getTakeFiles,
  readCaptions,
  readEditPlan,
} from "../production/take-files";
import { buildTranscriptMarkdown, srtToVtt } from "./subtitles";

export const LESSON_COMPOSITION_ID = "lesson";
export const SRT_ARTIFACT = "captions.srt";
export const CHAPTERS_ARTIFACT = "chapters.json";

const ROOT_DIR = process.cwd();

// remotion.config.ts is only read by the CLI/Studio, so its settings are
// mirrored here for the Node APIs:
//   Config.setRspack(true)               → bundle({ rspack: true })
//   Config.setVideoImageFormat("jpeg")   → renderMedia({ imageFormat: "jpeg" })
//   Config.setOverwriteOutput(true)      → renderMedia({ overwrite: true })
//   Config.setAskAIEnabled(false) / setInteractivityEnabled(false)
//                                        → bundle({ askAIEnabled, interactivityEnabled })
const IMAGE_FORMAT = "jpeg" as const;

type CachedBundle = { serveUrl: string; indexTemplate: string };
let bundlePromise: Promise<CachedBundle> | null = null;

const STATIC_FILES_MARKER = "remotion_staticFiles = [].map(";

// The bundle's index.html embeds the list of public files that
// getStaticFiles() returns. Since public/ is linked rather than copied, the
// list is regenerated from the live folder before every render.
const refreshStaticFiles = ({ serveUrl, indexTemplate }: CachedBundle) => {
  if (!indexTemplate.includes(STATIC_FILES_MARKER)) {
    console.warn("Could not refresh getStaticFiles() list in the bundle");
    return;
  }
  const files = BundlerInternals.readRecursively({
    folder: ".",
    startPath: PUBLIC_DIR,
    staticHash: "./public",
    limit: 10000,
  }).map((f) => ({ ...f, name: f.name.split(path.sep).join("/") }));
  // Escape "<" (as a JSON unicode escape) so a file name cannot close the <script>.
  const json = JSON.stringify(files)
    .split("<")
    .join(`${String.fromCharCode(92)}u003c`);
  fs.writeFileSync(
    path.join(serveUrl, "index.html"),
    indexTemplate.replace(
      STATIC_FILES_MARKER,
      `remotion_staticFiles = ${json}.map(`,
    ),
  );
};

// The bundle is built once per server run. Instead of letting the bundler copy
// public/ (which holds every recording and would be stale for recordings made
// after bundling), it is bundled with an empty public dir and <bundle>/public
// is then replaced by a junction/symlink to the live public/ folder.
export const getBundle = async (
  onProgress?: (progress: number) => void,
): Promise<string> => {
  if (!bundlePromise) {
    bundlePromise = (async () => {
      const emptyPublic = fs.mkdtempSync(
        path.join(tmpdir(), "course-studio-public-"),
      );
      const serveUrl = await bundle({
        entryPoint: path.join(ROOT_DIR, "remotion", "index.ts"),
        rootDir: ROOT_DIR,
        publicDir: emptyPublic,
        rspack: true,
        enableCaching: true,
        askAIEnabled: false,
        interactivityEnabled: false,
        onProgress: (p) => onProgress?.(p / 100),
      });
      const bundledPublic = path.join(serveUrl, "public");
      fs.rmSync(bundledPublic, { recursive: true, force: true });
      fs.symlinkSync(
        PUBLIC_DIR,
        bundledPublic,
        process.platform === "win32" ? "junction" : "dir",
      );
      fs.rmSync(emptyPublic, { recursive: true, force: true });
      const indexTemplate = fs.readFileSync(
        path.join(serveUrl, "index.html"),
        "utf-8",
      );
      return { serveUrl, indexTemplate };
    })();
    // Retry on the next render if bundling failed.
    bundlePromise.catch(() => {
      bundlePromise = null;
    });
  }
  const cached = await bundlePromise;
  refreshStaticFiles(cached);
  return cached.serveUrl;
};

// Remotion's renderer serves the bundle on port 3000+ by default, binding
// IPv4 only. If Remotion Studio (or anything else) listens on [::]:3000,
// Chrome resolves "localhost" to that foreign server and rendering fails with
// "window.getStaticCompositions is undefined". Picking a port that is free on
// the dual-stack wildcard address avoids that.
export const getFreePort = (): Promise<number> => {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen({ port: 0, host: "::" }, () => {
      const address = server.address();
      server.close(() => {
        if (address && typeof address === "object") {
          resolve(address.port);
        } else {
          reject(new Error("Could not find a free port"));
        }
      });
    });
  });
};

const PROGRESS = {
  bundle: [0, 0.1],
  render: [0.1, 0.9],
  still: [0.9, 0.95],
  publish: [0.95, 1],
} as const;

const within = (range: readonly [number, number], p: number) =>
  range[0] + (range[1] - range[0]) * p;

// Thumbnail frame: with an intro the title card (≈1 s in) shows the lesson
// title, which makes a good thumbnail; without one, 2 s into the first segment.
export const getThumbnailFrame = ({
  fps,
  durationInFrames,
  hasIntro,
}: {
  fps: number;
  durationInFrames: number;
  hasIntro: boolean;
}) => {
  const frame = Math.round(fps * (hasIntro ? 1 : 2));
  return Math.max(0, Math.min(durationInFrames - 1, frame));
};

const artifactContent = (artifact: EmittedArtifact) => {
  return typeof artifact.content === "string"
    ? artifact.content
    : Buffer.from(artifact.content);
};

// Replaces `published/` with `staging/` without ever leaving a half-written
// published folder behind.
const publishAtomically = (staging: string, published: string, id: string) => {
  const old = `${published}.old-${id}`;
  const hadPrevious = fs.existsSync(published);
  if (hadPrevious) {
    fs.renameSync(published, old);
  }
  try {
    fs.renameSync(staging, published);
  } catch (e) {
    if (hadPrevious) {
      fs.renameSync(old, published);
    }
    throw e;
  }
  if (hadPrevious) {
    fs.rmSync(old, { recursive: true, force: true });
  }
};

export const runRender = async ({
  lessonPath,
  ctx,
}: {
  lessonPath: string;
  ctx: JobContext;
}) => {
  const { signal } = ctx;
  const lesson = readLesson(lessonPath);
  const plan = readEditPlan(lessonPath);
  if (!plan) {
    throw new Error("No edit plan yet. Run post-production first.");
  }

  const { cancelSignal, cancel } = makeCancelSignal();
  signal.addEventListener("abort", () => cancel(), { once: true });

  ctx.update({
    status: "RENDERING",
    step: "Bundling the video template",
    progress: 0,
  });
  const serveUrl = await getBundle((p) =>
    ctx.update({ progress: within(PROGRESS.bundle, p) }),
  );
  if (signal.aborted) {
    return;
  }

  const inputProps = { lessonPath };
  const port = await getFreePort();
  ctx.update({ step: "Preparing the composition" });
  const composition = await selectComposition({
    serveUrl,
    id: LESSON_COMPOSITION_ID,
    inputProps,
    port,
  });

  // Staging folder next to published/ (same volume, so rename is atomic).
  const lessonDir = resolvePublicPath(lessonPath);
  const staging = path.join(lessonDir, `.render-${ctx.state().id}`);
  fs.rmSync(staging, { recursive: true, force: true });
  fs.mkdirSync(staging, { recursive: true });

  try {
    const artifacts = new Map<string, string | Buffer>();
    ctx.update({ step: "Rendering video" });
    let lastReported = -1;
    await renderMedia({
      serveUrl,
      composition,
      inputProps,
      port,
      codec: "h264",
      imageFormat: IMAGE_FORMAT,
      overwrite: true,
      outputLocation: path.join(staging, "lesson.mp4"),
      cancelSignal,
      onProgress: ({ progress }) => {
        if (progress - lastReported < 0.01 && progress < 1) {
          return;
        }
        lastReported = progress;
        ctx.update({ progress: within(PROGRESS.render, progress) });
      },
      onArtifact: (artifact) => {
        artifacts.set(
          path.basename(artifact.filename),
          artifactContent(artifact),
        );
      },
    });

    ctx.update({
      step: "Rendering thumbnail",
      progress: within(PROGRESS.still, 0),
    });
    await renderStill({
      serveUrl,
      composition,
      inputProps,
      port,
      imageFormat: "jpeg",
      overwrite: true,
      output: path.join(staging, "thumbnail.jpg"),
      frame: getThumbnailFrame({
        fps: composition.fps,
        durationInFrames: composition.durationInFrames,
        hasIntro: plan.intro !== null,
      }),
      cancelSignal,
    });

    ctx.update({
      step: "Writing subtitles and transcript",
      progress: within(PROGRESS.publish, 0),
    });
    const srt = artifacts.get(SRT_ARTIFACT);
    if (srt !== undefined) {
      const srtText = srt.toString();
      fs.writeFileSync(path.join(staging, "lesson.srt"), srtText);
      fs.writeFileSync(path.join(staging, "lesson.vtt"), srtToVtt(srtText));
    } else {
      console.warn(`The composition emitted no ${SRT_ARTIFACT} artifact`);
    }
    const chapters = artifacts.get(CHAPTERS_ARTIFACT);
    if (chapters !== undefined) {
      fs.writeFileSync(path.join(staging, "chapters.json"), chapters);
    } else {
      console.warn(`The composition emitted no ${CHAPTERS_ARTIFACT} artifact`);
    }

    const captions = readCaptions(getTakeFiles(lessonPath, plan.takeId)) ?? [];
    fs.writeFileSync(
      path.join(staging, "transcript.md"),
      buildTranscriptMarkdown({ title: lesson.title, captions, plan }),
    );

    if (signal.aborted) {
      return;
    }
    publishAtomically(
      staging,
      resolvePublicPath(publishedPath(lessonPath)),
      ctx.state().id,
    );
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
  }
};
