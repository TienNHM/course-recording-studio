import type { Marker, RecordingSession } from "../../config/course";
import { TAKE_FILES } from "../../config/course";
import { LESSON_API, UPLOAD_VIDEO } from "../../scripts/server/constants";
import { getExtension } from "./find-good-supported-codec";

export const parseJsonOrThrowSource = (data: Uint8Array, type: string) => {
  const asString = new TextDecoder("utf-8").decode(data);
  try {
    return JSON.parse(asString);
  } catch {
    throw new Error(`Invalid JSON (${type}): ${asString}`);
  }
};

const throwIfNotOk = async (res: Response, what: string) => {
  if (res.ok) {
    return;
  }

  const text = await res.text().catch(() => "");
  throw new Error(`${what} failed (${res.status}): ${text}`);
};

// Stores the file at public/<lessonPath>/recordings/<takeId>/<prefix>.<ext>
export const uploadFileToServer = async ({
  blob,
  takeId,
  prefix,
  lessonPath,
  expectedFrames,
  mimeType,
}: {
  blob: Blob;
  takeId: string;
  prefix: string;
  lessonPath: string;
  expectedFrames: number;
  mimeType: string;
}) => {
  const extension = getExtension(mimeType);
  const videoFile = new File([blob], `${prefix}.${extension}`, {
    type: mimeType,
  });

  const url = new URL(UPLOAD_VIDEO, window.location.origin);

  url.search = new URLSearchParams({
    lessonPath,
    takeId,
    prefix,
    extension,
    expectedFrames: String(Math.round(expectedFrames)),
  }).toString();

  const res = await fetch(url, {
    method: "POST",
    body: videoFile,
  });
  await throwIfNotOk(res, `Uploading ${prefix}.${extension}`);
  await res.text();
};

export const uploadTakeFile = async ({
  lessonPath,
  takeId,
  name,
  data,
}: {
  lessonPath: string;
  takeId: string;
  name: typeof TAKE_FILES.markers | typeof TAKE_FILES.session;
  data: Marker[] | RecordingSession;
}) => {
  const url = new URL(`${LESSON_API}/take-file`, window.location.origin);
  url.search = new URLSearchParams({ lessonPath, takeId, name }).toString();

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(data),
  });
  await throwIfNotOk(res, `Saving ${name}`);
  await res.text();
};

export const selectTakeOnServer = async ({
  lessonPath,
  takeId,
}: {
  lessonPath: string;
  takeId: string;
}) => {
  const res = await fetch(
    new URL(`${LESSON_API}/select-take`, window.location.origin),
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lessonPath, takeId }),
    },
  );
  await throwIfNotOk(res, "Selecting the take");
  await res.text();
};
