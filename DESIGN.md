---
name: Online Chess
description: Real-time tournament chess arena featuring digital clocks, ELO matchmaking, and Minimax AI analysis.
colors:
  obsidian-ink: "#0f172a"
  body-slate: "#1e293b"
  secondary-slate: "#475569"
  muted-slate: "#64748b"
  hairline-border: "#e2e8f0"
  subtle-surface: "#f1f5f9"
  chalk-canvas: "#f8fafc"
  pure-card: "#ffffff"
  tactical-sky: "#0369a1"
  tactical-sky-deep: "#075985"
  focus-sky: "#0284c7"
  sky-tint: "#f0f9ff"
  ice-badge: "#e0f2fe"
  tournament-blue: "#4b7399"
  ice-square: "#f0f5fa"
  board-highlight-light: "#bae6fd"
  board-highlight-dark: "#3b6ea5"
  clock-amber: "#d97706"
  amber-text: "#b45309"
  check-crimson: "#be123c"
  victory-emerald: "#047857"
typography:
  display:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "3.75rem"
    fontWeight: 800
    lineHeight: 1.12
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.35
    letterSpacing: "-0.02em"
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "0em"
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0em"
  mono-clock:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
rounded:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  full: "9999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.obsidian-ink}"
    textColor: "{colors.pure-card}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
  button-primary-hover:
    backgroundColor: "{colors.body-slate}"
    textColor: "{colors.pure-card}"
  button-secondary:
    backgroundColor: "{colors.pure-card}"
    textColor: "{colors.body-slate}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "10px 14px"
  button-tactical:
    backgroundColor: "{colors.tactical-sky}"
    textColor: "{colors.pure-card}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
  button-danger:
    backgroundColor: "{colors.pure-card}"
    textColor: "{colors.check-crimson}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "10px 14px"
  input-field:
    backgroundColor: "{colors.chalk-canvas}"
    textColor: "{colors.obsidian-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
  card-surface:
    backgroundColor: "{colors.pure-card}"
    textColor: "{colors.body-slate}"
    rounded: "{rounded.lg}"
    padding: "24px"
  chip-time-control:
    backgroundColor: "{colors.chalk-canvas}"
    textColor: "{colors.body-slate}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "6px 12px"
  clock-active:
    backgroundColor: "{colors.tactical-sky}"
    textColor: "{colors.pure-card}"
    typography: "{typography.mono-clock}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  clock-urgent:
    backgroundColor: "{colors.check-crimson}"
    textColor: "{colors.pure-card}"
    typography: "{typography.mono-clock}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
---

# Design System: Online Chess

## Overview

**Creative North Star: "The Tournament Chess Hall"**

Online Chess embodies the discipline and clarity of an international tournament hall. Every layout centers attention on the 64-square arena, while surrounding player cards, digital clocks, notation sheets, and matchmaking queues remain calm, glare-free, and strictly utilitarian so nothing competes with move calculation.

The visual system rejects generic SaaS decoration—no rainbow hero gradients, no heavy drop shadows, and no ambiguous status dots without labels. Contrast comes from crisp obsidian controls anchored on cool chalk-white surfaces, punctuated sparingly by tactical sky highlights for legal moves, selected pieces, and keyboard focus.

**Key Characteristics:**
- **Board-first hierarchy:** The square board dominates visual contrast while clocks, notation grids, and sidebars recede cleanly into slate-tinted surfaces.
- **Tactile precision:** Interactive controls respond within 150ms (`0.96`–`0.98` active press scale) and maintain at least a `44px` minimum touch target on mobile viewports.
- **Tabular tournament telemetry:** All digital clocks, ELO ratings, move counters, and room codes lock onto monospace tabular digits to prevent horizontal jitter during live countdowns.
- **Token-driven themes:** Semantic CSS custom properties in `:root` and `:root[data-theme="dark"], .dark` govern light canvases, board squares, highlights, piece silhouettes, and focus rings without hard-coded component colors.

## Colors

A cool chalk-and-obsidian neutral foundation paired with deliberate tournament blue squares and a single tactical sky accent reserved for active selection and interactive affordances.

### Primary
- **Obsidian Ink** (`--chess-obsidian`): Primary filled action buttons, brand emblems, active hero CTAs, and high-emphasis typography that ground interactive focus.
- **Tactical Sky** (`--chess-primary`): Selected move pills, active player turn clocks, outgoing chat bubbles, links, and active room entry actions. Passes WCAG AA contrast against white text (`5.93:1` light mode).
- **Tactical Sky Deep** (`--chess-primary-hover`): Hover and pressed feedback state for Tactical Sky interactive actions.
- **Focus Sky** (`--chess-focus`): Keyboard `:focus-visible` outlines (`2px` white inner halo + `2px` sky outer ring) and selected square borders on the board.

