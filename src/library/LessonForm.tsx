import { Trash2 } from "lucide-react";
import React, { useCallback, useState } from "react";
import type {
  Lesson,
  PostProduction,
  SilencePreset,
} from "../../config/course";
import { lessonPath as getLessonPath } from "../../config/course";
import { patchLesson } from "../actions/courses";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { StatusBadge } from "./StatusBadge";
import { Checkbox, Field, NativeSelect, TextArea } from "./form-fields";

const POST_PRODUCTION_TOGGLES: [keyof PostProduction, string][] = [
  ["autoTranscribe", "Transcribe automatically"],
  ["autoDetectSilence", "Detect silence"],
  ["autoRemoveSilence", "Remove detected silence (otherwise only suggested)"],
  ["generateChapters", "Generate chapters from markers"],
  ["intro", "Intro title card"],
  ["outro", "Outro end card"],
];

export const LessonForm: React.FC<{
  readonly lesson: Lesson;
  readonly onSaved: () => Promise<void>;
  readonly onRecord: (lessonPath: string) => void;
}> = ({ lesson, onSaved, onRecord }) => {
  const [draft, setDraft] = useState<Lesson>(lesson);
  const [busy, setBusy] = useState(false);
  const path = getLessonPath(lesson);

  const update = (patch: Partial<Lesson>) => {
    setDraft((d) => ({ ...d, ...patch }));
  };

  const updatePostProduction = (patch: Partial<PostProduction>) => {
    setDraft((d) => ({
      ...d,
      postProduction: { ...d.postProduction, ...patch },
    }));
  };

  const updateObjective = (index: number, value: string) => {
    update({
      objectives: draft.objectives.map((o, i) => (i === index ? value : o)),
    });
  };

  const save = useCallback(async () => {
    setBusy(true);
    try {
      const saved = await patchLesson(path, {
        title: draft.title.trim(),
        description: draft.description,
        objectives: draft.objectives.map((o) => o.trim()).filter(Boolean),
        notes: draft.notes,
        recordingProfile: draft.recordingProfile,
        postProduction: draft.postProduction,
        ...(draft.status === "DRAFT" ? { status: "READY_TO_RECORD" } : {}),
      });
      setDraft(saved);
      await onSaved();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setBusy(false);
    }
  }, [draft, onSaved, path]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    save();
  };

  return (
    <form onSubmit={onSubmit} className="grid gap-5">
      <div className="flex items-center gap-3">
        <h2 className="flex-1 truncate text-lg font-semibold">
          {lesson.title}
        </h2>
        <StatusBadge status={lesson.status} />
      </div>
      <Field label="Title" htmlFor="lesson-title">
        <Input
          id="lesson-title"
          value={draft.title}
          onChange={(e) => update({ title: e.target.value })}
        />
      </Field>
      <Field label="Description" htmlFor="lesson-description">
        <TextArea
          id="lesson-description"
          value={draft.description}
          onChange={(e) => update({ description: e.target.value })}
        />
      </Field>
      <Field label="Objectives">
        <div className="grid gap-2">
          {draft.objectives.map((objective, i) => (
            <div key={i} className="flex gap-2">
              <Input
                className="h-8"
                value={objective}
                placeholder={`Objective ${i + 1}`}
                onChange={(e) => updateObjective(i, e.target.value)}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8"
                title="Remove objective"
                onClick={() =>
                  update({
                    objectives: draft.objectives.filter((_, j) => j !== i),
                  })
                }
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="justify-self-start"
            onClick={() => update({ objectives: [...draft.objectives, ""] })}
          >
            Add objective
          </Button>
        </div>
      </Field>
      <Field label="Speaker notes" htmlFor="lesson-notes">
        <TextArea
          id="lesson-notes"
          className="min-h-[120px]"
          value={draft.notes}
          onChange={(e) => update({ notes: e.target.value })}
        />
      </Field>
      <Field label="Recording">
        <Checkbox
          label="Record webcam"
          checked={draft.recordingProfile.webcam}
          onChange={(webcam) =>
            update({
              recordingProfile: { ...draft.recordingProfile, webcam },
            })
          }
        />
      </Field>
      <Field label="Post-production">
        <div className="grid gap-2">
          {POST_PRODUCTION_TOGGLES.map(([key, label]) => (
            <Checkbox
              key={key}
              label={label}
              checked={draft.postProduction[key] as boolean}
              onChange={(checked) => updatePostProduction({ [key]: checked })}
            />
          ))}
          <div className="flex items-center gap-2 text-sm">
            <span className="whitespace-nowrap">Silence preset</span>
            <NativeSelect
              className="h-8 w-48"
              value={draft.postProduction.silencePreset}
              onChange={(e) =>
                updatePostProduction({
                  silencePreset: e.target.value as SilencePreset,
                })
              }
            >
              <option value="conservative">Conservative</option>
              <option value="balanced">Balanced</option>
              <option value="aggressive">Aggressive</option>
            </NativeSelect>
          </div>
        </div>
      </Field>
      <div className="flex gap-2">
        <Button type="submit" disabled={busy || !draft.title.trim()}>
          Save lesson
        </Button>
        <Button type="button" variant="outline" onClick={() => onRecord(path)}>
          Record this lesson
        </Button>
      </div>
    </form>
  );
};
