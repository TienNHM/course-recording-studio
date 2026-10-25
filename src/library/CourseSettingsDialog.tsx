import { CircleDot, Plus, Trash2 } from "lucide-react";
import React, {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  Course,
  CourseLanguage,
  OutputProfile,
  VideoStyle,
} from "../../config/course";
import {
  DEFAULT_VIDEO_STYLE,
  OUTPUT_PROFILES,
  lessonPath as getLessonPath,
} from "../../config/course";
import type { CourseTree } from "../../scripts/server/course-api";
import { patchCourse } from "../actions/courses";
import { Alert } from "../components/ui/alert";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/misc";
import { SegmentedControl } from "../components/ui/segmented-control";
import { useT } from "../i18n";
import { Field, describedBy } from "./form-fields";
import {
  duplicateIndices,
  glossaryToRows,
  rowsToGlossary,
  validateTitle,
  type GlossaryRow,
} from "./lesson-flow";
import { ConfirmDialog, SectionLabel } from "./library-ui";
import { VideoStyleFields, VideoStyleMock } from "./VideoStyleFields";

const VideoStylePreview = React.lazy(() => import("./VideoStylePreview"));

type FormState = {
  name: string;
  description: string;
  language: CourseLanguage;
  outputProfile: OutputProfile;
  glossary: GlossaryRow[];
  videoStyle: VideoStyle;
};

const toForm = (course: Course): FormState => ({
  name: course.name,
  description: course.description,
  language: course.language,
  outputProfile: course.outputProfile,
  glossary: glossaryToRows(course.glossary),
  videoStyle: { ...DEFAULT_VIDEO_STYLE, ...course.videoStyle },
});

const signature = (form: FormState) =>
  JSON.stringify({
    ...form,
    name: form.name.trim(),
    glossary: rowsToGlossary(form.glossary),
  });