### Secondary
- **Tournament Blue** (`--chess-board-dark`): High-visibility classic dark chessboard squares (`4.55:1` contrast with white coordinate labels).
- **Ice Square** (`--chess-board-light`): Glare-free pale blue-white light squares (`#f0f5fa`) paired with Obsidian coordinate labels for effortless piece silhouette separation.
- **Board Highlight Light & Dark** (`--chess-board-highlight-light`, `--chess-board-highlight-dark`): Origin and destination last-move markers preserving full coordinate and piece legibility.

### Tertiary
- **Clock Amber** (`--chess-clock-amber`) & **Amber Text** (`--chess-amber-text`): Unverified email warnings, draw-offer confirmation accents, and tournament time prompts (always paired with explicit text or icons).
- **Check Crimson** (`--chess-danger`): King-in-check warnings, sub-30-second clock urgency states, resign actions, and inline validation errors.
- **Victory Emerald** (`--chess-success`): Positive material advantage counters, ELO gains, active account badges, and verified confirmation banners.

### Neutral
- **Chalk Canvas** (`--chess-bg`): Application-wide page background reducing glare behind long sessions.
- **Pure Card** (`--chess-card`): Elevated panel and modal backgrounds (`#ffffff` in light mode).
- **Subtle Surface** (`--chess-surface`): Recessed wells for inactive clocks, score tables, notation containers, and neutral badges.
- **Hairline Border** (`--chess-border`): Crisp `1px` structural borders separating cards and table rows cleanly without heavy shadows.
- **Body Slate** (`--chess-ink`), **Secondary Slate**, & **Muted Slate** (`--chess-ink-muted`): Three-step dark-to-medium ink ramp ensuring readable copy, metadata, and `>= 4.5:1` input placeholders.

### Chessboard & Dark-Mode Token Architecture
All board square colors, move hint dots (`--chess-board-hint-dot`), capture rings (`--chess-board-capture-ring`), check radial spotlights, SVG piece fills/strokes, scrollbars, and focus halos live as CSS custom properties in `apps/web/src/index.css` (`:root`), mapped cleanly into Tailwind's `chess.*` namespace in `apps/web/tailwind.config.js`. Opt-in dark mode tokens are pre-defined under `:root[data-theme="dark"], .dark` (`darkMode: ['class', '[data-theme="dark"]']`) so dark-themed views swap surfaces cleanly without disturbing light defaults.

### Named Rules
**The One Primary Action Rule.** Limit each view or card group to one Obsidian filled primary button; secondary actions remain chalk-white with hairline slate borders or neutral tint fills.
**The Paired Status Rule.** Never convey check, draw offers, clock urgency, or account locks by color alone—pair semantic tints with explicit text labels or icons.
**The Single Token Source Rule.** Define colors exclusively via Tailwind design tokens or CSS custom properties (`--chess-*`); never scatter raw hex or `rgba()` literals inside feature components (excluding external third-party brand logos).

## Typography

**Display & Body Font:** Native system UI stack (`-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`) for instant zero-CLS rendering and native Vietnamese diacritic clarity.
**Label & Clock Mono Font:** System monospace stack (`ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace`) with `font-variant-numeric: tabular-nums`.

**Character:** Fast, legible, utilitarian Swiss-inspired hierarchy optimized for Vietnamese tournament interfaces and rapid side-by-side numeric scanning.

### Hierarchy
- **Display** (`800`, `36px`–`60px` / `2.25rem`–`3.75rem`, `1.12` line-height, `-0.02em` tracking): Landing hero statement centered above the interactive board preview.
- **Headline** (`800`, `24px`–`30px` / `1.5rem`–`1.875rem`, `1.2` line-height, `-0.02em` tracking): Route page `<h1>` titles (`/lobby`, `/profile`, `/leaderboard`, `/history`, `/admin`, auth screens).
- **Title** (`700`, `18px`–`20px` / `1.125rem`–`1.25rem`, `1.35` line-height, `-0.02em` tracking): Card section headings, modal titles, and match status headers.
- **Body** (`400`–`500`, `14px`–`16px` / `0.875rem`–`1rem`, `1.6` line-height): Explanatory copy, chat messages, and empty-state instructions (`65ch` max measure for readable paragraphs).
- **Label** (`600`–`700`, `12px` / `0.75rem`, `1.4` line-height): Form labels, navigation items, button labels, time-control chips, and metadata tags. Avoid decorative all-caps eyebrow tags except true board notation badges.
- **Mono Clock** (`700`, `14px`–`18px` / `0.875rem`–`1.125rem`, `tabular-nums`, `-0.02em` tracking): Countdown clocks (`MM:SS`), ELO badges, SAN algebraic notation (`1. e4 c5`), and 6-character room invite codes.

