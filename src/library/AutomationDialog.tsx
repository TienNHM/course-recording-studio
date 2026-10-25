import {
  Bot,
  FolderInput,
  ListChecks,
  Loader2,
  Play,
  ScrollText,
} from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
import {
  fetchAutomationSettings,
  fetchHealth,
  fetchInbox,
  processPending,
  updateAutomationSettings,
  type ActivityEvent,
  type AutomationSettingsResponse,
  type InboxResponse,
  type ProcessPendingResult,
} from "../actions/automation";
import { Alert } from "../components/ui/alert";
import { Badge, type BadgeTone } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { SegmentedControl } from "../components/ui/segmented-control";
import { useFormat, useT } from "../i18n";
import { Field, describedBy } from "./form-fields";
import { isAbsolutePath } from "./lesson-flow";
import { CommandBlock, ConfirmDialog, SwitchField } from "./library-ui";

const INBOX_POLL_MS = 3000;
const EVENTS_SHOWN = 15;

const LEVEL_TONE: Record<ActivityEvent["level"], BadgeTone> = {
  info: "info",
  warn: "warning",
  error: "destructive",
};

// Repository folder = parent of public/ (as reported by /api/health).
const repoDirFromPublicDir = (publicDir: string) =>
  publicDir.replace(/[\\/]+public[\\/]*$/i, "").replace(/\\/g, "/");

const Section: React.FC<{
  readonly icon: React.ReactNode;
  readonly title: React.ReactNode;
  readonly description?: React.ReactNode;
  readonly action?: React.ReactNode;
  readonly children: React.ReactNode;
}> = ({ icon, title, description, action, children }) => (
  <section className="grid gap-3 rounded-lg border bg-card p-4">
    <div className="flex items-start gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary [&_svg]:h-4 [&_svg]:w-4">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="text-heading">{title}</h3>
        {description ? (
          <p className="text-caption text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
    {children}
  </section>
);

const InboxSection: React.FC<{
  readonly settings: AutomationSettingsResponse;
  readonly watcher: InboxResponse["watcher"] | null;
  readonly onChanged: (settings: AutomationSettingsResponse) => void;
}> = ({ settings, watcher, onChanged }) => {
  const t = useT("library");
  const [folder, setFolder] = useState(settings.inboxDir);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const live = watcher ?? settings.watcher;

  const folderError =
    folder.trim() === ""
      ? t("automationDialog.inbox.folderRequired")
      : !isAbsolutePath(folder.trim())
        ? t("automationDialog.inbox.folderNotAbsolute")
        : null;

  const put = useCallback(
    async (patch: { inboxDir?: string | null; enabled?: boolean }) => {
      setBusy(true);
      setError(null);
      setSaved(false);
      try {
        const next = await updateAutomationSettings(patch);
        onChanged(next);
        setFolder(next.inboxDir);
        setSaved(true);
      } catch (e) {
        setError(
          t("automationDialog.inbox.failed", { message: (e as Error).message }),
        );
      } finally {
        setBusy(false);
      }
    },
    [onChanged, t],
  );

  const folderChanged = folder.trim() !== settings.inboxDir;

  return (
    <Section
      icon={<FolderInput aria-hidden />}
      title={t("automationDialog.inbox.title")}
      description={t("automationDialog.inbox.body")}
      action={
        <Badge tone={live.watching ? "success" : "neutral"} dot pulse={live.watching}>
          {live.watching
            ? t("automationDialog.watcher.watching")
            : t("automationDialog.watcher.off")}
        </Badge>
      }
    >
      <SwitchField
        label={t("automationDialog.inbox.enabled")}
        hint={t("automationDialog.inbox.enabledHint")}
        checked={settings.enabled}
        disabled={busy}
        onCheckedChange={(enabled) => put({ enabled })}
      />
      <form
        className="grid gap-2"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (!folderError) put({ inboxDir: folder.trim() });
        }}
      >
        <Field
          label={
            <span className="inline-flex items-center gap-2">
              {t("automationDialog.inbox.folder")}
              <Badge size="sm" variant="outline">
                {t(`automationDialog.inbox.source.${settings.inboxDirSource}`)}
              </Badge>
            </span>
          }
          htmlFor="inbox-folder"
          error={folderChanged ? folderError : null}
          hint={t("automationDialog.inbox.folderHint")}
        >
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="inbox-folder"
              className="font-mono text-caption"
              value={folder}
              spellCheck={false}
              aria-invalid={folderChanged && folderError ? true : undefined}
              aria-describedby={describedBy("inbox-folder", {
                error: folderChanged ? folderError : null,
                hint: true,
              })}
              onChange={(e) => {
                setFolder(e.target.value);
                setSaved(false);
              }}
            />
            <Button
              type="submit"
              variant="secondary"
              className="shrink-0"
              disabled={busy || !folderChanged || Boolean(folderError)}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              {t("automationDialog.inbox.save")}
            </Button>
          </div>
        </Field>
        <div className="flex flex-wrap items-center gap-2 text-caption text-muted-foreground">
          {folder.trim() !== settings.suggestedInboxDir ? (
            <Button
              type="button"
              variant="link"
              size="xs"
              className="h-auto px-0"
              onClick={() => setFolder(settings.suggestedInboxDir)}
            >
              {t("automationDialog.inbox.useSuggested")}
            </Button>
          ) : null}
          <span className="min-w-0 break-all font-mono">
            {t("automationDialog.inbox.suggested", {
              path: settings.suggestedInboxDir,
            })}
          </span>
          {saved ? (
            <span role="status" className="text-success">
              {t("automationDialog.inbox.saved")}
            </span>
          ) : null}
        </div>
      </form>
      {live.processing || live.pending.length > 0 ? (
        <div className="grid gap-1 text-caption text-muted-foreground" aria-live="polite">
          {live.processing ? (
            <span className="inline-flex items-center gap-1.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              {t("automationDialog.watcher.processing", { file: live.processing })}
            </span>
          ) : null}
          <span>
            {t("automationDialog.watcher.pending", { count: live.pending.length })}
          </span>
        </div>
      ) : null}
      <details className="text-caption">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
          {t("automationDialog.inbox.layout")}
        </summary>
        <pre className="mt-2 overflow-x-auto rounded-md border bg-muted/50 p-3 font-mono text-caption text-foreground">
          {`${settings.inboxDir}/
  Lập trình .NET/          ← ${t("automationDialog.layout.course")}
    Chương 1/              ← ${t("automationDialog.layout.module")}
      Giới thiệu.mp4       ← ${t("automationDialog.layout.lesson")}
      Giới thiệu.markers.json
  _imported/  _failed/`}
        </pre>
      </details>
      {error ? <Alert tone="destructive">{error}</Alert> : null}
    </Section>
  );
};

