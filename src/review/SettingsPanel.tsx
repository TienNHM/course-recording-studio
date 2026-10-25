import React, { useEffect, useState } from "react";
import type { EditPlan } from "../../config/course";
import type { EditPlanPatch } from "../../scripts/server/production/edit-plan";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Checkbox, NativeSelect } from "../library/form-fields";
import { Panel } from "./Panel";

type Settings = Pick<EditPlan, "layout" | "outro"> & {
  introEnabled: boolean;
  title: string;
  subtitle: string;
};

const fromPlan = (plan: EditPlan, fallbackTitle: string): Settings => ({
  layout: plan.layout,
  outro: plan.outro,
  introEnabled: plan.intro !== null,
  title: plan.intro?.title ?? fallbackTitle,
  subtitle: plan.intro?.subtitle ?? "",
});

export const SettingsPanel: React.FC<{
  readonly plan: EditPlan;
  readonly lessonTitle: string;
  readonly hasWebcam: boolean;
  readonly disabled: boolean;
  readonly onSave: (patch: EditPlanPatch) => Promise<void>;
}> = ({ plan, lessonTitle, hasWebcam, disabled, onSave }) => {
  const [draft, setDraft] = useState(() => fromPlan(plan, lessonTitle));
  useEffect(() => {
    setDraft(fromPlan(plan, lessonTitle));
  }, [plan, lessonTitle]);

  const update = (patch: Partial<Settings>) =>
    setDraft((d) => ({ ...d, ...patch }));

  const dirty =
    JSON.stringify(draft) !== JSON.stringify(fromPlan(plan, lessonTitle));

  const save = () =>
    onSave({
      layout: draft.layout,
      outro: draft.outro,
      intro: draft.introEnabled
        ? {
            title: draft.title.trim() || lessonTitle,
            subtitle: draft.subtitle.trim() || null,
          }
        : null,
    });

  return (
    <Panel
      title="Layout, intro and outro"
      testId="settings-panel"
      actions={
        <Button
          type="button"
          size="sm"
          className="h-7"
          disabled={disabled || !dirty}
          onClick={save}
        >
          Save
        </Button>
      }
    >
      <div className="flex items-center gap-2 text-sm">
        <span className="w-16">Layout</span>
        <NativeSelect
          className="h-8 w-56"
          value={draft.layout}
          onChange={(e) =>
            update({ layout: e.target.value as EditPlan["layout"] })
          }
        >
          <option value="screen-only">Screen only</option>
          {hasWebcam ? (
            <option value="screen-webcam">Screen + webcam</option>
          ) : null}
        </NativeSelect>
        {hasWebcam ? null : (
          <span className="text-xs text-muted-foreground">
            No webcam was recorded
          </span>
        )}
      </div>
      <Checkbox
        label="Intro title card"
        checked={draft.introEnabled}
        onChange={(introEnabled) => update({ introEnabled })}
      />
      {draft.introEnabled ? (
        <div className="grid gap-2 pl-6">
          <Input
            className="h-8"
            aria-label="Intro title"
            placeholder="Title"
            value={draft.title}
            onChange={(e) => update({ title: e.target.value })}
          />
          <Input
            className="h-8"
            aria-label="Intro subtitle"
            placeholder="Subtitle (optional)"
            value={draft.subtitle}
            onChange={(e) => update({ subtitle: e.target.value })}
          />
        </div>
      ) : null}
      <Checkbox
        label="Outro end card"
        checked={draft.outro}
        onChange={(outro) => update({ outro })}
      />
    </Panel>
  );
};
