export const GET_FOLDERS = "/api/projects";
export const CREATE_FOLDER = "/api/create-folder";
export const UPLOAD_VIDEO = "/api/upload-video";
export const TRANSCRIBE_VIDEO = "/api/transcribe-video";
export const CANCEL_TRANSCRIBE = "/api/cancel-transcribe";

// Course Recording Studio
export const COURSES_API = "/api/courses";
export const LESSON_API = "/api/lesson";
export const PRODUCTION_START = "/api/production/start";
export const PRODUCTION_STATUS = "/api/production/status";
export const PRODUCTION_CANCEL = "/api/production/cancel";
export const EDIT_PLAN_API = "/api/production/edit-plan";
export const CAPTIONS_API = "/api/production/captions";
export const RENDER_LESSON = "/api/render";
export const DISK_SPACE = "/api/disk-space";

// Automation (MCP server / CLI). IMPORT_RECORDING and PUBLISHED_FILES live
// under LESSON_API, so they are registered before it.
export const HEALTH = "/api/health";
export const IMPORT_RECORDING = "/api/lesson/import-recording";
export const PUBLISHED_FILES = "/api/lesson/published";