const EventsSection: React.FC<{ readonly events: ActivityEvent[] | null }> = ({
  events,
}) => {
  const t = useT("library");
  const f = useFormat();
  return (
    <Section icon={<ScrollText aria-hidden />} title={t("automationDialog.events.title")}>
      {events === null ? null : events.length === 0 ? (
        <p className="text-caption text-muted-foreground">
          {t("automationDialog.events.empty")}
        </p>
      ) : (
        <ul className="grid max-h-56 gap-2 overflow-y-auto pr-1">
          {events.slice(0, EVENTS_SHOWN).map((event) => (
            <li key={event.id} className="grid gap-0.5 border-b pb-2 last:border-b-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge size="sm" tone={LEVEL_TONE[event.level]}>
                  {t(`automationDialog.events.types.${event.type}`)}
                </Badge>
                <time
                  dateTime={event.at}
                  title={f.formatDateTime(event.at)}
                  className="text-caption text-muted-foreground"
                >
                  {f.formatRelativeTime(event.at)}
                </time>
              </div>
              <p className="break-words text-caption">{event.message}</p>
              {event.lessonPath ? (
                <p className="truncate font-mono text-2xs text-muted-foreground">
                  {event.lessonPath}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
};

const PendingSection: React.FC<{
  readonly course: { id: string; name: string } | null;
}> = ({ course }) => {
  const t = useT("library");
  const [scope, setScope] = useState<"all" | "course">(course ? "course" : "all");
  const [preview, setPreview] = useState<ProcessPendingResult | null>(null);
  const [result, setResult] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);

  const courseId = scope === "course" && course ? course.id : undefined;
  const total = preview ? preview.production.length + preview.render.length : 0;

  const run = useCallback(
    async (dryRun: boolean) => {
      setBusy(true);
      setError(null);
      try {
        const res = await processPending({ courseId, dryRun });
        if (dryRun) {
          setPreview(res);
          setResult(null);
        } else {
          setPreview(null);
          setResult(res.production.length + res.render.length);
        }
      } catch (e) {
        setError(t("automationDialog.pending.failed", { message: (e as Error).message }));
      } finally {
        setBusy(false);
      }
    },
    [courseId, t],
  );

  const list = (title: string, items: { lessonPath: string; reason?: string }[]) =>
    items.length === 0 ? null : (
      <div className="grid gap-1">
        <span className="text-label">
          {title} · {items.length}
        </span>
        <ul className="grid gap-0.5">
          {items.map((item) => (
            <li key={item.lessonPath} className="min-w-0 text-caption">
              <span className="break-all font-mono">{item.lessonPath}</span>
              {item.reason ? (
                <span className="text-muted-foreground"> — {item.reason}</span>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    );

  return (
    <Section
      icon={<ListChecks aria-hidden />}
      title={t("automationDialog.pending.title")}
      description={t("automationDialog.pending.body")}
    >
      <div className="flex flex-wrap items-center gap-2">
        {course ? (
          <SegmentedControl<"all" | "course">
            aria-label={t("automationDialog.pending.scope")}
            value={scope}
            onValueChange={(value) => {
              setScope(value);
              setPreview(null);
              setResult(null);
            }}
            options={[
              {
                value: "course",
                label: (
                  <span className="max-w-[12rem] truncate">
                    {t("automationDialog.pending.scopeCourse", { course: course.name })}
                  </span>
                ),
              },
              { value: "all", label: t("automationDialog.pending.scopeAll") },
            ]}
          />
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => run(true)}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          {t("automationDialog.pending.preview")}
        </Button>
      </div>
      {preview ? (
        <div className="grid gap-3 rounded-md border bg-muted/30 p-3" aria-live="polite">
          {total === 0 ? (
            <p className="text-body">{t("automationDialog.pending.nothing")}</p>
          ) : null}
          {list(t("automationDialog.pending.production"), preview.production)}
          {list(t("automationDialog.pending.render"), preview.render)}
          {list(t("automationDialog.pending.skipped"), preview.skipped)}
          {total > 0 ? (
            <Button
              type="button"
              className="justify-self-start"
              disabled={busy}
              onClick={() => setConfirm(true)}
            >
              <Play className="h-4 w-4" aria-hidden />
              {t("automationDialog.pending.run", { count: total })}
            </Button>
          ) : null}
        </div>
      ) : null}
      {result !== null ? (
        <Alert tone="success">{t("automationDialog.pending.queued", { count: result })}</Alert>
      ) : null}
      {error ? <Alert tone="destructive">{error}</Alert> : null}
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={t("confirm.runPendingTitle", { count: total })}
        description={t("confirm.runPendingBody")}
        confirmLabel={t("automationDialog.pending.run", { count: total })}
        onConfirm={() => run(false)}
      />
    </Section>
  );
};

const AgentSection: React.FC<{ readonly repoDir: string | null }> = ({ repoDir }) => {
  const t = useT("library");
  const repo = repoDir ?? "<repo>";
  const labels = {
    copyLabel: t("automationDialog.agent.copy"),
    copiedLabel: t("automationDialog.agent.copied"),
    failedLabel: t("automationDialog.agent.copyFailed"),
  };
  return (
    <Section
      icon={<Bot aria-hidden />}
      title={t("automationDialog.agent.title")}
      description={t("automationDialog.agent.body")}
    >
      <div className="grid gap-1.5">
        <span className="text-label">{t("automationDialog.agent.mcp")}</span>
        <CommandBlock
          command={`claude mcp add course-studio -- bun ${repo}/mcp/index.ts`}
          {...labels}
        />
      </div>
      <div className="grid gap-1.5">
        <span className="text-label">{t("automationDialog.agent.cli")}</span>
        <CommandBlock command="npm run studio -- process-pending --dry-run" {...labels} />
        <CommandBlock
          command={`npm run studio -- process --course "C# 101" --module "Basics" --lesson "Intro" --file D:\\rec.mp4`}
          {...labels}
        />
      </div>
      <p className="text-caption text-muted-foreground">
        {t("automationDialog.agent.docs")}
      </p>
    </Section>
  );
};

const AutomationBody: React.FC<{
  readonly course: { id: string; name: string } | null;
}> = ({ course }) => {
  const t = useT("library");
  const tc = useT("common");
  const [settings, setSettings] = useState<AutomationSettingsResponse | null>(null);
  const [inbox, setInbox] = useState<InboxResponse | null>(null);
  const [repoDir, setRepoDir] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAutomationSettings()
      .then(setSettings)
      .catch((e) =>
        setError(t("automationDialog.loadFailed", { message: (e as Error).message })),
      );
    fetchHealth()
      .then((health) => setRepoDir(repoDirFromPublicDir(health.publicDir)))
      .catch(() => setRepoDir(null));
  }, [t]);

  useEffect(() => {
    let cancelled = false;
    const poll = () =>
      fetchInbox()
        .then((res) => !cancelled && setInbox(res))
        .catch(() => undefined);
    poll();
    const interval = setInterval(poll, INBOX_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="grid gap-4">
      {error ? <Alert tone="destructive">{error}</Alert> : null}
      {settings ? (
        <InboxSection
          settings={settings}
          watcher={inbox?.watcher ?? null}
          onChanged={setSettings}
        />
      ) : !error ? (
        <div className="flex items-center gap-2 text-caption text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {tc("state.loading")}
        </div>
      ) : null}
      <PendingSection course={course} />
      <EventsSection events={inbox?.events ?? null} />
      <AgentSection repoDir={repoDir} />
    </div>
  );
};

export const AutomationDialog: React.FC<{
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly course: { id: string; name: string } | null;
}> = ({ open, onOpenChange, course }) => {
  const t = useT("library");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[720px]">
        <DialogHeader>
          <DialogTitle>{t("automationDialog.title")}</DialogTitle>
          <DialogDescription>{t("automationDialog.description")}</DialogDescription>
        </DialogHeader>
        {open ? <AutomationBody course={course} /> : null}
      </DialogContent>
    </Dialog>
  );
};
