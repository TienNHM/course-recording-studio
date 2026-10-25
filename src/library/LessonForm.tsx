import {
  AlertCircle,
  Check,
  CircleDot,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  Lesson,
  PostProduction,
  SilencePreset,
} from "../../config/course";
import { lessonPath as getLessonPath } from "../../config/course";
import { patchLesson } from "../actions/courses";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/misc";
import { SegmentedControl } from "../components/ui/segmented-control";
import { cn } from "../helpers/utils";
import { useT } from "../i18n";
import { Field, describedBy } from "./form-fields";
import {
  TITLE_MAX_LENGTH,
  draftSignature,
  isDraftValid,
  lessonDraftToPatch,
  validateLessonDraft,
  type LessonDraft,
} from "./lesson-flow";
import { SectionLabel, SwitchField } from "./library-ui";

const AUTOSAVE_DELAY_MS = 800;

const POST_PRODUCTION_TOGGLES = [
  "autoTranscribe",
  "autoDetectSilence",
  "autoRemoveSilence",
  "generateChapters",
  "intro",
  "outro",
] as const satisfies readonly (keyof PostProduction)[];

const SILENCE_PRESETS: SilencePreset[] = ["conservative", "balanced", "aggressive"];

const toDraft = (lesson: Lesson): LessonDraft => ({
  title: lesson.title,
  description: lesson.description,
  objectives: lesson.objectives,
  notes: lesson.notes,
  recordingProfile: lesson.recordingProfile,
  postProduction: lesson.postProduction,
});

type SaveState =
  | { kind: "saved" }
  | { kind: "dirty" }
  | { kind: "saving" }
  | { kind: "invalid" }
  | { kind: "error"; message: string };

const SaveIndicator: React.FC<{
  readonly state: SaveState;
  readonly onSaveNow: () => void;
}> = ({ state, onSaveNow }) => {
  const t = useT("library");
  const icon =
    state.kind === "saving" ? (
      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
    ) : state.kind === "saved" ? (
      <Check className="h-3.5 w-3.5 text-success" aria-hidden />
    ) : state.kind === "dirty" ? (
      <CircleDot className="h-3.5 w-3.5 text-warning" aria-hidden />
    ) : (
      <AlertCircle className="h-3.5 w-3.5 text-destructive" aria-hidden />
    );
  const text =
    state.kind === "error"
      ? t("form.saveState.error", { message: state.message })
      : t(`form.saveState.${state.kind}`);
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span
        role="status"
        aria-live="polite"
        className={cn(
          "flex min-w-0 items-center gap-1.5 text-caption",
          state.kind === "error" || state.kind === "invalid"
            ? "text-destructive"
            : "text-muted-foreground",
        )}
      >
        {icon}
        <span className="truncate">{text}</span>
      </span>
      {state.kind === "dirty" || state.kind === "error" ? (
        <Button type="button" size="xs" variant="outline" onClick={onSaveNow}>
          {t("form.saveNow")}
        </Button>
      ) : null}
    </div>
  );
};

