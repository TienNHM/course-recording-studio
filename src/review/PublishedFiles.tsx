import React from "react";
import { publishedPath } from "../../config/course";
import { publicUrl } from "../actions/production";

const FILES = [
  ["lesson.mp4", "Video (MP4)"],
  ["lesson.srt", "Subtitles (SRT)"],
  ["lesson.vtt", "Subtitles (VTT)"],
  ["chapters.json", "Chapters"],
  ["transcript.md", "Transcript"],
] as const;

// Links to the files written by the last export.
export const PublishedFiles: React.FC<{
  readonly lessonPath: string;
  // Changes after every export so the browser does not show stale files.
  readonly version: string | null;
}> = ({ lessonPath, version }) => {
  const dir = publishedPath(lessonPath);
  return (
    <div
      className="grid gap-3 rounded-md border p-3"
      data-testid="published-files"
    >
      <div className="text-sm font-medium">Published files</div>
      <div className="flex gap-4">
        <a
          href={publicUrl(`${dir}/lesson.mp4`, version)}
          target="_blank"
          rel="noreferrer"
          className="shrink-0"
        >
          <img
            src={publicUrl(`${dir}/thumbnail.jpg`, version)}
            alt="Thumbnail"
            className="h-24 rounded border object-cover"
            style={{ aspectRatio: "16 / 9" }}
          />
        </a>
        <ul className="grid content-start gap-1 text-sm">
          {FILES.map(([file, label]) => (
            <li key={file}>
              <a
                href={publicUrl(`${dir}/${file}`, version)}
                target="_blank"
                rel="noreferrer"
                className="text-sky-400 hover:underline"
              >
                {label}
              </a>
              <span className="ml-2 text-xs text-muted-foreground">{file}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
