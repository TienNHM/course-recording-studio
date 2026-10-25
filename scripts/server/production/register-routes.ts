import type { Server } from "connect";
import {
  CAPTIONS_API,
  EDIT_PLAN_API,
  PRODUCTION_CANCEL,
  PRODUCTION_START,
  PRODUCTION_STATUS,
  RENDER_LESSON,
} from "../constants";
import {
  handleCaptions,
  handleEditPlan,
  handleProductionCancel,
  handleProductionStart,
  handleProductionStatus,
  handleRenderLesson,
} from "./routes";

export const registerProductionRoutes = (app: Server) => {
  app.use(PRODUCTION_START, handleProductionStart);
  app.use(PRODUCTION_STATUS, handleProductionStatus);
  app.use(PRODUCTION_CANCEL, handleProductionCancel);
  app.use(EDIT_PLAN_API, handleEditPlan);
  app.use(CAPTIONS_API, handleCaptions);
  app.use(RENDER_LESSON, handleRenderLesson);
};
