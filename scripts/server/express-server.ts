import react from "@vitejs/plugin-react-swc";
import connect from "connect";
import { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { SERVER_PORT } from "../../config/server";
import {
  CANCEL_TRANSCRIBE,
  COURSES_API,
  CREATE_FOLDER,
  DISK_SPACE,
  GET_FOLDERS,
  LESSON_API,
  TRANSCRIBE_VIDEO,
  UPLOAD_VIDEO,
} from "./constants";
import {
  handleCourses,
  handleDiskSpace,
  handleLesson,
  handleSelectTake,
  handleTakeFile,
} from "./courses";
import { createProject } from "./create-project";
import { registerAutomationRoutes } from "./import-recording";
import { registerProductionRoutes } from "./production/register-routes";
import { indexHtmlDev } from "./index-html";
import { getProjectFolder } from "./projects";
import {
  handleCancelTranscription,
  handleTranscribeVideo,
  handleVideoUpload,
} from "./upload-video";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const startServer = async () => {
  const app = connect();

  const rootDir = path.join(__dirname, "..", "..");
  const publicDir = path.join(rootDir, "public");

  const vite = await createServer({
    configFile: false,
    root: rootDir,
    server: {
      middlewareMode: true,
      watch: {
        ignored: [path.join(rootDir, "whisper.cpp/**")],
      },
    },
    appType: "custom",
    // The Review page imports the Remotion composition (remotion/**). Vite's
    // dependency scan misses some of its deps, and the re-optimization it then
    // triggers needs an HMR reload, which does not reach the page in
    // middleware mode (duplicate React → "Invalid hook call"). Pre-bundle them.
    optimizeDeps: {
      include: [
        "@remotion/player",
        "@remotion/google-fonts/Inter",
        "@remotion/google-fonts/RobotoMono",
        "@remotion/animation-utils",
        "@remotion/media",
        "@remotion/studio",
        "@remotion/shapes",
        "@remotion/layout-utils",
      ],
    },
    plugins: [react()],
    publicDir,
  });

  app.use((req, res, next) => {
    vite.middlewares.handle(req, res, next);
  });

  app.use(GET_FOLDERS, (req: IncomingMessage, res: ServerResponse) => {
    getProjectFolder(req, res, rootDir);
  });

  app.use(CREATE_FOLDER, (req: IncomingMessage, res: ServerResponse) => {
    createProject(req, res, rootDir);
  });

  app.use(COURSES_API, handleCourses);
  // Health, recording import and published files (MCP server / CLI).
  registerAutomationRoutes(app);
  app.use(`${LESSON_API}/take-file`, handleTakeFile);
  app.use(`${LESSON_API}/select-take`, handleSelectTake);
  app.use(LESSON_API, handleLesson);
  app.use(DISK_SPACE, handleDiskSpace);
  app.use(UPLOAD_VIDEO, handleVideoUpload);
  app.use(TRANSCRIBE_VIDEO, handleTranscribeVideo);
  app.use(CANCEL_TRANSCRIBE, handleCancelTranscription);
  // Post-production, edit plan and render routes (Course Recording Studio).
  registerProductionRoutes(app);
  app.use("/", indexHtmlDev(vite, rootDir));

  const port = process.env.PORT || SERVER_PORT;

  app.listen(port);
  console.log(`Recording interface running on http://localhost:${port}`);
};
