# Design system

Live reference: open the app with `?view=styleguide` (or Settings ⚙ → "Xem bảng màu").
It shows every token in every palette × mode, the type scale and all UI primitives.

## Rules for area code (library / recording / review)

1. **No hard-coded colors.** No `#hex`, `rgb()`, `white`/`black`, or Tailwind palette
   classes (`bg-slate-700`, `text-red-400`, `text-sky-400`…). Use the semantic tokens below.
   Inline `style` colors must use `hsl(var(--token))`.
2. **No hard-coded UI strings.** Use `useT(namespace)`; numbers, dates, sizes and
   durations go through `useFormat()`.
3. **Red means "recording now" or "destructive".** Use `recording` for live/REC state,
   `destructive` for delete/discard/errors. Never use red for a normal status.
4. Every view starts with `<AppHeader>` (it contains the settings gear).
5. Lesson statuses are shown with `<LessonStatusBadge status=… />` only.
6. Avoid `dark:` variants — tokens already switch with the mode.
7. Prefer the primitives in `src/components/ui/*` over hand-styled elements.

## Color tokens

Defined in `src/theme/tokens.ts` (source of truth), generated into `src/index.css`.
Each is an HSL triplet used as `hsl(var(--name))`; Tailwind classes accept opacity
(`bg-success/10`).

| Token | Tailwind | Use for |
| --- | --- | --- |
| `background` / `foreground` | `bg-background` `text-foreground` | Page background and body text |
| `card` / `card-foreground` | `bg-card` | Raised panels, list rows, cards |
| `popover` / `popover-foreground` | `bg-popover` | Menus, dialogs, tooltips |
| `muted` / `muted-foreground` | `bg-muted` `text-muted-foreground` | Subtle fills; secondary text, hints, placeholders |
| `secondary` / `secondary-foreground` | `bg-secondary` | Neutral buttons, neutral solid badges |
| `accent` / `accent-foreground` | `hover:bg-accent` | Hover / selected rows, ghost button hover (palette-tinted) |
| `primary` / `primary-foreground` | `bg-primary` `text-primary` | Main action, links, focus, selection |
| `destructive` / `-foreground` | `bg-destructive` `text-destructive` | Delete, discard, error text |
| `success` / `-foreground` | `text-success` `bg-success/10` | Done, published, saved |
| `warning` / `-foreground` | `text-warning` | Needs attention, review, paused |
| `info` / `-foreground` | `text-info` | Neutral information, processing |
| `recording` / `-foreground` | `bg-recording` `text-recording` | Live REC indicator, record button — nothing else |
| `border` / `input` / `ring` | `border` (default) `border-input` `ring-ring` | Dividers / form borders / focus rings |
| `brand-from` / `brand-to` / `brand-foreground` | `bg-brand-gradient` `from-brand-from to-brand-to` `text-brand-foreground` `.text-brand-gradient` | Logo, hero areas, `Button variant="brand"` |

`tests/theme-tokens.test.ts` enforces WCAG AA (4.5:1) for every `*-foreground` on its
surface, `muted-foreground` on background/muted/card, colored text (`text-primary`,
`text-success`…) on the page, soft badges (`text-X` on `bg-X/10`), brand text on both
gradient ends, and 3:1 for `ring`.

## Palettes and modes

Palette ids: `dotnet` (default, purple #7C5CE0 + blue gradient), `recorder` (Remotion red;
the only palette where the brand is red), `ocean`, `emerald`, `slate`.
Modes: `light`, `dark`, `system` (follows `prefers-color-scheme`).

Applied on `<html>`: class `light`/`dark` + `data-palette="…"` + `lang`. An inline script in
`index.html` applies saved preferences before first paint.

To render something in a fixed theme (previews): `<ThemeScope palette="ocean" mode="dark">`
(`src/theme/ThemeScope.tsx`) — mode class and `data-palette` must be on the same element.

### Adding a palette

1. Add the id to `PALETTE_IDS` and a spec in `PALETTE_SPECS` (`src/theme/tokens.ts`).
2. Add it to the `palettes` array in the inline script of `index.html`.
3. Add `palette.<id>.{name,description}` to `src/i18n/locales/{vi,en}/settings.ts`.
4. `bun scripts/generate-theme-css.ts`, then `bun test tests/theme-tokens.test.ts`
   (tune lightness until AA passes).

## Preferences API (`src/theme/`)

```tsx
const { mode, resolvedMode, palette, locale, setMode, setPalette, setLocale } = usePreferences();
```