// Lesson details. Changes are saved automatically shortly after typing stops
// (and right away on blur, Ctrl/Cmd+S and when leaving the lesson).
export const LessonForm: React.FC<{
  readonly lesson: Lesson;
  readonly onSaved: () => Promise<void>;
}> = ({ lesson, onSaved }) => {
  const t = useT("library");
  const path = getLessonPath(lesson);
  const [draft, setDraft] = useState<LessonDraft>(() => toDraft(lesson));
  const [saveState, setSaveState] = useState<SaveState>({ kind: "saved" });
  const savedSignature = useRef(draftSignature(toDraft(lesson)));
  const statusRef = useRef(lesson.status);
  statusRef.current = lesson.status;
  const onSavedRef = useRef(onSaved);
  onSavedRef.current = onSaved;
  const saving = useRef<Promise<void> | null>(null);

  const errors = useMemo(() => validateLessonDraft(draft), [draft]);
  const valid = isDraftValid(errors);
  const signature = useMemo(() => draftSignature(draft), [draft]);
  const dirty = signature !== savedSignature.current;

  const save = useCallback(
    async (toSave: LessonDraft) => {
      const sig = draftSignature(toSave);
      if (sig === savedSignature.current) {
        return;
      }
      if (!isDraftValid(validateLessonDraft(toSave))) {
        setSaveState({ kind: "invalid" });
        return;
      }
      if (saving.current) {
        await saving.current;
        if (sig === savedSignature.current) {
          return;
        }
      }
      setSaveState({ kind: "saving" });
      const run = (async () => {
        try {
          await patchLesson(path, lessonDraftToPatch(toSave, statusRef.current));
          savedSignature.current = sig;
          setSaveState({ kind: "saved" });
          await onSavedRef.current();
        } catch (err) {
          setSaveState({ kind: "error", message: (err as Error).message });
        }
      })();
      saving.current = run;
      await run;
      saving.current = null;
    },
    [path],
  );

  // The lesson may change elsewhere (AI agent, CLI, another tab). Take the
  // server version when there are no local edits, so a later autosave does
  // not write stale values back.
  const serverSignature = draftSignature(toDraft(lesson));
  const lessonRef = useRef(lesson);
  lessonRef.current = lesson;
  useEffect(() => {
    if (serverSignature === savedSignature.current) {
      return;
    }
    if (draftSignature(latest.current) === savedSignature.current) {
      savedSignature.current = serverSignature;
      setDraft(toDraft(lessonRef.current));
    }
  }, [serverSignature]);

  // Debounced autosave.
  const latest = useRef(draft);
  latest.current = draft;
  useEffect(() => {
    if (!dirty) {
      return;
    }
    if (!valid) {
      setSaveState({ kind: "invalid" });
      return;
    }
    setSaveState({ kind: "dirty" });
    const timeout = setTimeout(() => save(latest.current), AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timeout);
  }, [dirty, save, signature, valid]);

  // Flush pending changes when the form goes away (other lesson, other view).
  useEffect(() => {
    return () => {
      save(latest.current);
    };
  }, [save]);

  const update = (patch: Partial<LessonDraft>) =>
    setDraft((d) => ({ ...d, ...patch }));

  const updatePostProduction = (patch: Partial<PostProduction>) =>
    setDraft((d) => ({
      ...d,
      postProduction: { ...d.postProduction, ...patch },
    }));

  const saveNow = () => save(latest.current);

  const titleError =
    errors.title === "required"
      ? t("form.validation.titleRequired")
      : errors.title === "tooLong"
        ? t("form.validation.titleTooLong", { max: TITLE_MAX_LENGTH })
        : null;

  return (
    <form
      className="grid gap-6"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        saveNow();
      }}
      onKeyDown={(e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
          e.preventDefault();
          saveNow();
        }
      }}
      onBlur={() => {
        if (dirty && valid) saveNow();
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-heading">{t("form.title")}</h3>
        <SaveIndicator state={saveState} onSaveNow={saveNow} />
      </div>

      <div className="grid gap-4">
        <Field
          label={t("form.lessonTitle")}
          htmlFor="lesson-title"
          error={titleError}
        >
          <Input
            id="lesson-title"
            value={draft.title}
            placeholder={t("form.lessonTitlePlaceholder")}
            aria-invalid={titleError ? true : undefined}
            aria-describedby={describedBy("lesson-title", { error: titleError })}
            onChange={(e) => update({ title: e.target.value })}
            required
          />
        </Field>
        <Field label={t("form.description")} htmlFor="lesson-description">
          <Textarea
            id="lesson-description"
            value={draft.description}
            placeholder={t("form.descriptionPlaceholder")}
            onChange={(e) => update({ description: e.target.value })}
          />
        </Field>
        <fieldset className="grid gap-2">
          <legend className="mb-1.5 text-label">{t("form.objectives")}</legend>
          {draft.objectives.map((objective, i) => {
            const duplicate = errors.duplicateObjectives.includes(i);
            const id = `lesson-objective-${i}`;
            return (
              <div key={i} className="grid gap-1">
                <div className="flex gap-2">
                  <Input
                    id={id}
                    className="h-9"
                    value={objective}
                    placeholder={t("form.objectivePlaceholder", { number: i + 1 })}
                    aria-label={t("form.objectivePlaceholder", { number: i + 1 })}
                    aria-invalid={duplicate ? true : undefined}
                    aria-describedby={duplicate ? `${id}-error` : undefined}
                    onChange={(e) =>
                      update({
                        objectives: draft.objectives.map((o, j) =>
                          j === i ? e.target.value : o,
                        ),
                      })
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        update({ objectives: [...draft.objectives, ""] });
                      }
                    }}
                    autoFocus={i === draft.objectives.length - 1 && objective === ""}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="h-9 w-9 shrink-0"
                    aria-label={t("form.removeObjective", { number: i + 1 })}
                    onClick={() =>
                      update({
                        objectives: draft.objectives.filter((_, j) => j !== i),
                      })
                    }
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </Button>
                </div>
                {duplicate ? (
                  <p id={`${id}-error`} className="text-caption text-destructive">
                    {t("form.validation.objectiveDuplicate")}
                  </p>
                ) : null}
              </div>
            );
          })}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="justify-self-start"
            onClick={() => update({ objectives: [...draft.objectives, ""] })}
          >
            <Plus className="h-4 w-4" aria-hidden />
            {t("form.addObjective")}
          </Button>
        </fieldset>
        <Field
          label={t("form.notes")}
          htmlFor="lesson-notes"
          hint={t("form.notesHint")}
        >
          <Textarea
            id="lesson-notes"
            className="min-h-[120px]"
            value={draft.notes}
            aria-describedby="lesson-notes-hint"
            onChange={(e) => update({ notes: e.target.value })}
          />
        </Field>
      </div>

      <section className="grid gap-3">
        <SectionLabel>{t("form.automationSection")}</SectionLabel>
        <div className="grid gap-2 md:grid-cols-2">
          <SwitchField
            emphasis
            label={t("form.autoProcess")}
            hint={t("form.autoProcessHint")}
            checked={draft.postProduction.autoProcess}
            onCheckedChange={(autoProcess) => updatePostProduction({ autoProcess })}
          />
          <SwitchField
            emphasis
            label={t("form.autoPublish")}
            hint={t("form.autoPublishHint")}
            checked={draft.postProduction.autoPublish}
            onCheckedChange={(autoPublish) => updatePostProduction({ autoPublish })}
          />
        </div>
      </section>

      <section className="grid gap-3">
        <SectionLabel>{t("form.recording")}</SectionLabel>
        <SwitchField
          label={t("form.webcam")}
          hint={t("form.webcamHint")}
          checked={draft.recordingProfile.webcam}
          onCheckedChange={(webcam) =>
            update({ recordingProfile: { ...draft.recordingProfile, webcam } })
          }
        />
      </section>

      <section className="grid gap-3">
        <SectionLabel>{t("form.postProduction")}</SectionLabel>
        <div className="grid gap-3 md:grid-cols-2">
          {POST_PRODUCTION_TOGGLES.map((key) => (
            <SwitchField
              key={key}
              label={t(`form.${key}`)}
              hint={t(`form.${key}Hint`)}
              checked={draft.postProduction[key]}
              onCheckedChange={(checked) => updatePostProduction({ [key]: checked })}
            />
          ))}
        </div>
        <div className="grid gap-1.5">
          <span id="silence-preset-label" className="text-label">
            {t("form.silencePreset")}
          </span>
          <SegmentedControl<SilencePreset>
            aria-labelledby="silence-preset-label"
            className="w-full max-w-md"
            value={draft.postProduction.silencePreset}
            onValueChange={(silencePreset) => updatePostProduction({ silencePreset })}
            options={SILENCE_PRESETS.map((value) => ({
              value,
              label: t(`form.silencePresets.${value}`),
            }))}
          />
        </div>
      </section>
    </form>
  );
};
