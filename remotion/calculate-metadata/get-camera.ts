import { StaticFile, getStaticFiles } from "remotion";
import {
  ALTERNATIVE1_PREFIX,
  ALTERNATIVE2_PREFIX,
  CAPTIONS_PREFIX,
  DISPLAY_PREFIX,
  WEBCAM_PREFIX,
} from "../../config/cameras";
import { Cameras, SelectableScene } from "../../config/scenes";

type CamerasAndScene = {
  scene: SelectableScene;
  cameras: Cameras | null;
};

const findMatchingFile = ({
  files,
  folder,
  prefix,
  timestamp,
}: {
  files: StaticFile[];
  folder: string;
  prefix: string;
  timestamp: string;
}): StaticFile | null => {
  const sub = files.find((_f) =>
    _f.name.startsWith(`${folder}/${prefix}${timestamp}.`),
  );

  return sub ?? null;
};

const getTimestamp = ({
  file,
  folder,
  prefix,
}: {
  file: StaticFile;
  folder: string;
  prefix: string;
}) => {
  return (
    file.name
      // folder is case sensitive:
      // Need to replace it first before calling .toLowerCase()
      .replace(`${folder}/${prefix}`, "")
      .toLowerCase()
      .replace(".webm", "")
      .replace(".mov", "")
      .replace(".mkv", "")
      .replace(".mp4", "")
  );
};

const mapFile = ({
  file,
  files,
  folder,
}: {
  file: StaticFile;
  files: StaticFile[];
  folder: string;
}): Cameras | null => {
  const isWebcam = file.name.startsWith(`${folder}/${WEBCAM_PREFIX}`);
  const isDisplay = file.name.startsWith(`${folder}/${DISPLAY_PREFIX}`);
  if (!isWebcam && !isDisplay) {
    return null;
  }

  const timestamp = getTimestamp({
    file,
    folder,
    prefix: isWebcam ? WEBCAM_PREFIX : DISPLAY_PREFIX,
  });

  if (isDisplay) {
    // A take without a webcam: the display recording becomes the main
    // recording and is shown fullscreen.
    const webcam = findMatchingFile({
      files,
      folder,
      prefix: WEBCAM_PREFIX,
      timestamp,
    });
    if (webcam) {
      // Will be picked up via the webcam file
      return null;
    }
  }

  const display = isWebcam
    ? findMatchingFile({
        files,
        folder,
        prefix: DISPLAY_PREFIX,
        timestamp,
      })
    : null;
  const sub = findMatchingFile({
    files,
    folder,
    prefix: CAPTIONS_PREFIX,
    timestamp,
  });
  const alternative1 = findMatchingFile({
    files,
    folder,
    prefix: ALTERNATIVE1_PREFIX,
    timestamp,
  });
  const alternative2 = findMatchingFile({
    folder,
    files,
    prefix: ALTERNATIVE2_PREFIX,
    timestamp,
  });

  return {
    webcam: file,
    display: display ?? null,
    captions: sub ?? null,
    alternative1: alternative1 ?? null,
    alternative2: alternative2 ?? null,
    timestamp: parseInt(timestamp, 10),
  };
};

const getCameras = (folder: string) => {
  const files = getStaticFiles().filter((f) =>
    f.name.startsWith(`${folder}/`),
  );

  const mappedCameras = files
    .map((f) => mapFile({ file: f, files, folder }))
    .filter(Boolean) as Cameras[];

  return mappedCameras.sort((a, b) => a.timestamp - b.timestamp);
};

// `folder` is the folder in public/ that contains the recordings
// (for legacy projects, this is the composition ID).
export const getAllCameras = ({
  folder,
  scenes,
}: {
  folder: string;
  scenes: SelectableScene[];
}) => {
  const allCameras = getCameras(folder);
  let videoIndex = -1;

  const scenesWithCameras = scenes.map((scene): CamerasAndScene => {
    if (scene.type !== "videoscene") {
      return { cameras: null, scene };
    }

    videoIndex += 1;
    return { scene, cameras: allCameras[videoIndex] as Cameras };
  });

  const hasAtLeast1Camera = allCameras.length > 0;

  return { scenesWithCameras, hasAtLeast1Camera };
};