const GlossaryEditor: React.FC<{
  readonly rows: GlossaryRow[];
  readonly onChange: (rows: GlossaryRow[]) => void;
}> = ({ rows, onChange }) => {
  const t = useT("library");
  const termRefs = useRef<(HTMLInputElement | null)[]>([]);
  const duplicates = duplicateIndices(rows.map((r) => r.term));

  const addRow = () => {
    onChange([...rows, { term: "", aliases: "" }]);
    // Focus the new term once it is rendered.
    requestAnimationFrame(() => termRefs.current[rows.length]?.focus());
  };

  return (
    <div className="grid gap-3">
      <p className="text-caption text-muted-foreground">
        {t("courseSettings.glossaryHint")}
      </p>
      {rows.length === 0 ? (
        <p className="rounded-md border border-dashed p-3 text-center text-caption text-muted-foreground">
          {t("courseSettings.glossaryEmpty")}
        </p>
      ) : (
        <div className="grid gap-2">
          <div className="hidden grid-cols-[minmax(0,2fr)_minmax(0,3fr)_2rem] gap-2 px-0.5 text-caption text-muted-foreground sm:grid">
            <span>{t("courseSettings.glossaryTerm")}</span>
            <span>
              {t("courseSettings.glossaryAliases")} ·{" "}
              {t("courseSettings.glossaryAliasesHint")}
            </span>
            <span />
          </div>
          {rows.map((row, i) => {
            const duplicate = duplicates.includes(i);
            const update = (patch: Partial<GlossaryRow>) =>
              onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
            return (
              <div key={i} className="grid gap-1">
                <div className="grid grid-cols-[minmax(0,1fr)_2rem] gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)_2rem]">
                  <Input
                    ref={(el) => {
                      termRefs.current[i] = el;
                    }}
                    className="h-9"
                    aria-label={t("courseSettings.glossaryTerm")}
                    placeholder={t("courseSettings.glossaryTermPlaceholder")}
                    value={row.term}
                    aria-invalid={duplicate ? true : undefined}
                    onChange={(e) => update({ term: e.target.value })}
                  />
                  <Input
                    className="col-start-1 h-9 sm:col-start-auto"
                    aria-label={t("courseSettings.glossaryAliases")}
                    placeholder={t("courseSettings.glossaryAliasesPlaceholder")}
                    value={row.aliases}
                    onChange={(e) => update({ aliases: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (i === rows.length - 1) addRow();
                        else termRefs.current[i + 1]?.focus();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="col-start-2 row-start-1 h-9 w-8 sm:col-start-auto"
                    aria-label={t("courseSettings.glossaryRemove", {
                      term: row.term || "…",
                    })}
                    onClick={() => onChange(rows.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </Button>
                </div>
                {duplicate ? (
                  <p className="text-caption text-destructive">
                    {t("courseSettings.glossaryDuplicate")}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="justify-self-start"
        onClick={addRow}
      >
        <Plus className="h-4 w-4" aria-hidden />
        {t("courseSettings.glossaryAdd")}
      </Button>
    </div>
  );
};

const SettingsForm: React.FC<{
  readonly entry: CourseTree[number];
  readonly onSaved: () => void;
  readonly onDirtyChange: (dirty: boolean) => void;
  readonly onCancel: () => void;
}> = ({ entry, onSaved, onDirtyChange, onCancel }) => {
  const t = useT("library");
  const tc = useT("common");
  const { course } = entry;
  const initial = useMemo(() => signature(toForm(course)), [course]);
  const [form, setForm] = useState<FormState>(() => toForm(course));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = signature(form) !== initial;
  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  const nameError = validateTitle(form.name) ? t("courseSettings.nameRequired") : null;
  const glossaryDuplicates = duplicateIndices(form.glossary.map((r) => r.term));
  const valid = !nameError && glossaryDuplicates.length === 0;

  const previewLesson = useMemo(() => {
    for (const { lessons } of entry.modules) {
      const found = lessons.find((l) => l.selectedTake !== null);
      if (found) return found;
    }
    return null;
  }, [entry.modules]);

  const update = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!valid) return;
      setBusy(true);
      setError(null);
      try {
        await patchCourse(course.id, {
          name: form.name.trim(),
          description: form.description,
          language: form.language,
          outputProfile: form.outputProfile,
          glossary: rowsToGlossary(form.glossary),
          videoStyle: form.videoStyle,
        });
        onSaved();
      } catch (err) {
        setError(t("courseSettings.failed", { message: (err as Error).message }));
      } finally {
        setBusy(false);
      }
    },
    [course.id, form, onSaved, t, valid],
  );

  return (
    <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col" noValidate>
      <div className="grid min-h-0 flex-1 gap-8 overflow-y-auto px-6 pb-6">
        <section className="grid gap-4" aria-labelledby="cs-general">
          <SectionLabel id="cs-general">{t("courseSettings.sections.general")}</SectionLabel>
          <Field label={t("courseSettings.name")} htmlFor="cs-name" error={nameError}>
            <Input
              id="cs-name"
              value={form.name}
              aria-invalid={nameError ? true : undefined}
              aria-describedby={describedBy("cs-name", { error: nameError })}
              onChange={(e) => update({ name: e.target.value })}
            />
          </Field>
          <Field label={t("courseSettings.descriptionLabel")} htmlFor="cs-description">
            <Textarea
              id="cs-description"
              value={form.description}
              onChange={(e) => update({ description: e.target.value })}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid content-start gap-1.5">
              <span id="cs-language" className="text-label">
                {t("courseSettings.language")}
              </span>
              <SegmentedControl<CourseLanguage>
                aria-labelledby="cs-language"
                className="w-full"
                value={form.language}
                onValueChange={(language) => update({ language })}
                options={[
                  { value: "vi", label: tc("language.vi") },
                  { value: "en", label: tc("language.en") },
                ]}
              />
              <p className="text-caption text-muted-foreground">
                {t("courseSettings.languageHint")}
              </p>
            </div>
            <div className="grid content-start gap-1.5">
              <span id="cs-output" className="text-label">
                {t("courseSettings.outputProfile")}
              </span>
              <SegmentedControl<OutputProfile>
                aria-labelledby="cs-output"
                className="w-full"
                value={form.outputProfile}
                onValueChange={(outputProfile) => update({ outputProfile })}
                options={(Object.keys(OUTPUT_PROFILES) as OutputProfile[]).map((id) => ({
                  value: id,
                  label: t(`courseSettings.outputProfiles.${id}`),
                }))}
              />
              <p className="text-caption text-muted-foreground">
                {t("courseSettings.outputProfileDetail", {
                  width: OUTPUT_PROFILES[form.outputProfile].width,
                  height: OUTPUT_PROFILES[form.outputProfile].height,
                  fps: OUTPUT_PROFILES[form.outputProfile].fps,
                })}
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-3" aria-labelledby="cs-glossary">
          <div className="flex items-center gap-2">
            <SectionLabel id="cs-glossary">{t("courseSettings.sections.glossary")}</SectionLabel>
            <Badge size="sm">
              {t("courseSettings.glossaryCount", {
                count: rowsToGlossary(form.glossary).length,
              })}
            </Badge>
          </div>
          <GlossaryEditor
            rows={form.glossary}
            onChange={(glossary) => update({ glossary })}
          />
        </section>

        <section className="grid gap-4" aria-labelledby="cs-style">
          <SectionLabel id="cs-style">{t("courseSettings.sections.videoStyle")}</SectionLabel>
          <div className="grid gap-2">
            <span className="text-label">{t("videoStyle.preview")}</span>
            {previewLesson ? (
              <>
                <Suspense
                  fallback={
                    <div className="flex aspect-video w-full animate-pulse items-center justify-center rounded-lg border bg-muted text-caption text-muted-foreground">
                      {t("videoStyle.previewLoading")}
                    </div>
                  }
                >
                  <VideoStylePreview
                    lessonPath={getLessonPath(previewLesson)}
                    style={form.videoStyle}
                    language={form.language}
                  />
                </Suspense>
                <p className="text-caption text-muted-foreground">
                  {t("videoStyle.previewHint", { lesson: previewLesson.title })}
                </p>
              </>
            ) : (
              <>
                <VideoStyleMock value={form.videoStyle} courseName={form.name} />
                <p className="text-caption text-muted-foreground">
                  {t("videoStyle.previewMockHint")}
                </p>
              </>
            )}
          </div>
          <VideoStyleFields
            value={form.videoStyle}
            onChange={(patch) =>
              update({ videoStyle: { ...form.videoStyle, ...patch } })
            }
          />
        </section>
        {error ? <Alert tone="destructive">{error}</Alert> : null}
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t px-6 py-4">
        {dirty ? (
          <span
            role="status"
            className="inline-flex items-center gap-1.5 text-caption text-muted-foreground"
          >
            <CircleDot className="h-3.5 w-3.5 text-warning" aria-hidden />
            {t("courseSettings.unsaved")}
          </span>
        ) : null}
        <div className="flex-1" />
        <Button type="button" variant="outline" onClick={onCancel}>
          {tc("actions.cancel")}
        </Button>
        <Button type="submit" disabled={busy || !valid || !dirty}>
          {busy ? tc("actions.saving") : t("courseSettings.save")}
        </Button>
      </div>
    </form>
  );
};

export const CourseSettingsDialog: React.FC<{
  readonly entry: CourseTree[number];
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onSaved: () => void;
}> = ({ entry, open, onOpenChange, onSaved }) => {
  const t = useT("library");
  const dirty = useRef(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const onDirtyChange = useCallback((value: boolean) => {
    dirty.current = value;
  }, []);

  const requestClose = useCallback(() => {
    if (dirty.current) {
      setConfirmDiscard(true);
    } else {
      onOpenChange(false);
    }
  }, [onOpenChange]);

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => (next ? onOpenChange(true) : requestClose())}
      >
        <DialogContent className="flex max-h-[90vh] flex-col gap-0 p-0 sm:max-w-[720px]">
          <DialogHeader className="px-6 pb-4 pt-6">
            <DialogTitle>{t("courseSettings.title")}</DialogTitle>
            <DialogDescription>{t("courseSettings.description")}</DialogDescription>
          </DialogHeader>
          {open ? (
            <SettingsForm
              key={entry.course.id}
              entry={entry}
              onDirtyChange={onDirtyChange}
              onCancel={requestClose}
              onSaved={() => {
                dirty.current = false;
                onOpenChange(false);
                onSaved();
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        title={t("courseSettings.discardTitle")}
        description={t("courseSettings.discardBody")}
        confirmLabel={t("courseSettings.discard")}
        cancelLabel={t("courseSettings.keepEditing")}
        variant="destructive"
        onConfirm={() => {
          dirty.current = false;
          onOpenChange(false);
        }}
      />
    </>
  );
};
