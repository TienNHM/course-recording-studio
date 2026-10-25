import {
  ArrowLeft,
  Bold,
  ChevronDown,
  Loader2,
  Monitor,
  Moon,
  Plus,
  Sun,
  Trash2,
} from "lucide-react";
import React, { useState } from "react";
import { lessonStatus } from "../../config/course";
import { AppHeader } from "../components/AppHeader";
import { LessonStatusBadge } from "../components/LessonStatusBadge";
import { Alert } from "../components/ui/alert";
import { Badge, type BadgeTone } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Checkbox,
  Kbd,
  RecordingIndicator,
  Separator,
  Textarea,
} from "../components/ui/misc";
import { Progress } from "../components/ui/progress";
import { SegmentedControl } from "../components/ui/segmented-control";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Toggle } from "../components/ui/toggle";
import { Tooltip } from "../components/ui/tooltip";
import { cn } from "../helpers/utils";
import { useFormat, useT } from "../i18n";
import { usePreferences } from "../theme/PreferencesProvider";
import { ThemeScope } from "../theme/ThemeScope";
import { TEXT_PAIRS, contrastRatio } from "../theme/contrast";
import {
  PALETTE_IDS,
  RESOLVED_MODES,
  THEMES,
  TOKEN_NAMES,
  hslTriplet,
  type PaletteId,
  type ResolvedMode,
  type TokenName,
} from "../theme/tokens";

const Section: React.FC<{
  readonly id: string;
  readonly title: string;
  readonly children: React.ReactNode;
}> = ({ id, title, children }) => (
  <section id={id} className="scroll-mt-20">
    <h2 className="mb-4 text-title">{title}</h2>
    {children}
  </section>
);

const Row: React.FC<{
  readonly label?: string;
  readonly children: React.ReactNode;
}> = ({ label, children }) => (
  <div className="flex flex-wrap items-center gap-3 py-2">
    {label ? (
      <span className="w-28 shrink-0 text-overline uppercase text-muted-foreground">
        {label}
      </span>
    ) : null}
    {children}
  </div>
);

const SURFACE_TOKENS: TokenName[] = [
  "background",
  "card",
  "muted",
  "secondary",
  "accent",
  "border",
];
const COLOR_TOKENS: TokenName[] = [
  "primary",
  "brand-from",
  "brand-to",
  "success",
  "warning",
  "info",
  "destructive",
  "recording",
];