### Named Rules
**The Tabular Lock Rule.** Apply monospace tabular figures (`font-mono tabular-nums`) to every live clock, timer, ELO score, rank, and ply index so digits never shift sideways mid-game.
**The Sentence Case Rule.** Use natural sentence case for controls and labels; avoid shouting uppercase micro-labels over standard UI fields.
**The Mobile Auto-Zoom Floor Rule.** Keep form inputs at `16px` on mobile viewports stepping down to `14px` on desktop (`text-base sm:text-sm`) to prevent Safari auto-zoom.

## Layout

Pages center inside a generous `max-w-7xl` container (`1280px`) with `16px` horizontal padding on mobile and `24px` on `sm+` breakpoints, plus `env(safe-area-inset-*)` support (`.safe-x`, `.safe-bottom`) enabled by `viewport-fit=cover`.

Live arena routes (`/game/:id`, `/ai`, `/history`) split cleanly on desktop (`lg:grid-cols-12` or `lg:flex-row`) into a left column (`max-w-[550px]`–`max-w-2xl`) stacking Top Player Bar → Square Interactive Chessboard (`aspect-square` with `touch-none select-none`) → Bottom Player Bar → Action Toolbar, paired with a `384px` (`lg:w-96`) or 5-column right sidebar housing Move History (SAN) and In-Game Chat or Match Insights. On mobile (`< 1024px`), columns collapse vertically in exact reading order while keeping all flex children guarded with `min-w-0` and data tables inside `overflow-x-auto`.

Spacing rhythm favors vertical gaps (`gap-4`, `gap-6`, `gap-8`) over heavy divider lines, and guarantees a strict minimum `44×44px` hit target for every interactive button and control on touch screens.

## Elevation & Depth

Surfaces establish quiet hierarchy primarily through tonal contrast (chalk background vs pure-white cards) and hairline borders (`1px` slate-200), reinforced by subtle multi-layered shadows anchored in low-opacity slate tint rather than harsh pure black.

### Shadow Vocabulary
- **Subtle** (`0 1px 3px 0 rgba(15, 23, 42, 0.04), 0 1px 2px -1px rgba(15, 23, 42, 0.03)`): Secondary white buttons, toolbar controls, captured piece pills, and resting player strips.
- **Card** (`0 1px 3px 0 rgba(15, 23, 42, 0.05), 0 1px 2px -1px rgba(15, 23, 42, 0.03)`): Feature pillars, leaderboard table containers, move history panels, and board containers.
- **Card Hover** (`0 8px 24px -4px rgba(15, 23, 42, 0.08), 0 4px 8px -2px rgba(15, 23, 42, 0.03)`): Interactive hover lift for public room cards and clickable quick-play panels.
- **Modal** (`0 20px 25px -5px rgba(15, 23, 42, 0.12), 0 8px 10px -6px rgba(15, 23, 42, 0.06)`): Game-over overlays, room setup dialogs, promotion picker, and resign confirmations.
- **Glow Primary** (`0 0 24px -4px rgba(2, 132, 199, 0.35)`): Reserved strictly for featured interactive focus states rather than ambient decoration.

### Named Rules
**The Flat-By-Default Rule.** Restful surfaces rely on border contrast and chalk-vs-white separation first; deeper elevation is reserved for interactive hover lift and blocking modal overlays.

## Shapes

Online Chess uses clean architectural rectangles softened with disciplined radii that satisfy the concentric nesting equation (`R_outer = R_inner + padding + border`):
- **Outer modal shells & featured arenas** take generous `24px` (`1.5rem`) corners (`R_outer`) framing `16px`–`24px` inner panels.
- **Primary cards & interactive board housings** use `16px` (`1rem`) outer radii wrapping inner `12px`–`14px` board grids cleanly (`R_inner = 12px` + `12px` padding -> concentric alignment).
- **Buttons, fields, icon containers, and toolbars** standardize on `12px` (`0.75rem`) radii for a consistent, confident silhouette, with `8px` (`0.5rem`) reserved for compact move notation buttons and inline badges, and `9999px` (`full`) strictly for ELO pills, status chips, and circular modal close icons.

## Components

