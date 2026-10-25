import {
  Check,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Film,
  ListOrdered,
  Play,
  Subtitles,
  Image as ImageIcon,
  Youtube,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { publishedPath } from "../../config/course";
import { fetchPublicJson, publicUrl } from "../actions/production";
import { Button } from "../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { Tooltip } from "../components/ui/tooltip";
import { useFormat, useT } from "../i18n";
import { fetchPublishedFiles, type PublishedFile } from "./review-api";
import { formatYouTubeChapters, type Chapter } from "./review-helpers";
import { useClipboard } from "./use-clipboard";

const FILES = [
  { name: "lesson.mp4", key: "mp4", icon: Film },
  { name: "lesson.srt", key: "srt", icon: Subtitles },
  { name: "lesson.vtt", key: "vtt", icon: Subtitles },
  { name: "chapters.json", key: "chapters", icon: ListOrdered },
  { name: "transcript.md", key: "transcript", icon: FileText },
  { name: "thumbnail.jpg", key: "thumbnail", icon: ImageIcon },
] as const;

/**
 * Files written by the last export: thumbnail (click to play the video),
 * downloads, copy-path buttons and "copy chapters for YouTube".
 * Used by the Review page and the Library.
 */
export const PublishedFiles: React.FC<{
  readonly lessonPath: string;
  // Changes after every export so the browser does not show stale files.
  readonly version: string | null;
}> = ({ lessonPath, version }) => {
  const t = useT("review");
  const f = useFormat();
  const clipboard = useClipboard();
  const [files, setFiles] = useState<PublishedFile[] | null>(null);
  const [chapters, setChapters] = useState<Chapter[] | null>(null);
  const [playing, setPlaying] = useState(false);
  const dir = publishedPath(lessonPath);

  useEffect(() => {
    let cancelled = false;
    fetchPublishedFiles(lessonPath)
      .then((r) => !cancelled && setFiles(r.files))
      .catch(() => !cancelled && setFiles(null));
    fetchPublicJson<Chapter[]>(`${dir}/chapters.json`)
      .then((c) => !cancelled && setChapters(Array.isArray(c) ? c : null))
      .catch(() => !cancelled && setChapters(null));
    return () => {
      cancelled = true;
    };
  }, [dir, lessonPath, version]);

  const byName = new Map((files ?? []).map((file) => [file.name, file]));
  // Without the listing (older server), assume the standard set exists.
  const rows = FILES.filter((file) => files === null || byName.has(file.name));
  const hasVideo = files === null || byName.has("lesson.mp4");
  const hasThumb = files === null || byName.has("thumbnail.jpg");
  const videoUrl = publicUrl(`${dir}/lesson.mp4`, version);
  const youtube = chapters ? formatYouTubeChapters(chapters) : "";

  if (files !== null && files.length === 0) {
    return (
      <p className="text-caption text-muted-foreground">{t("published.empty")}</p>
    );
  }

  return (
    <div className="grid gap-3" data-testid="published-files">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="flex-1 text-heading">{t("published.title")}</h3>
        {youtube ? (
          <Button
            type="button"
            size="xs"
            variant="outline"
            onClick={() => clipboard.copy("youtube", youtube)}
          >
            {clipboard.copied === "youtube" ? (
              <Check className="h-3.5 w-3.5 text-success" aria-hidden />
            ) : (
              <Youtube className="h-3.5 w-3.5" aria-hidden />
            )}
            {clipboard.copied === "youtube"
              ? t("chapters.copied", { count: youtube.split("\n").length })
              : t("published.copyYouTube")}
          </Button>
        ) : null}
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        {hasVideo && hasThumb ? (
          <button
            type="button"
            className="group relative w-full shrink-0 self-start overflow-hidden rounded-md border bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-48"
            style={{ aspectRatio: "16 / 9" }}
            aria-label={t("published.play")}
            onClick={() => setPlaying(true)}
          >
            <img
              src={publicUrl(`${dir}/thumbnail.jpg`, version)}
              alt={t("published.thumbnail")}
              className="h-full w-full object-cover"
            />
            <span className="absolute inset-0 flex items-center justify-center bg-background/20 transition-colors group-hover:bg-background/40">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md">
                <Play className="ml-0.5 h-5 w-5" aria-hidden />
              </span>
            </span>
          </button>
        ) : null}
        <ul className="grid min-w-0 flex-1 content-start gap-1">
          {rows.map(({ name, key, icon: Icon }) => {
            const file = byName.get(name);
            const url = publicUrl(`${dir}/${name}`, version);
            return (
              <li
                key={name}
                className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-accent/60"
              >
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-label">
                    {t(`published.files.${key}`)}
                  </div>
                  <div className="truncate text-caption text-muted-foreground">
                    {name}
                    {file ? (
                      <span className="timecode"> · {f.formatBytes(file.sizeBytes)}</span>
                    ) : null}
                  </div>
                </div>
                {name === "lesson.mp4" ? (
                  <Tooltip content={t("published.openInTab")} align="end">
                    <Button
                      asChild
                      size="icon-sm"
                      variant="ghost"
                      aria-label={t("published.openInTab")}
                    >
                      <a href={url} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-4 w-4" aria-hidden />
                      </a>
                    </Button>
                  </Tooltip>
                ) : null}
                <Tooltip content={t("published.download", { name })} align="end">
                  <Button
                    asChild
                    size="icon-sm"
                    variant="ghost"
                    aria-label={t("published.download", { name })}
                  >
                    <a href={url} download={name}>
                      <Download className="h-4 w-4" aria-hidden />
                    </a>
                  </Button>
                </Tooltip>
                {file ? (
                  <Tooltip
                    content={
                      clipboard.copied === name
                        ? t("published.pathCopied")
                        : t("published.copyPath")
                    }
                    align="end"
                  >
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label={t("published.copyPath")}
                      onClick={() => clipboard.copy(name, file.path)}
                    >
                      {clipboard.copied === name ? (
                        <Check className="h-4 w-4 text-success" aria-hidden />
                      ) : (
                        <Copy className="h-4 w-4" aria-hidden />
                      )}
                    </Button>
                  </Tooltip>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
      {clipboard.error ? (
        <p className="text-caption text-destructive">{t("published.copyFailed")}</p>
      ) : null}

      <Dialog open={playing} onOpenChange={setPlaying}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t("published.videoTitle")}</DialogTitle>
          </DialogHeader>
          {playing ? (
            <video
              src={videoUrl}
              controls
              autoPlay
              className="w-full rounded-md bg-muted"
              style={{ aspectRatio: "16 / 9" }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
};