/** One palette in one mode, rendered in its own ThemeScope. */
const PalettePreview: React.FC<{
  readonly palette: PaletteId;
  readonly mode: ResolvedMode;
}> = ({ palette, mode }) => {
  const t = useT("settings");
  const tc = useT("common");
  return (
    <ThemeScope
      palette={palette}
      mode={mode}
      className="flex flex-col gap-3 rounded-lg border p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-overline uppercase text-muted-foreground">
          {t(`mode.${mode}`)}
        </span>
        <span className="h-2 w-16 rounded-full bg-brand-gradient" />
      </div>
      <div className="grid grid-cols-6 gap-1.5">
        {SURFACE_TOKENS.map((name) => (
          <div
            key={name}
            title={`--${name}`}
            className="h-8 rounded-md border"
            style={{ background: `hsl(var(--${name}))` }}
          />
        ))}
      </div>
      <div className="grid grid-cols-8 gap-1.5">
        {COLOR_TOKENS.map((name) => (
          <div
            key={name}
            title={`--${name}`}
            className="h-8 rounded-md"
            style={{ background: `hsl(var(--${name}))` }}
          />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm">{tc("actions.save")}</Button>
        <Button size="sm" variant="outline">
          {tc("actions.cancel")}
        </Button>
        <Button size="sm" variant="link" className="px-0">
          {tc("actions.open")}
        </Button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <LessonStatusBadge status="REVIEW" />
        <LessonStatusBadge status="PUBLISHED" />
        <RecordingIndicator label={tc("recordingBadge.live")} />
      </div>
      <p className="text-caption text-muted-foreground">
        {t("styleguide.sampleText")}
      </p>
    </ThemeScope>
  );
};

const TokenTable: React.FC = () => {
  const t = useT("settings");
  const { palette, resolvedMode } = usePreferences();
  const tokens = THEMES[palette][resolvedMode];
  const pairFor = (name: TokenName) =>
    TEXT_PAIRS.filter(([fg]) => fg === name).map(([fg, bg]) => ({
      bg,
      ratio: contrastRatio(tokens[fg], tokens[bg]),
    }));

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-body">
        <thead className="bg-muted text-left text-overline uppercase text-muted-foreground">
          <tr>
            <th className="px-3 py-2" />
            <th className="px-3 py-2">CSS / Tailwind</th>
            <th className="px-3 py-2">HSL</th>
            <th className="px-3 py-2">WCAG</th>
          </tr>
        </thead>
        <tbody>
          {TOKEN_NAMES.map((name) => (
            <tr key={name} className="border-t">
              <td className="px-3 py-1.5">
                <span
                  className="block h-6 w-10 rounded border"
                  style={{ background: `hsl(var(--${name}))` }}
                />
              </td>
              <td className="px-3 py-1.5 font-mono text-caption">--{name}</td>
              <td className="timecode px-3 py-1.5 text-caption text-muted-foreground">
                {hslTriplet(tokens[name])}
              </td>
              <td className="px-3 py-1.5 text-caption">
                {pairFor(name).map(({ bg, ratio }) => (
                  <span
                    key={bg}
                    className={cn(
                      "mr-2 inline-block whitespace-nowrap",
                      ratio >= 4.5 ? "text-success" : "text-destructive",
                    )}
                  >
                    {bg}:{" "}
                    {t("styleguide.contrast", { ratio: ratio.toFixed(2) })}
                  </span>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const TYPE_SCALE = [
  ["text-display", "display"],
  ["text-title", "title"],
  ["text-heading", "heading"],
  ["text-body", "body"],
  ["text-label", "label"],
  ["text-caption", "caption"],
  ["text-overline uppercase", "overline"],
] as const;

const BUTTON_VARIANTS = [
  "default",
  "brand",
  "secondary",
  "outline",
  "ghost",
  "link",
  "destructive",
  "recording",
] as const;

const BADGE_TONES: BadgeTone[] = [
  "neutral",
  "primary",
  "success",
  "warning",
  "info",
  "destructive",
  "recording",
];

export const StyleguidePage: React.FC<{ readonly onBack: () => void }> = ({
  onBack,
}) => {
  const t = useT("settings");
  const tc = useT("common");
  const f = useFormat();
  const { mode, setMode, palette, setPalette } = usePreferences();
  const [progress, setProgress] = useState(0.62);
  const [segment, setSegment] = useState<"a" | "b" | "c">("a");

  const sections = t("styleguide.sections.palettes");

  return (
    <div className="flex h-full flex-col">
      <AppHeader
        leading={
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onBack}
            aria-label={t("styleguide.backToApp")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        }
        title={t("styleguide.title")}
      />
      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-6xl flex-col gap-12 px-4 py-8 md:px-6">
          <div className="flex flex-col gap-4">
            <h1 className="text-display">
              <span className="text-brand-gradient">
                {t("styleguide.title")}
              </span>
            </h1>
            <p className="max-w-2xl text-body text-muted-foreground">
              {t("styleguide.description")}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <SegmentedControl
                aria-label={t("mode.label")}
                value={mode}
                onValueChange={setMode}
                options={[
                  {
                    value: "light",
                    label: t("mode.light"),
                    icon: <Sun className="h-4 w-4" />,
                  },
                  {
                    value: "dark",
                    label: t("mode.dark"),
                    icon: <Moon className="h-4 w-4" />,
                  },
                  {
                    value: "system",
                    label: t("mode.system"),
                    icon: <Monitor className="h-4 w-4" />,
                  },
                ]}
              />
              <SegmentedControl
                aria-label={t("palette.label")}
                value={palette}
                onValueChange={setPalette}
                options={PALETTE_IDS.map((id) => ({
                  value: id,
                  label: t(`palette.${id}.name`),
                }))}
              />
            </div>
          </div>

          <Section id="palettes" title={sections}>
            <div className="flex flex-col gap-6">
              {PALETTE_IDS.map((id) => (
                <div key={id} className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-baseline gap-3">
                    <h3 className="text-heading">{t(`palette.${id}.name`)}</h3>
                    <span className="text-caption text-muted-foreground">
                      {t(`palette.${id}.description`)} · <code>{id}</code>
                    </span>
                    <div className="flex-1" />
                    {id === palette ? (
                      <Badge tone="primary" dot>
                        {t("palette.selected")}
                      </Badge>
                    ) : (
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() => setPalette(id)}
                      >
                        {t("styleguide.usePalette")}
                      </Button>
                    )}
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {RESOLVED_MODES.map((m) => (
                      <PalettePreview key={m} palette={id} mode={m} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section id="tokens" title={t("styleguide.sections.tokens")}>
            <TokenTable />
          </Section>

          <Section id="typography" title={t("styleguide.sections.typography")}>
            <div className="flex flex-col divide-y rounded-lg border bg-card">
              {TYPE_SCALE.map(([className, name]) => (
                <div key={name} className="flex items-baseline gap-4 px-4 py-3">
                  <code className="w-40 shrink-0 text-caption text-muted-foreground">
                    {className.split(" ")[0]}
                  </code>
                  <span className={className}>
                    {t("styleguide.sampleText")}
                  </span>
                </div>
              ))}
              <div className="flex items-baseline gap-4 px-4 py-3">
                <code className="w-40 shrink-0 text-caption text-muted-foreground">
                  font-mono
                </code>
                <code className="text-body">{t("styleguide.sampleCode")}</code>
              </div>
              <div className="flex items-baseline gap-4 px-4 py-3">
                <code className="w-40 shrink-0 text-caption text-muted-foreground">
                  timecode
                </code>
                <span className="timecode text-heading">
                  {f.formatDuration(65_000)} · {f.formatDuration(3_725_000)}
                </span>
              </div>
              <div className="flex items-baseline gap-4 px-4 py-3">
                <code className="w-40 shrink-0 text-caption text-muted-foreground">
                  useFormat()
                </code>
                <span className="text-body">
                  {f.formatDate(new Date())} · {f.formatNumber(1234567.89)} ·{" "}
                  {f.formatBytes(1_572_864_000)} · {f.formatPercent(0.42)} ·{" "}
                  {tc("count.lessons", { count: 1 })} ·{" "}
                  {tc("count.lessons", { count: 12 })}
                </span>
              </div>
              <div className="px-4 py-3">
                <p className="max-w-prose text-body">
                  {t("styleguide.sampleParagraph")}
                </p>
              </div>
            </div>
          </Section>

          <Section id="spacing" title={t("styleguide.sections.spacing")}>
            <Row label="radius">
              {(
                [
                  "rounded-sm",
                  "rounded-md",
                  "rounded-lg",
                  "rounded-xl",
                  "rounded-full",
                ] as const
              ).map((r) => (
                <div key={r} className="flex flex-col items-center gap-1">
                  <div
                    className={cn(
                      "h-12 w-12 border-2 border-primary bg-accent",
                      r,
                    )}
                  />
                  <code className="text-2xs text-muted-foreground">{r}</code>
                </div>
              ))}
            </Row>
            <Row label="spacing">
              {([1, 2, 3, 4, 6, 8, 12] as const).map((s) => (
                <div key={s} className="flex flex-col items-center gap-1">
                  <div
                    className="bg-primary"
                    style={{ width: s * 4, height: 24 }}
                  />
                  <code className="text-2xs text-muted-foreground">{s}</code>
                </div>
              ))}
            </Row>
          </Section>

          <Section id="buttons" title={t("styleguide.sections.buttons")}>
            {BUTTON_VARIANTS.map((variant) => (
              <Row key={variant} label={variant}>
                <Button variant={variant}>{tc("actions.save")}</Button>
                <Button variant={variant} size="sm">
                  <Plus className="h-4 w-4" />
                  {tc("actions.add")}
                </Button>
                <Button variant={variant} size="xs">
                  {tc("actions.edit")}
                </Button>
                <Button variant={variant} disabled>
                  {t("styleguide.states.disabled")}
                </Button>
                <Button variant={variant} disabled>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("styleguide.states.loading")}
                </Button>
                <Button
                  variant={variant}
                  size="icon"
                  aria-label={tc("actions.delete")}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </Row>
            ))}
          </Section>

          <Section id="badges" title={t("styleguide.sections.badges")}>
            {(["soft", "solid", "outline"] as const).map((variant) => (
              <Row key={variant} label={variant}>
                {BADGE_TONES.map((tone) => (
                  <Badge key={tone} tone={tone} variant={variant} dot>
                    {tone}
                  </Badge>
                ))}
              </Row>
            ))}
            <Row label="recording">
              <RecordingIndicator label={tc("recordingBadge.live")} />
              <RecordingIndicator label={tc("recordingBadge.paused")} paused />
              <Badge tone="info" pulse>
                {tc("lessonStatus.PROCESSING")}
              </Badge>
            </Row>
            <h3 className="mb-2 mt-6 text-heading">
              {t("styleguide.sections.lessonStatus")}
            </h3>
            <Row>
              {lessonStatus.options.map((status) => (
                <LessonStatusBadge key={status} status={status} />
              ))}
            </Row>
          </Section>

          <Section id="forms" title={t("styleguide.sections.forms")}>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="sg-input">
                  {t("styleguide.demo.inputLabel")}
                </Label>
                <Input
                  id="sg-input"
                  placeholder={t("styleguide.demo.inputPlaceholder")}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="sg-invalid">
                  {t("styleguide.demo.inputLabel")} (
                  {t("styleguide.states.invalid")})
                </Label>
                <Input id="sg-invalid" aria-invalid defaultValue="???" />
                <p className="text-caption text-destructive">
                  {tc("state.required")}
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="sg-disabled">
                  {t("styleguide.states.disabled")}
                </Label>
                <Input
                  id="sg-disabled"
                  disabled
                  placeholder={t("styleguide.demo.inputPlaceholder")}
                />
              </div>
              <div className="grid gap-2">
                <Label>{t("styleguide.demo.selectPlaceholder")}</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue
                      placeholder={t("styleguide.demo.selectPlaceholder")}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">01 · Giới thiệu</SelectItem>
                    <SelectItem value="2">02 · Cài đặt môi trường</SelectItem>
                    <SelectItem value="3">03 · Hello World</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2 md:col-span-2">
                <Label htmlFor="sg-textarea">Textarea</Label>
                <Textarea
                  id="sg-textarea"
                  placeholder={t("styleguide.sampleParagraph")}
                />
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-body">
                  <Checkbox defaultChecked /> {tc("state.on")}
                </label>
                <label className="flex items-center gap-2 text-body">
                  <Checkbox /> {tc("state.off")}
                </label>
                <label className="flex items-center gap-2 text-body">
                  <Checkbox disabled /> {t("styleguide.states.disabled")}
                </label>
                <Toggle aria-label="Bold">
                  <Bold className="h-4 w-4" />
                </Toggle>
                <Toggle variant="outline" defaultPressed aria-label="Bold">
                  <Bold className="h-4 w-4" />
                </Toggle>
              </div>
              <SegmentedControl
                aria-label="Segmented"
                value={segment}
                onValueChange={setSegment}
                options={[
                  { value: "a", label: "16:9" },
                  { value: "b", label: "1:1" },
                  { value: "c", label: "9:16" },
                ]}
              />
            </div>
          </Section>

          <Section id="feedback" title={t("styleguide.sections.feedback")}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between text-caption">
                  <span>{t("styleguide.demo.progressLabel")}</span>
                  <span className="timecode">{f.formatPercent(progress)}</span>
                </div>
                <Progress
                  value={progress}
                  label={t("styleguide.demo.progressLabel")}
                />
                <Progress value={progress} tone="brand" />
                <Progress value={0.35} tone="success" />
                <Progress value={0.8} tone="warning" />
                <Progress tone="info" label={tc("state.loading")} />
                <div className="flex gap-2">
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => setProgress((p) => Math.max(0, p - 0.1))}
                  >
                    −10%
                  </Button>
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => setProgress((p) => Math.min(1, p + 0.1))}
                  >
                    +10%
                  </Button>
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <Alert tone="info" title={tc("state.loading")}>
                  {t("styleguide.demo.progressLabel")}
                </Alert>
                <Alert tone="success" title={tc("actions.copied")} />
                <Alert tone="warning" title={tc("state.unsavedChanges")} />
                <Alert
                  tone="destructive"
                  title={tc("state.error")}
                  action={
                    <Button size="xs" variant="outline">
                      {tc("actions.retry")}
                    </Button>
                  }
                >
                  {tc("state.errorWithMessage", { message: "ENOSPC" })}
                </Alert>
                <div className="flex items-center gap-3">
                  <Tooltip content={t("styleguide.demo.tooltip")}>
                    <Button variant="outline" size="sm">
                      Tooltip
                    </Button>
                  </Tooltip>
                  <span className="text-caption text-muted-foreground">
                    <Kbd>R</Kbd> <Kbd>Space</Kbd> <Kbd>Ctrl</Kbd>+<Kbd>Z</Kbd>
                  </span>
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                </div>
              </div>
            </div>
          </Section>

          <Section id="surfaces" title={t("styleguide.sections.surfaces")}>
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle>{t("styleguide.demo.cardTitle")}</CardTitle>
                  <CardDescription>
                    {t("styleguide.demo.cardBody")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-1.5">
                  <LessonStatusBadge status="RECORDED" />
                  <Badge>{tc("count.lessons", { count: 12 })}</Badge>
                </CardContent>
                <CardFooter>
                  <Button size="sm">{tc("actions.open")}</Button>
                </CardFooter>
              </Card>
              <Card className="flex flex-col items-start gap-3 p-4">
                <span className="text-overline uppercase text-muted-foreground">
                  Dialog
                </span>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                      <Trash2 className="h-4 w-4" />
                      {tc("actions.delete")}
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>
                        {t("styleguide.demo.dialogTitle")}
                      </DialogTitle>
                      <DialogDescription>
                        {t("styleguide.demo.dialogBody")}
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2">
                      <DialogClose asChild>
                        <Button variant="outline">
                          {tc("actions.cancel")}
                        </Button>
                      </DialogClose>
                      <DialogClose asChild>
                        <Button variant="destructive">
                          {tc("actions.delete")}
                        </Button>
                      </DialogClose>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                <Separator />
                <span className="text-overline uppercase text-muted-foreground">
                  Menu
                </span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      {t("styleguide.demo.menu")}
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuLabel>{tc("actions.more")}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>{tc("actions.edit")}</DropdownMenuItem>
                    <DropdownMenuItem>{tc("actions.copy")}</DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive focus:text-destructive">
                      {tc("actions.delete")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </Card>
              <div className="flex flex-col justify-end gap-3 rounded-xl bg-brand-gradient p-5 text-brand-foreground">
                <span className="text-overline uppercase opacity-90">
                  bg-brand-gradient
                </span>
                <span className="text-title">{tc("appName")}</span>
                <span className="text-body opacity-90">{tc("appTagline")}</span>
              </div>
            </div>
          </Section>
        </div>
      </main>
    </div>
  );
};