### Buttons
Cohesive tactile controls with immediate `150ms` response and `0.96`–`0.98` active press scale.
- **Shape:** Balanced medium radius (`12px`, compact pills `8px`), minimum `44px` height on touch viewports.
- **Primary:** Deep Obsidian surface (`--chess-obsidian`, `#0f172a`) with crisp white semibold/bold label (`10px 16px` to `14px 24px` padding). Hover shifts to Slate-800; never uses glossy gradients.
- **Tactical Accent:** Tactical Sky surface (`--chess-primary`, `#0369a1`) with white bold text for in-game invite confirmations, chat submit, draw offers, and direct room joins. Hover darkens to `#075985`.
- **Secondary:** Pure white card surface (`#ffffff`) with Slate-800 label and `1px` Slate-200/300 border. Hover shifts to Slate-50.
- **Danger / Destructive:** Rose-tinted outline (`border-rose-200`, Check Crimson label) or filled crimson only inside explicit confirm-resign dialogs.
- **Hover / Focus:** Explicit color/transform transitions (avoiding `transition: all`) and high-contrast Focus Sky (`#0284c7`) outer ring with white inner offset halo.

### Chips
Compact selectable options and telemetry tags built around monospaced legibility.
- **Style:** Chalk background (`#f8fafc`), `1px` hairline Slate-200 border, `8px` corners, crisp sans or mono labels (`12px`), min `44px` touch height on mobile.
- **State:** Active/selected chip flips cleanly to solid Obsidian fill with white bold text (`aria-pressed="true"`), while inactive chips brighten subtly on hover.

### Cards / Containers
Structured calm containers holding game panels, room entries, and match statistics.
- **Corner Style:** Smooth large container radius (`16px`).
- **Background:** Pure white (`#ffffff`) over Chalk Canvas (`#f8fafc`), using Slate-50 only for recessed read-only sub-wells (like SAN grids or ELO comparison blocks).
- **Shadow Strategy:** Crisp `1px` Slate-200 hairline border (`border-slate-200/80`) plus ambient `card` shadow; interactive public room cards lift to `card-hover`.
- **Internal Padding:** `16px` (`p-4`) for compact game widgets and `24px` (`p-6`) for page cards.

### Inputs / Fields
Glare-free text, search, and OTP inputs engineered for mobile clarity and screen-reader precision.
- **Style:** Chalk surface (`#f8fafc`), `1px` Slate-200 stroke, `12px` radius, minimum `44px` height, `16px` mobile / `14px` desktop font (`text-base sm:text-sm`), and `4.5:1` visible Slate-500 placeholders (`opacity: 1`).
- **Focus:** Shifts background cleanly to pure white (`#ffffff`), deepens border to Focus Sky/Slate-800, and applies the visible `2px` sky ring.
- **Error / Disabled:** Pairs crimson `role="alert"` helper copy bound via `aria-describedby` and `aria-invalid="true"`; never clips long validation strings.

### Navigation
Sticky full-width header (`64px` height) with `safe-x` horizontal padding, Obsidian King brand mark, single-row desktop pill links (`aria-current="page"` highlighted in Sky-50 / Sky-700), compact user ELO badge linking to Profile, and a `44×44px` hamburger toggle opening an accessible `Escape`-dismissible mobile navigation drawer.

### Tournament Chessboard & Player Clock
Signature two-part match centerpiece:
- **Chessboard Frame:** Square aspect container (`p-2.5 sm:p-3 rounded-2xl`), `.board-touch-surface` (`touch-action: none; user-select: none`) on live playable boards, Tournament Blue dark squares (`--chess-board-dark`), Ice Square light squares (`--chess-board-light`), token-based legal move dots, crimson capture rings, and check radial alerts.
- **Isolated `<PlayerClock>`:** Self-contained monospace `tabular-nums` display (`rounded-xl`, `px-3.5 py-1.5`) switching cleanly between resting Slate-100, active Tactical Sky (`bg-sky-700 text-white`), and urgent sub-30s Crimson alert (`bg-rose-600 text-white animate-pulse`).

## Do's and Don'ts

### Do:
- **Do** keep every interactive control's tap area at least `44×44px` on touch devices while hiding verbose toolbar labels only when accompanied by clear `aria-label` descriptions.
- **Do** wrap every interactive dialog inside `useDialogFocusTrap`, pair form inputs with explicit `<label htmlFor>`, and drive every chessboard color from `--chess-*` CSS tokens.
- **Do** preserve `tabular-nums font-mono` on all clocks, ELO badges, rank positions, and SAN move coordinates.
- **Do** honor `prefers-reduced-motion: reduce` in both CSS transitions and JavaScript celebration effects (`fireConfetti`).

### Don't:
- **Don't** place `touch-none` on read-only replay or landing demo chessboards, or vertical touch scrolling gets trapped on mobile viewports.
- **Don't** animate layout geometry or scatter raw `#hex` / `rgba()` color values directly inside JSX components when semantic `--chess-*` CSS variables or Tailwind `chess.*` tokens exist.
- **Don't** introduce arbitrary gradient text headlines, multiple competing primary solid buttons in the same section, or decorative uppercase eyebrow labels (`kicker-above-heading`).
- **Don't** drop mobile `<input>` font sizes below `16px`, which triggers unwanted Safari viewport zooming.
