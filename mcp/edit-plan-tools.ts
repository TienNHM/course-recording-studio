// Agent-friendly view of an EditPlan (pure, unit-tested).
import type { EditPlan } from "../config/course";

type CutReason = EditPlan["cuts"][number]["reason"];

export type EditPlanSummary = {
  takeId: string;
  originalDurationMs: number;
  keptDurationMs: number;
  removedDurationMs: number;
  segments: number;
  acceptedCuts: number;
  suggestedCuts: number;
  // Time that would additionally be removed by accepting every suggestion.
  suggestedDurationMs: number;
  byReason: Record<CutReason, { accepted: number; suggested: number }>;
  cuts: {
    index: number;
    reason: CutReason;
    accepted: boolean;
    startMs: number;
    endMs: number;
    durationMs: number;
    range: string;
  }[];
  chapters: EditPlan["chapters"];
  layout: EditPlan["layout"];
  intro: EditPlan["intro"];
  outro: boolean;
};

export const formatMs = (ms: number) => {
  const total = Math.max(0, Math.round(ms / 100)) / 10;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = (total % 60).toFixed(1).padStart(4, "0");
  const mm = String(m).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${s}` : `${mm}:${s}`;
};

export const summarizeEditPlan = (plan: EditPlan): EditPlanSummary => {
  const originalDurationMs =
    plan.durationMs ??
    Math.max(
      0,
      ...plan.segments.map((s) => s.endMs),
      ...plan.cuts.map((c) => c.endMs),
    );
  const keptDurationMs = plan.segments.reduce(
    (n, s) => n + (s.endMs - s.startMs),
    0,
  );
  const byReason: EditPlanSummary["byReason"] = {
    silence: { accepted: 0, suggested: 0 },
    marker: { accepted: 0, suggested: 0 },
    trim: { accepted: 0, suggested: 0 },
  };
  for (const cut of plan.cuts) {
    byReason[cut.reason][cut.accepted ? "accepted" : "suggested"]++;
  }
  const suggestions = plan.cuts.filter((c) => !c.accepted);
  return {
    takeId: plan.takeId,
    originalDurationMs,
    keptDurationMs,
    removedDurationMs: Math.max(0, originalDurationMs - keptDurationMs),
    segments: plan.segments.length,
    acceptedCuts: plan.cuts.length - suggestions.length,
    suggestedCuts: suggestions.length,
    suggestedDurationMs: suggestions.reduce(
      (n, c) => n + (c.endMs - c.startMs),
      0,
    ),
    byReason,
    cuts: plan.cuts.map((c, index) => ({
      index,
      reason: c.reason,
      accepted: c.accepted,
      startMs: c.startMs,
      endMs: c.endMs,
      durationMs: c.endMs - c.startMs,
      range: `${formatMs(c.startMs)}–${formatMs(c.endMs)}`,
    })),
    chapters: plan.chapters,
    layout: plan.layout,
    intro: plan.intro,
    outro: plan.outro,
  };
};

export const describeEditPlan = (s: EditPlanSummary) =>
  [
    `Take ${s.takeId}: ${formatMs(s.originalDurationMs)} recorded → ${formatMs(
      s.keptDurationMs,
    )} kept in ${s.segments} segment(s).`,
    `${s.acceptedCuts} accepted cut(s), ${s.suggestedCuts} suggestion(s) not applied` +
      (s.suggestedCuts > 0
        ? ` (${formatMs(s.suggestedDurationMs)} more could be removed).`
        : "."),
    `${s.chapters.length} chapter(s); layout ${s.layout}; intro ${
      s.intro ? `"${s.intro.title}"` : "off"
    }; outro ${s.outro ? "on" : "off"}.`,
  ].join("\n");