- `PreferencesProvider` is mounted in `src/main.tsx`; stored in `localStorage["crs:preferences"]`.
- `applyThemeToDocument(doc, theme?)` (`src/theme/preferences.ts`) copies mode/palette/lang to
  another document — `use-document-pip.ts` calls it when opening the PiP window.
- `useThemeMirror(pipWindow?.document ?? null)` keeps that document in sync live.
- Fonts (`src/theme/fonts.ts`) are plain `@font-face` rules in `<style id="app-fonts">`, so
  they are copied to the PiP window with the other stylesheets.

## Typography & spacing

Fonts: **Be Vietnam Pro** (`font-sans`, default) and **JetBrains Mono** (`font-mono`), with
latin, latin-ext and vietnamese subsets.

| Class | Size / line height | Use for |
| --- | --- | --- |
| `text-display` | 32/40 bold | Hero titles (rare) |
| `text-title` | 22/30 semibold | Page / section titles |
| `text-heading` | 16/24 semibold | Card titles, sub-sections |
| `text-body` | 14/22 | Default text |
| `text-label` | 13/18 medium | Form labels, header title |
| `text-caption` | 12/16 | Hints, metadata, badges |
| `text-overline uppercase` | 11/16 semibold, tracked | Group labels |
| `text-2xs` | 10/14 | Tiny counters only |
| `.timecode` | mono + tabular numbers | Timecodes, durations, sizes |

Spacing uses the 4px Tailwind scale: `gap-2`/`gap-3` inside controls, `p-4` panels,
`gap-6` between form sections, `gap-12` between page sections; page gutter `px-4 md:px-6`.
Header height: `h-header` (3.5rem). Radius: `rounded-md` controls, `rounded-lg` cards/panels,
`rounded-xl` hero blocks, `rounded-full` badges/pills (`--radius` = 0.625rem).

## Components (`src/components/`)

- `AppHeader` — `<AppHeader title leading actions subtitle compactBrand />`; includes `BrandMark`
  and the settings gear. `SettingsButton` / `SettingsDialog` can also be used standalone.
- `LessonStatusBadge` — `<LessonStatusBadge status="REVIEW" />`, localized. Mapping:
  DRAFT neutral · READY_TO_RECORD primary outline · RECORDED primary · PROCESSING info (pulse) ·
  REVIEW warning · PUBLISHED success · ARCHIVED neutral outline.
- `ui/button` — variants `default | brand | secondary | outline | ghost | link | destructive | recording`;
  sizes `default | xs | sm | lg | icon | icon-sm`.
- `ui/badge` — `tone` (`neutral|primary|success|warning|info|destructive|recording`) ×
  `variant` (`soft|solid|outline`), `dot`, `pulse`, `size="sm"`.
- `ui/alert` — `<Alert tone="destructive" title action>` banners.
- `ui/card`, `ui/progress` (`value` 0..1 or null = indeterminate, `tone`), `ui/tooltip`
  (CSS-only, `side`, `align`), `ui/segmented-control`, `ui/misc` (`Separator`, `Kbd`,
  `Textarea`, `Checkbox`, `RecordingIndicator`), plus `dialog` (now exports `DialogTrigger`,
  `DialogClose`), `dropdown-menu`, `select`, `input` (`aria-invalid` styling), `label`, `toggle`.

## i18n (`src/i18n/`)

Locales `vi` (default, source of truth) and `en`. One file per namespace and locale:

```
src/i18n/locales/vi/{common,library,recording,review,settings}.ts
src/i18n/locales/en/{common,library,recording,review,settings}.ts
```

Each area owns its namespace (`library`, `recording`, `review`) — edit only your files.
`common` holds shared actions, states, lesson statuses and counts.

```tsx
import { useT, useFormat, plural } from "../i18n";

const t = useT("library");                 // keys are type-checked
t("title");
t("example.withVariable", { lesson: name }); // {var} interpolation; numbers are localized
const tc = useT("common");
tc("count.lessons", { count: 3 });          // plural via Intl.PluralRules (+ optional `zero`)
tc(`lessonStatus.${status}`);

const f = useFormat();
f.formatDate(d); f.formatDateTime(d); f.formatRelativeTime(d);
f.formatNumber(n); f.formatPercent(0.42); f.formatBytes(bytes); f.formatDuration(ms); // "01:05", "1:02:05"
```

Adding keys: add to `vi/<ns>.ts` first (nested objects → dotted keys, `plural({ other, one?, zero? })`
for counts), then the same keys in `en/<ns>.ts`; TypeScript reports missing/extra keys and
`tests/i18n.test.ts` double-checks. Outside React use `translate(locale, ns, key, vars)`.
A missing key renders the key itself and logs `[i18n] Missing message`.
