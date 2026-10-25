import { ExternalLink, Monitor, MonitorPlay } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import type { EditPlan, VideoStyle } from "../../config/course";
import type { EditPlanPatch } from "../../scripts/server/production/edit-plan";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Checkbox } from "../components/ui/misc";
import { SegmentedControl } from "../components/ui/segmented-control";
import { useT } from "../i18n";
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

const StyleRow: React.FC<{
  readonly label: string;
  readonly value: React.ReactNode;
}> = ({ label, value }) => (
  <div className="flex items-center justify-between gap-3 py-1">
    <dt className="text-caption text-muted-foreground">{label}</dt>
    <dd className="text-label">{value}</dd>
  </div>
);

export const SettingsPanel: React.FC<{
  readonly plan: EditPlan;
  readonly lessonTitle: string;
  readonly hasWebcam: boolean;
  readonly videoStyle: VideoStyle | null;
  readonly disabled: boolean;
  readonly resetToken: number;
  readonly onSave: (patch: EditPlanPatch) => Promise<boolean>;
  readonly onDirtyChange: (dirty: boolean) => void;
  readonly onOpenLibrary: () => void;
}> = ({
  plan,
  lessonTitle,
  hasWebcam,
  videoStyle,
  disabled,
  resetToken,
  onSave,
  onDirtyChange,
  onOpenLibrary,
}) => {
  const t = useT("review");
  const ts = useT("settings");
  const tc = useT("common");
  const [draft, setDraft] = useState(() => fromPlan(plan, lessonTitle));
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setDraft(fromPlan(plan, lessonTitle));
  }, [plan, lessonTitle, resetToken]);

  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(fromPlan(plan, lessonTitle)),
    [draft, lessonTitle, plan],
  );
  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  const update = (patch: Partial<Settings>) =>
    setDraft((d) => ({ ...d, ...patch }));

  const save = async () => {
    setSaving(true);
    try {
      await onSave({
        layout: draft.layout,
        outro: draft.outro,
        intro: draft.introEnabled
          ? {
              title: draft.title.trim() || lessonTitle,
              subtitle: draft.subtitle.trim() || null,
            }
          : null,
      });
    } finally {
      setSaving(false);
    }
  };

  const onOff = (value: boolean) =>
    value ? tc("state.on") : tc("state.off");

  return (
    <div className="grid gap-6">
      <Panel title={t("settings.title")} testId="settings-panel">
        <div className="grid gap-2">
          <Label id="review-layout-label">{t("settings.layout")}</Label>
          <SegmentedControl
            aria-labelledby="review-layout-label"
            className="w-full"
            value={draft.layout}
            onValueChange={(layout) => {
              if (!disabled && (layout === "screen-only" || hasWebcam)) {
                update({ layout });
              }
            }}
            options={[
              {
                value: "screen-only",
                label: t("settings.screenOnly"),
                icon: <Monitor className="h-4 w-4" aria-hidden />,
              },
              ...(hasWebcam
                ? [
                    {
                      value: "screen-webcam" as const,
                      label: t("settings.screenWebcam"),
                      icon: <MonitorPlay className="h-4 w-4" aria-hidden />,
                    },
                  ]
                : []),
            ]}
          />
          {hasWebcam ? null : (
            <p className="text-caption text-muted-foreground">
              {t("settings.noWebcam")}
            </p>
          )}
        </div>

        <div className="grid gap-2">
          <label className="flex items-center gap-2 text-label">
            <Checkbox
              checked={draft.introEnabled}
              disabled={disabled}
              onChange={(e) => update({ introEnabled: e.target.checked })}
            />
            {t("settings.intro")}
          </label>
          {draft.introEnabled ? (
            <div className="grid gap-2 pl-6">
              <Input
                className="h-9"
                aria-label={t("settings.introTitle")}
                placeholder={t("settings.introTitle")}
                value={draft.title}
                disabled={disabled}
                onChange={(e) => update({ title: e.target.value })}
              />
              <Input
                className="h-9"
                aria-label={t("settings.introSubtitle")}
                placeholder={t("settings.introSubtitle")}
                value={draft.subtitle}
                disabled={disabled}
                onChange={(e) => update({ subtitle: e.target.value })}
              />
            </div>
          ) : null}
          <label className="flex items-center gap-2 text-label">
            <Checkbox
              checked={draft.outro}
              disabled={disabled}
              onChange={(e) => update({ outro: e.target.checked })}
            />
            {t("settings.outro")}
          </label>
        </div>

        {dirty ? (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-2">
            <span className="flex-1 text-caption">{t("tabs.unsaved")}</span>
            <Button
              type="button"
              size="xs"
              variant="ghost"
              disabled={saving}
              onClick={() => setDraft(fromPlan(plan, lessonTitle))}
            >
              {t("settings.discard")}
            </Button>
            <Button
              type="button"
              size="xs"
              disabled={disabled || saving}
              onClick={save}
            >
              {t("settings.save")}
            </Button>
          </div>
        ) : null}
      </Panel>

      {videoStyle ? (
        <Panel
          title={t("settings.style.title")}
          description={t("settings.style.description")}
          className="rounded-lg border bg-muted/30 p-3"
          testId="video-style-summary"
        >
          <dl className="grid divide-y">
            <StyleRow
              label={t("settings.style.palette")}
              value={ts(`palette.${videoStyle.palette}.name`)}
            />
            <StyleRow
              label={t("settings.style.intro")}
              value={t(`settings.style.introStyle.${videoStyle.intro}`)}
            />
            <StyleRow
              label={t("settings.style.transition")}
              value={t(`settings.style.transitionStyle.${videoStyle.transition}`)}
            />
            <StyleRow
              label={t("settings.style.chapterCards")}
              value={onOff(videoStyle.chapterCards)}
            />
            <StyleRow
              label={t("settings.style.lowerThird")}
              value={onOff(videoStyle.lowerThird)}
            />
            <StyleRow
              label={t("settings.style.progressBar")}
              value={onOff(videoStyle.progressBar)}
            />
            <StyleRow
              label={t("settings.style.backgroundMusic")}
              value={onOff(videoStyle.backgroundMusic)}
            />
          </dl>
          <div>
            <Button type="button" size="xs" variant="outline" onClick={onOpenLibrary}>
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              {t("settings.style.open")}
            </Button>
          </div>
        </Panel>
      ) : null}
    </div>
  );
};
