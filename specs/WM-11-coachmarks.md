# Coachmarks — Shared Popover/Pointer Library (New Repo)

**Jira**: https://concord-consortium.atlassian.net/browse/WM-11

**Status**: **Closed**

## Overview

Create `coachmarks`, a new shared React library at `concord-consortium/coachmarks` (published to npm) that provides the popover/pointer presentation primitives needed by Hazbot (wildfire-model), CODAP, and any future consumer with similar needs. Source is the merged tour-engine module from CODAP PR #2532, ported as-is with state management swapped from MobX to `useSyncExternalStore` and CSS class names renamed from `codap-tour-*` to `coachmarks-*`. The public API is the existing imperative `createCoachmarksEngine` — no declarative React component wrapper is shipped in v1; consumers needing visibility tied to React state write a small wrapper themselves (the README provides a copy-paste example).

The wildfire-model team needs a Hazbot help-overlay UI (story WM-6) — a Hazbot mascot button that, when clicked, runs a multi-step tour anchored first above Hazbot then to the Setup button ("Show me" → "Okay" flow per the AP-79 design), plus a single-step refusal bubble anchored to the Setup button when the student clicks Hazbot before the simulation has run. CODAP already has a tour engine — built and merged in PR #2532 — that does anchored popovers, multi-step tours, draggable popovers, target watching, focus management, and reduced-motion support. Rather than fork it into Hazbot, we're extracting that engine into a standalone npm-published library so Hazbot, CODAP, and any future consumer converge on a single implementation. The library has a hard deadline of summer PD (week of June 22, 2026) because WM-6 — the Hazbot button itself — is blocked on this work.

The library is repo-scaffolded after the sibling `accessibility-tools` repo (Biome, tsup, Vitest + jsdom, lefthook, Vite-served `demo/`, S3 deploy via GitHub Actions). It ships theme-neutral DOM, two built-in themes (`hazbot` and `codap`), and uses CSS variables + `className` passthroughs so consumers can theme-override without library churn.

## Background

**Source code (extracted from CODAP)**: The `tour-engine/` folder at `v3/src/lib/tour/tour-engine/` (~1,560 lines incl. tests, 22 files) ports over almost as-is. It provides anchored popover with arrow, target outline, scroll-into-view, `autoUpdate`, keyboard control, multi-step sequencing (built on `@floating-ui/react`); highlight + tour modes; draggable popover; target watcher with auto-cancel when the anchored element is removed; focus management with conditional restoration; reduced-motion support; `refresh()` API; engine lifecycle callbacks; keyboard control scoping; progress text; self-mounting React root; bundled close icon.

**What stays in CODAP (not extracted)**: `tour-manager.ts`, `tour-elements.ts`, `tour-sanitize.ts`, `feature-tour.ts`. These are CODAP-specific (plugin notification protocol, `tourKey` → CSS-selector registry, plugin-API sanitizer, Help-menu feature-tour config). CODAP keeps these as the integration layer over the extracted engine.

**State management**: Replace MobX with `useSyncExternalStore` (React 18 built-in, zero runtime deps). Engine state is small and mostly flat — the proxy-based fine-grained tracking MobX provides is unnecessary at this size, and avoiding any external state library removes a peer-dep ask from downstream consumers. The store's `subscribe` function must be Strict-Mode-safe. SSR / `getServerSnapshot` is out of scope.

**Critical path**: WM-6 (Hazbot button + refusal bubble) anchors its bubble to the Setup button and uses this library to render it. Coachmarks must reach a usable state before WM-6 can ship.

## Requirements

### Repo & publishing

- **Repo**: `concord-consortium/coachmarks` (new, to be created on GitHub).
- **Package name**: `@concord-consortium/coachmarks` (npm, public access).
- **Initial version**: `0.0.1-pre.0` (matches accessibility-tools convention; signals API in flux).
- **License**: MIT.
- **Module type**: ESM-first, dual ESM/CJS via tsup.
- **Peer dependencies**: `react >=18`, `react-dom >=18`, `@floating-ui/react ^0.27.0`.
- **Engines**: `node >=18`.
- **`sideEffects`**: `["*.css"]` so the engine's auto-imported `base.css` survives bundler tree-shaking.
- **`exports` map** with subpath exports for `/styles/hazbot` and `/styles/codap` (theme stylesheets); `base.css` is auto-imported by the engine module and not in `exports`.
- **Versioning during WM-6 development**: Hazbot consumes via `yalc` during active iteration; npm bumps happen at clean library milestones (`pre.N` → `0.1.0` when AP-79 flow verified end-to-end).
- **npm `dist-tag`**: Publish prerelease versions to the `latest` dist-tag.
- **Repo-root docs**: `LICENSE` + `README.md` only (matching accessibility-tools precedent).
- **`package.json` metadata**: matches accessibility-tools' field set with `description` and `keywords` added for npm discoverability; `files: ["dist"]`.
- **Bundle-size soft target**: ≤30 KB min+gz for `dist/index.js` (excluding peer deps). Verified manually on each release via `gzip -9c dist/index.js | wc -c`. No CI gate for v1.

### Repo scaffolding (modeled on `accessibility-tools`)

- **Build tool**: tsup (multiple entrypoints, ESM + CJS, generates `.d.ts`). Stylesheets are authored as **plain CSS** (no SCSS). `scripts/copy-styles.mjs` is the verbatim accessibility-tools script.
- **Lint/format**: Biome (`npm run lint`, `npm run format`, `npm run check` = lint + format + `tsc --noEmit`).
- **Tests**: Vitest with jsdom environment + `@testing-library/react`.
- **Git hooks**: lefthook, pre-commit runs `npm run check`.
- **CI**: GitHub Actions modeled on `accessibility-tools/.github/workflows/ci.yml`. Steps: install → build → check → test → build demo → per-branch S3 deploy of `dist-s3/`.
- **TypeScript**: strict, ES2021 target, ESNext modules, `moduleResolution: bundler`, `jsx: react-jsx`. Separate `tsconfig.build.json` for `dts` generation.

### Public API (entrypoints)

- **`@concord-consortium/coachmarks`** (root): the headless engine — `createCoachmarksEngine`, `EngineHandle`, `EngineStep`, etc. Side-effect-imports `base.css`.
- **`@concord-consortium/coachmarks/styles/hazbot`** and **`/styles/codap`**: opt-in theme stylesheets.

Theme is selected by which stylesheet the consumer imports — there is no `theme` prop on the engine.

**No declarative React component is shipped in v1.** The library is imperative-only; consumers needing visibility tied to React state write a small wrapper around `createCoachmarksEngine`.

#### Engine options (`createCoachmarksEngine`)

All CODAP `tour-engine` options preserved (`showButtons`, `disableButtons`, `showProgress`, `allowKeyboardControl`, `allowClose`, `animate`, `smoothScroll`, `popoverOffset`, `progressText`, `nextBtnText`, `prevBtnText`, `doneBtnText`) plus new options: `pullFocusFromIframe` (default `true`), `draggable` (default `true`), `closeIcon` (override bundled icon), `ariaLabel` (default `"Help"`), `closeBtnAriaLabel` (default `"Close"`), `titleHeadingLevel` (1–6, default `2`), `initialFocus` (`"popover"` | `"first-button"` | `"none"`, default `"popover"`), `arrow` (`{ path?, width?, height?, tipRadius?, strokeWidth? }` pass-through to `FloatingArrow`), `onPopoverDismissed(popoverIndex, step)` callback. The CODAP `steps?` constructor field is dropped — consumers always pass steps explicitly.

`onHighlightStarted`'s first arg is widened to `HTMLElement | undefined` (viewport popovers have no anchor element).

#### `EngineHandle` shape

`createCoachmarksEngine` returns `EngineHandle` with imperative methods: `drive(steps)`, `highlight(step)`, `moveNext()`, `movePrevious()`, `moveTo(index)` (0-based), `refresh()`, `destroy()`, `dismissPopover(index)`. All methods return `void` — state observation goes through `useSyncExternalStore`.

#### `EngineStep` shape (discriminated union)

`EngineStep = PopoverSpec | PopoverGroup`, where `PopoverSpec = AnchoredPopover | ViewportPopover`. A `PopoverGroup` wraps multiple popovers shown together as one step:

- `popovers[0]` is the *primary* — owns the step's Next / Previous / Done buttons and is the default initial-focus target.
- Companions at `popovers[1+]` render alongside, each with independent positioning, drag state, target watcher, and close button.
- `dismissBehavior?: "individual" | "group"` (default `"individual"` for groups; bare popovers are effectively `"group"`).
- Per-popover `initialFocus?: boolean` overrides which popover gets focus on step entry (first-set-wins).

#### Placement vocabularies

Anchored placement uses `side` (top/right/bottom/left) + `align` (start/center/end). Viewport (no-anchor) placement uses `position` (nine viewport anchors) + optional `viewportOffset: { x?, y? }` pixel nudge. Vocabularies intentionally differ because the geometric problems differ.

### Engine behavior (ported from CODAP plus additions)

- All ported behaviors must be preserved; CODAP's existing tour-engine tests port over and pass.
- Engine state observable via `useSyncExternalStore`; MobX removed.
- **Anchored ↔ no-anchor `highlight()` transitions**: engine tears down/spins up outline ring and target watcher per popover transition without flicker.
- **Multiple popovers per step (`PopoverGroup`)**: independent popovers share the engine's portal, z-index, lifecycle, and focus model. `dismissBehavior: "individual"` (default) — companions individually dismissed fire `onPopoverDismissed`; primary individually dismissed fires `onPopoverDismissed(0)` then `onCancelRequested`. `"group"` — any close fires `onCancelRequested`. Lifecycle callbacks fire **once per step**, not per popover. Hidden primaries cancel the group; hidden companions are silently dropped.
- **`engine.dismissPopover(index)`**: imperative equivalent of clicking a close button under `"individual"` mode.
- **Focus restoration on `destroy()`**: only attempted if focus is still inside the popover at teardown, preferring (1) current step's anchor element (with `tabindex="-1"` added if needed), (2) pre-tour active element. If focus moved outside the popover, no restoration.
- **`smoothScroll` honors `prefers-reduced-motion`**: downgrades to `auto` (instant scroll) when reduced motion is set. Behavioral fix from CODAP.
- **Initial focus on popover open**: controlled by `initialFocus` engine option. Pre-existing iframe pull-out (`pullFocusFromIframe`) is independent.
- **Draggable popover is pointer-only**: per WCAG 2.1.1 dragging-as-task is exempted; consumers should choose default placement carefully. Keyboard-nudge alternative deferred.
- **Placement uses physical-direction terms by design**: `side` / `position` describe physical placement, not text flow. RTL changes inline text direction but doesn't move buttons across the page. No CSS logical properties.
- **Step.element optional, with viewport positioning**: support no-anchor cues; `position` field selects a viewport anchor; `viewportOffset` for pixel nudge.
- **Iframe focus pull-out is opt-out, not removed.** Default-on (`pullFocusFromIframe: true`) preserves CODAP behavior. Pull-out check runs on engine start *and on every step transition*.
- **Close icon is consumer-overridable.** Bundled default carries `className="coachmarks-popover-close-icon"`.
- **Escape always cancels the active step regardless of which popover holds focus.** Document-level keydown listener is attached only to the primary popover. Single, predictable "Escape ends the step".
- **Popover ARIA semantics**: rendered as `<div role="dialog" aria-modal="false" {…label} {…description}>`. (CODAP today uses `role="region"`; coachmarks corrects this.) Label resolution: `aria-labelledby={titleId}` if title present, else `aria-label={ariaLabel}` (default `"Help"`). `aria-describedby={descriptionId}` whenever a description is present. With `initialFocus: "popover"`, each `moveNext`/`movePrevious` refocuses the popover and screen readers announce the new content.
- **`moveNext` at last step completes the tour**: fires `onDestroyed` and calls `destroy()` internally.
- **`refresh()` semantics**: re-runs floating-ui positioning for *every popover* in the active step and recomputes outline ring rects. Drag offsets stored as `{offsetX, offsetY}` relative to the anchor at pointer-down (behavioral fix from CODAP, which used absolute-viewport drag-override). Does not re-evaluate target-watcher or re-run scroll-into-view.
- **Misuse handling**: silent in production; `console.warn` in development for foot-guns. Specific cases enumerated: post-`destroy()` calls, `element + position` collision, `refresh()` with no active step, `moveTo` out-of-bounds, `dismissPopover` group-mode/out-of-bounds/no-active-step, hidden-element cancellation (with rAF deferral so React mount/effect ordering doesn't trigger spurious cancellation).
- **`title` and `description` rendering**: typed as `string` in v1; rendered as JSX text (React auto-escapes). Path open to widen to `React.ReactNode` non-breakingly later.
- **Re-entrant calls**: `highlight()`/`drive()` while another step is active fires `onDeselected` for the prior step, then `onHighlightStarted` for the new step (engine and portal root persist). Behavioral fix from CODAP. Consumers responsible for avoiding unconditional re-entry that would recurse infinitely.
- **One engine at a time**: library designed for a single active engine. A single step may render multiple popovers via `PopoverGroup`.
- **`showButtons` and `disableButtons` are orthogonal**: `showButtons` filters which buttons render; `disableButtons` toggles disabled state of rendered buttons.
- **Focus-visible indicators on buttons** defined in `base.css` (theme-independent) so keyboard users always see active focus. Per-theme override of `--coachmarks-focus-color` for ≥3:1 contrast.

### Theming

#### Stylesheet packaging

CSS split into two layers:

- **`base.css`** — structural rules; auto-imported by the engine module. Two color exceptions: a `--coachmarks-focus-color` fallback (`#0066cc`) for WCAG-compliant focus on unthemed engines, and `--coachmarks-z-index: 10001` (matches CODAP's hard-coded value) plus derived `--coachmarks-ring-z-index`. Both z-index variables are *consumer-facing* — host apps with their own stacking contexts can override at `:root`.
- **Per-theme stylesheets** (`hazbot.css`, `codap.css`) — colors, fonts, shadows, border-radius, button styling. Opt-in import.

Importing the engine without any theme stylesheet renders a structurally-correct popover with no colors/fonts/shadows.

#### No runtime `theme` prop

Theme is selected by which stylesheet the consumer imports. Per-theme stylesheets set CSS custom properties on `:root`.

#### Theme content

- Hazbot theme matches AP-64 design + Zeplin overlay spec.
- CODAP theme is a faithful port of CODAP's current `tour-styles.scss`.
- Library exposes CSS variables (e.g., `--coachmarks-popover-bg`, `--coachmarks-ring-color`) and `className` passthroughs.
- **WCAG 2.1 AA contrast minimums** for both built-in themes (≥4.5:1 normal text, ≥3:1 large text, ≥3:1 outline ring color). Verified ratios documented in theme stylesheet header comments.
- Class-name rename (`codap-tour-*` → `coachmarks-*`); CSS variable prefix rename (`--codap-tour-*` → `--coachmarks-*`).

### Localization

All built-in default strings are English. Consumers in non-English locales must pass localized overrides via the corresponding engine options (`prevBtnText`, `nextBtnText`, `doneBtnText`, `progressText`, `ariaLabel`, `closeBtnAriaLabel`). The library does not ship locale detection or message catalogs.

### Demo page

Vite-served `demo/` directory with `npm run demo`, modeled on accessibility-tools. Eight sections: anchored popover + arrow; outline ring + scroll-into-view; multi-step sequence (with AP-79 variant); draggable popover; no-anchor scroll cues with `position` + `viewportOffset` controls; multi-popover group (mirrors Hazbot scenario with `dismissBehavior` toggle and imperative `dismissPopover(1)` button); theme switcher (dynamic CSS import); reduced-motion + animation toggles. `npm run demo:build` produces `dist-s3/`. Demo imports from `../src/...` directly for HMR-friendly iteration.

### CI / S3 deploy

GitHub Actions builds the demo and deploys per-branch demo bundles to `models-resources.concord.org/coachmarks/branch/<name>/` via `concord-consortium/s3-deploy-action@v1`. A dedicated smoke test (`tests/smoke.test.ts`, run via `npm run test:smoke` after `npm run build`) imports through the package's published exports paths to catch broken `exports` maps, missing CSS files, and tree-shaken side-effect imports before publish. AWS IAM role provisioned via the standard Concord IAM-setup script during repo setup.

### MVP integration into wildfire-model (downstream — implemented in WM-6)

Library MVP scope must support:

- 2-step tour anchored to Hazbot mascot then Setup button (AP-79 "Show me / Okay" flow).
- Single-step refusal bubble anchored to Setup button.
- Single-step coachmarks anchored to spark tool (analysis-engine feedback).
- Two no-anchor "scroll up / scroll down" cues.
- Multi-popover analysis-engine feedback (anchored Hazbot popover + viewport "Scroll up!" companion as a `PopoverGroup` with `dismissBehavior: "individual"`).

### Acceptance criteria (gate for shipping `0.0.1-pre.0`)

The library is shippable when:

- All ported CODAP tests pass against the new engine.
- New tests cover engine additions with explicit per-test assertion contracts (anchored↔no-anchor transitions, `position`+`viewportOffset`, `pullFocusFromIframe` opt-out, `closeIcon` override, close-button accessible name, title heading level, `ariaLabel` override, step-transition announcement, title-less popover labeling, `aria-describedby` wiring, hidden-element cancellation, drag-relative-to-anchor preservation, re-entrant `highlight()` fires `onDeselected`, dev-mode misuse warnings, `moveTo` bounds, `arrow` option pass-through, bare `PopoverSpec` backward compatibility, `PopoverGroup` rendering, individual/group dismissal semantics, `engine.dismissPopover(index)` imperative, `refresh()` updates all popovers in a group, re-entrant calls during a group, companion hidden-element drop, primary hidden-element cancellation, `PopoverSpec.initialFocus` selection).
- Demo deploys to S3 and all 8 sections function under both `hazbot` and `codap` themes.
- A consuming app (Hazbot via `yalc`) can build and run the AP-79 2-step tour using only the public API.
- README is shipped per the README outline.
- `npm pack` produces a tarball that, when installed in a scratch project, exposes the documented entrypoints and types.

**README outline**: Install → Quick start → Multi-step tours → Multiple popovers per step → Recommended React wrapper pattern → Theming → Localization → API reference → Local development workflow.

**Test strategy** — Vitest unit tests (jsdom) cover engine state, DOM structure, callback firing, prop-to-engine-option translation; demo (manual + S3 deploy) covers pixel placement, real iframe focus pull-out, reduced-motion behavior visually, theme switcher; smoke test covers packaging integrity. Automated browser tests (Playwright / Cypress) out of scope for v1.

### CODAP migration compatibility (forward-looking)

The library is explicitly designed so that follow-up CODAP migration is a near-mechanical refactor:

- **Public API stability**: CODAP's `tour-manager.ts` consumes a small surface that coachmarks preserves with the same shapes and semantics. Renaming `createTourEngine` → `createCoachmarksEngine` is the only breaking signature change. `pullFocusFromIframe` and `closeIcon` are optional with CODAP-friendly defaults.
- **Visual parity for the `codap` theme**: faithful port of `tour-styles.scss`. CODAP's existing visual regression tests should pass with only class-name find-and-replace and CSS-variable-prefix rename.
- **No CODAP concepts in the public surface**: no `tile`, `tourKey`, plugin-protocol shapes.
- **CSS variable surface mirrored**: every `--codap-tour-*` variable gets a `--coachmarks-*` equivalent.
- **Aria-label parity**: CODAP passes `ariaLabel: "Tour step"` to preserve existing screen-reader announcement.
- **Close icon parity**: CODAP passes `closeIcon={<CloseTileIcon />}` to preserve close-button shape.
- **Focus-on-open opt-out**: CODAP passes `initialFocus: "none"` to preserve current behavior.
- **Behavioral fixes** (no CODAP impact): `onDeselected` fires on re-entrant calls; `onDestroyed` fires on every teardown; drag-relative-to-anchor preservation.
- **Constructor `steps?` arg removed**: CODAP migrators must split into separate `createCoachmarksEngine({...}) + drive([...])` calls.
- **`onHighlightStarted` first arg widened to `HTMLElement | undefined`**: CODAP's TS code reading `el` may need narrowing.
- **Popover role semantics changed**: CODAP today renders `role="region"` with `aria-label="Tour step"`; coachmarks renders `role="dialog" aria-modal="false"`. Migration recipe should sweep CODAP for downstream test assertions on the popover's role.
- **`EngineStep` discriminated union may require narrowing** for CODAP code that *reads* `EngineStep` fields.

## Technical Notes

### File layout to extract from CODAP

Files to copy from `/home/doug/projects/codap/v3/src/lib/tour/tour-engine/` (and rename / refactor):

| CODAP file | Coachmarks equivalent | Notes |
|---|---|---|
| `index.ts` | `src/index.ts` | Rename `createTourEngine` → `createCoachmarksEngine`. |
| `tour-engine.tsx` | `src/engine.tsx` | Replace MobX with custom store. |
| `tour-engine-state.ts` | `src/engine-state.ts` | Strip MobX assumptions. |
| `tour-engine-types.ts` | `src/types.ts` | Discriminated-union refactor. Add `dismissPopover`, `onPopoverDismissed`, per-popover `initialFocus`. |
| `tour-root.tsx` | `src/root.tsx` | Drop `observer`, use `useStore`. |
| `popover.tsx` | `src/popover.tsx` | Drop `observer`, CSS class rename. Bundle close icon locally. |
| `outline-ring.tsx` | `src/outline-ring.tsx` | Drop `observer`, CSS variable rename. |
| `progress-text.ts`, `scroll-into-view.ts`, `use-keyboard-control.ts`, `use-popover-drag.ts`, `use-reduced-motion.ts`, `use-target-watcher.ts` (+ tests) | corresponding `src/*` | Mostly no changes; `use-target-watcher.ts` extends connectedness check to reject zero-layout-box elements; `scroll-into-view.ts` gains `prefersReducedMotion` parameter. |
| `tour-engine.test.tsx`, `popover.test.tsx`, `outline-ring.test.tsx` | corresponding | Update for new store; rename selectors; update `role="region"` assertion. |
| (CODAP) `tour-styles.scss` (structural) | `src/styles/base.css` | Plain CSS port. SCSS mixin → CSS variable. |
| (CODAP) `tour-styles.scss` (CODAP theme) | `src/styles/codap.css` | Faithful port; SCSS-specific features rewritten. |
| (new) | `src/styles/hazbot.css` | Per AP-64 / Zeplin spec. |

### Hazbot theme (Zeplin-extracted values)

| Element | Value |
|---|---|
| Popover container | 300px wide, ~218px tall. White (`#FFFFFF`) fill. 5px white outer halo + 3px `#0050C4` inner border, 8px corner radius. |
| Title text | Lato Bold 20px, color `#222222`. |
| Body text | Lato Regular 16px, line-height 24px, color `#222222`. |
| Inline emphasis | Lato Bold 16px, color `#222222`. |
| Primary button | 84×36 pill, fill `#C1DAFF`, 1px `#BDBDBD` border, borderRadius 18. |
| Button text | Lato Bold 16px, color `#222222`, centered. |

WCAG contrast verified — all pairs pass AAA except outline ring, which passes UI 3:1 minimum.

Two follow-up flags: `#0050C4` is not in the project's `cc-*` color tokens (Hazbot-specific palette extension or project-token addition needed); the Combined Shape is a callout balloon with an integrated arrow tail.

### Key dependencies

- Peer (consumer-installed): `@floating-ui/react ^0.27.0`.
- Runtime (bundled): `clsx`. (`useSyncExternalStore` is React 18 built-in.)
- Dev: `tsup`, `vite`, `vitest`, `@vitejs/plugin-react`, `jsdom`, `@testing-library/react`, `@biomejs/biome`, `lefthook`, `typescript`, `@types/react`, `@types/react-dom`, `@types/node`. (No `sass`.)
- Build: `scripts/copy-styles.mjs` copies `src/styles/*.css` → `dist/styles/*.css` after `tsup`.

### Design references

- **AP-64** (Hazbot: Overlay Styling & Avatar Options) — Done. https://concord-consortium.atlassian.net/browse/AP-64
- **AP-79** (Hazbot "Show me / Okay" tour flow). https://concord-consortium.atlassian.net/browse/AP-79 — ticket itself is the source of truth, with supplemental notes in `/home/doug/docs/hazbot-work.md`.
- **Zeplin overlay spec**: https://app.zeplin.io/project/5fe47ae231d1f6a428c53450/screen/69b2baa489a2e2f3308238b8

### Local development workflow

`yalc` workflow: `npm run build && yalc publish` here, `yalc add @concord-consortium/coachmarks` in consuming app.

## Out of Scope

- **Hazbot button + refusal bubble (WM-6)** — consumer of this library; separate story.
- **Wildfire-model integration** — separate work.
- **Analysis engine / rubric** — separate story.
- **App-state log persistence (AP-73 rescope)** — separate story.
- **CODAP migration off in-tree tour-engine** — out of scope for this story; library API and `codap` theme designed to make future migration near-mechanical.
- **Standalone bundle / bookmarklet** — accessibility-tools ships an IIFE standalone; coachmarks doesn't need one.
- **CLI** — coachmarks doesn't ship a CLI binary.
- **Provisioning the AWS IAM role / S3 bucket prefix** — handled by project owner via the standard Concord IAM-setup script.
- **`tourKey` registry, plugin notification protocol, plugin-API sanitizer** — CODAP-specific, stays in CODAP.
- **Shadow DOM compatibility** — engine assumes flat-DOM environment; revisit if a future consumer adopts Web Components.
- **SSR** — known consumers are all client-only React apps; no SSR support, no `getServerSnapshot` divergence.
- **Automated browser tests (Playwright / Cypress)** — S3 demo deploy is the integration check for v1; revisit if a regression slips past it.
- **CI bundle-size gate** — manual verification only for v1.
- **Browser support matrix doc** — implicit from `react >=18`; deferred.
- **CODAP migration recipe doc** — the spec's "CODAP migration compatibility" section serves as the recipe; promotable to a documented artifact at migration time.
- **Keyboard-nudge alternative for drag** (e.g., Ctrl+Arrow) — drag is pointer-only for v1; revisit if a consumer flags a concrete need.
- **`title` / `description` widening to `React.ReactNode`** — strings only for v1; non-breaking widening path open if a consumer requests inline formatting.

## Decisions

### Should the engine support `<Coachmark>` declarative React component alongside imperative API?
**Context**: Hazbot has two usage patterns — fire-and-forget tours (Pattern A, fits imperative API naturally) and state-driven single-step coachmarks (Pattern B, requires a `useEffect` wrapper). Round-1 review chose to ship a `<Coachmark>` declarative wrapper.
**Options considered**:
- A) Imperative-only: ship `createCoachmarksEngine`. Pattern-B consumers write a small wrapper themselves; README ships a copy-paste example.
- B) Add a thin `<Coachmark>` declarative wrapper for single-step highlights.
- C) Full declarative wrapper for both highlight and tour modes.

**Decision**: A — imperative-only. Originally B (round-1 self-review), revised to A in round-2. The Pattern-B "boilerplate" is small (~10–15 lines) and only one current consumer needs it; a library-shipped wrapper would have to handle every consumer's edge cases (ref-attachment timing, prop-change classes, callback collapse, `refresh()` escape-hatch); dropping `<Coachmark>` removes ~30–50 lines of source, the `coachmark.test.tsx` suite, and 5 of 21 round-2 review issues.

### What entrypoint shape should the package expose?
**Context**: The engine has no inline styling beyond floating-ui positioning, so without some stylesheet it renders as an unstyled blob. Two dimensions: structural-vs-theme split, and opt-in vs auto-import.
**Options considered**:
- A) Single combined stylesheet, opt-in (mirrors accessibility-tools).
- B) Per-theme stylesheets, opt-in, no fallback.
- C) Structural + per-theme split, opt-in.
- D) Structural auto-imported via `sideEffects`; themes opt-in.
- E) Everything auto-imported with a default theme baked in.

**Decision**: D — engine auto-imports `base.css`; consumers opt into theme stylesheets. Best forgiveness (popover renders structurally even if theme import is forgotten); theme tree-shaking still works.

### How is the active `theme` selected at runtime?
**Context**: The ticket says "`theme` prop selects a built-in theme." The current engine is a function call, not a React component, so a "prop" needs a home.
**Options considered**:
- A) `theme` option on `createCoachmarksEngine`, with a `data-coachmarks-theme` attribute on the root container.
- B) Consumers import the theme stylesheet they want; engine is theme-agnostic.
- C) Both — runtime prop + import.

**Decision**: B — theme by import only. No runtime `theme` prop. Avoids two-source-of-truth bugs and keeps the engine surface smaller.

### Should the engine support no-anchor steps natively, or via a sentinel?
**Context**: MVP needs no-anchor "scroll up / scroll down" cues; CODAP today requires `EngineStep.element`.
**Options considered**:
- A) Make `element?` optional; popover positions to a configurable corner via a `position` field.
- B) Accept a string sentinel (`"top"` | `"bottom"` | `"center"`) instead of an HTMLElement.
- C) Require consumers to render an invisible anchor div themselves.

**Decision**: A, with nudgeable offsets. `EngineStep.element` becomes optional; when absent, skip outline ring, scroll-into-view, target-watcher; popover places itself relative to the viewport using a `position` field on `EngineStepPopover` (one of nine viewport anchors), with optional `viewportOffset: { x?, y? }`. The field is named `viewportOffset` (not `offset`) to clearly distinguish it from the engine-level `popoverOffset` option for anchored gap.

### Initial version — `0.0.1-pre.0` or `0.1.0`?
**Options considered**:
- A) `0.0.1-pre.0` — matches accessibility-tools convention, signals API in flux.
- B) `0.1.0` — first usable, semver pre-1.0.
- C) `0.0.1` — minimal initial.

**Decision**: A.

### Are demo sections regression tests, or just visual scratchpads?
**Context**: accessibility-tools uses its demo as both manual-QA and smoke-test host.
**Options considered**:
- A) Demo is purely manual QA + PM-facing; smoke tests separate.
- B) Demo doubles as smoke-test host (Playwright).
- C) Skip smoke tests for v1; rely on Vitest unit tests.

**Decision**: A (revised). Originally resolved as C, with the demo's S3 deploy doubling as a packaging sanity check. After implementation interview Q4 chose to have the demo import from `../src/...` directly (faster HMR-friendly iteration), the demo's role as a packaging check disappeared. Implementation interview Q9 restored the explicit packaging check by adding a minimal `tests/smoke.test.ts` per accessibility-tools' pattern.

### How is CODAP's iframe focus pull-out behavior preserved or exposed?
**Context**: CODAP plugins run in iframes; the popover unconditionally pulls focus out so document-level keydown listeners (Arrow/Escape) fire. Hazbot has no plugin iframes.
**Options considered**:
- A) Default-on, no opt-out.
- B) Default-on, opt-out via `pullFocusFromIframe: false` engine option.
- C) Default-off, opt-in.

**Decision**: B — preserves CODAP behavior by default; consumers without iframe contexts can disable.

### How strict is "visual parity" for the `codap` theme?
**Context**: Originally framed as pixel-equivalent vs functionally-equivalent vs token-equivalent. On reflection, that's a false trichotomy — the whole point of shipping a named `codap` theme is to reproduce CODAP's current look.

**Decision**: Faithful port of CODAP's current `tour-styles.scss` — same colors, padding, border-radius, shadows, font-family declarations, button styling, hover transitions. Subsumed concerns (icon shape via Q9, font-loading by consumer app) tracked separately.

### Should the engine accept a consumer-supplied close icon override?
**Options considered**:
- A) Bundled icon only, no override.
- B) Optional `closeIcon` engine option accepting a React node.
- C) Theme-level override (each theme bundles its own icon).

**Decision**: B — optional `closeIcon` engine option, defaults to bundled icon. CODAP can pass its existing SVG component for parity.

### Is the "third upcoming project" mentioned in the Jira ticket a known consumer with concrete requirements?
**Options considered**:
- A) Third project is known with requirements that must influence MVP.
- B) Third project named but no concrete requirements yet — extraction justified by Hazbot + CODAP alone.
- C) Third project is hypothetical; drop from spec narrative.

**Decision**: B.

### `<Coachmark>` prop-change lifecycle is under-specified
**Context**: Round-1 self-review flagged ambiguity about which prop changes trigger `refresh()` vs. full re-highlight. Made obsolete by the round-2 decision to drop `<Coachmark>` from the public API; consumers using imperative API have full control over re-call vs. `refresh()`.

**Decision**: Resolved by dropping `<Coachmark>` (see "Should the engine support `<Coachmark>`" above).

### "useSyncExternalStore or fallback Zustand" leaves the store choice ambiguous
**Decision**: Commit to `useSyncExternalStore` over a small (~20-line) custom store helper for v1. If implementation hits a real wall, raise a follow-up RFC; don't decide both options now.

### How do we verify the published dist actually works pre-publish?
**Context**: Vitest unit tests run against `src/`, not `dist/` — packaging bugs (broken `exports`, `sideEffects`, `.d.ts`) wouldn't surface until consumer integration.
**Options considered**:
- A) CI step that does `npm run build && npm pack` + a "import from the tarball" sanity check.
- B) Rely on the demo's S3 deploy as an integration check.
- C) Accept the risk; rely on Hazbot/CODAP catching breakage.

**Decision**: B for round-1 (the demo's CI build doubles as a packaging sanity check), then revised in implementation interview Q9 to add a dedicated `tests/smoke.test.ts` once Q4 chose for the demo to import from `../src/...` directly. Net effect: explicit smoke test in CI.

### MVP "done" criteria aren't defined
**Decision**: Add an "Acceptance criteria" subsection under Requirements listing the gate concretely (all CODAP tests pass, new tests cover engine additions, demo deploys to S3 with all sections functional under both themes, a consuming app can build and run the AP-79 2-step tour, README documents the eight sections).

### Anchored ↔ no-anchor mid-life transitions are unspecified
**Decision**: Engine cleanly transitions (no flicker, no orphaned outline ring, target watcher cancellation) when `highlight()` is called with shape changes. Tested in `engine.test.tsx`.

### Focus-restoration spec oversimplifies actual behavior
**Decision**: Replace "capture pre-tour focus, restore on teardown" with the precise CODAP logic: only attempt restoration if focus is still inside popover; prefer step's anchor element (with `tabindex="-1"` if needed); fall back to pre-tour active element; if both disconnected, no explicit restoration. If user moved focus outside popover, no restoration attempted.

### `smoothScroll` and `prefers-reduced-motion` interaction is unspecified
**Decision**: When `prefers-reduced-motion: reduce` is set, `smoothScroll: true` is treated as `false` — `scrollIntoView` uses `behavior: 'auto'`. Engine option is consumer-supplied default; user preference overrides.

### Two offset systems with similar names are hard to discover
**Context**: `popoverOffset` (engine option, anchored gap) and `EngineStepPopover.offset` (`{x?, y?}` pair, no-anchor only) had overlapping vocabulary.
**Decision**: Rename `EngineStepPopover.offset` → `viewportOffset`. The `viewport` prefix makes the no-anchor-only nature self-documenting.

### Two placement vocabularies (`side`+`align` vs nine-anchor `position`) increase API surface area
**Options considered**:
- A) Accept the divergence — anchored vs. absolute have different mental models. Document with examples.
- B) Unify by accepting `position` for both.
- C) Unify by accepting `side`+`align` for both.

**Decision**: A — keep them separate. The conceptual difference (relative vs. absolute) justifies the API divergence. Add a comparison table in the README's API reference.

### Popover's `aria-label="Tour step"` is wrong for non-tour usage
**Context**: CODAP today renders `aria-label="Tour step"`, misleading for Hazbot's refusal bubble.

**Decision**: Add an `ariaLabel` engine option with default `"Help"`. CODAP passes `ariaLabel: "Tour step"` post-migration for parity.

### No color-contrast minimum enforced for bundled themes
**Decision**: Both built-in themes must meet WCAG 2.1 AA contrast for popover title (large text), description (normal text), and button text. Document verified contrast ratios in the theme stylesheet header comments. One-time verification — not a CI check.

### Focus-visible button styling depends on a CODAP-only `focus-outline` mixin
**Decision**: Define an explicit focus-visible style in `base.css` (`outline: 2px solid var(--coachmarks-focus-color, #0066cc); outline-offset: 2px;`). Per-theme stylesheets override `--coachmarks-focus-color`.

### Migration recipe doesn't mention `closeIcon` pass-through for visual parity
**Decision**: Add a bullet to "CODAP migration compatibility (forward-looking)" — CODAP passes `closeIcon={<CloseTileIcon />}` to preserve close-button visual parity.

### Initial focus on popover open is iframe-conditional (inherited from CODAP)
**Options considered**:
- A) Always send focus to the popover root.
- B) Status-quo — only pull from iframe.
- C) New engine option `initialFocus: "popover" | "first-button" | "none"`.

**Decision**: C — `initialFocus` engine option (default `"popover"`). Hazbot uses default; CODAP passes `"none"` to preserve current behavior.

### `role="region"` semantics are inherited but may be wrong for popover/dialog use cases
**Decision**: Change to `role="dialog" aria-modal="false"` now, since extraction is the natural moment to fix it. CODAP-side test updates required at migration.

### Step-transition screen-reader announcement is missing
**Decision**: Move focus to the popover root on each step transition (preferred — also handles initial focus). With `initialFocus: "popover"` and `aria-labelledby`/`aria-describedby` wiring, each `moveNext` re-announces the new step content.

### Draggable popover has no keyboard alternative
**Decision**: Acceptable v1 limitation. Drag is pointer-only; per WCAG 2.1.1, dragging-as-task is exempted. Consumers should choose default `side`/`align`/`position` carefully so default placement doesn't obscure target UI. Keyboard-nudge alternative deferred.

### Default English button text not flagged for non-English consumers
**Decision**: Add a Localization subsection. All built-in defaults are English; consumers in non-English locales pass localized overrides via the corresponding engine options. Library does not ship message catalogs or locale detection.

### RTL / logical-side support is unaddressed
**Decision**: Reframed as not a deferred gap. Physical-direction terms are correct *by design* for spatial UI placement, not text flow. RTL changes inline text direction but doesn't move buttons across the page. CSS logical properties would incorrectly mirror placement based on text direction. No RTL-specific work needed.

### Bundle-size budget is unset
**Decision**: ≤30 KB min+gz for `dist/index.js` (excluding peer deps). Verified manually on each release; no CI gate for v1. Canonical measurement: `gzip -9c dist/index.js | wc -c`.

### Multiple concurrent engines — focus, z-index, and portal contention unspecified
**Decision**: One-at-a-time is the supported model. Library does not enforce serialization; consumers coordinate via their own state (typically a single "current coachmark" wrapper).

### `refresh()` semantics during a multi-step `drive()` are unspecified
**Decision**: `refresh()` re-runs floating-ui positioning for every popover and recomputes outline ring rects. Does not re-evaluate target-watcher; does not re-run scroll-into-view.

### Concurrent / re-entrant `drive()` and `highlight()` calls — behavior undefined
**Decision**: Most-recent-call-wins, with `onDeselected` fired for the replaced step. CODAP today skips `leaveStep()` on re-entry; coachmarks fixes this — calls `leaveStep()` before `enterStep()`. Behavioral fix flagged in CODAP migration compatibility.

### Title and description rendering policy not stated
**Decision**: Strings rendered as JSX text — React auto-escapes, so HTML appears literally. Safe by construction. Path open to widen to `React.ReactNode` non-breakingly later.

### API-misuse policy undefined (silent vs warn vs throw)
**Decision**: Silent in production, `console.warn` in development for foot-guns. Specific cases enumerated in "Misuse handling" (post-`destroy()`, `element + position` collision, `refresh()` with no active step, `moveTo` out-of-bounds, `dismissPopover` group-mode/out-of-bounds, hidden-element with rAF deferral).

### TypeScript discriminated union for `EngineStep` would prevent invalid combinations at compile time
**Decision**: Specify `EngineStep` as `AnchoredStep | ViewportStep` discriminated union. Compile-time enforcement for TS consumers; runtime `console.warn` still covers JS consumers.

### Repo hygiene and `package.json` metadata not enumerated
**Decision**: Match accessibility-tools precedent (LICENSE + README only at repo root). Add `description` + `keywords` to `package.json`. Specify `files: ["dist"]`.

### README scope is implicit and scattered
**Decision**: Acceptance criteria gains a "README outline" subsection consolidating the eight required sections in order. Browser support matrix and CODAP migration recipe explicitly deferred.

### `base.css` "no colors" rule contradicts the focus-visible default color
**Decision**: Keep the fallback and explicitly carve out the exception. A WCAG-compliant focus indicator on an unthemed engine is more valuable than a strictly color-free `base.css`.

### Re-entrant calls inside lifecycle callbacks can recurse infinitely
**Decision**: One-line note putting responsibility on the consumer. Library does not detect or break re-entry cycles. The same foot-gun applies to setState-from-render in React, etc.

### `showButtons` vs `disableButtons` precedence undefined when both target the same button
**Decision**: The two options are orthogonal: `showButtons` filters which buttons render; `disableButtons` toggles disabled state of buttons that *are* rendered. Listing a button in `disableButtons` that isn't in `showButtons` is a no-op.

### `EngineHandle` method signatures aren't documented in Public API
**Decision**: Add an "`EngineHandle` shape" sub-section under Public API with the seven method signatures, a one-line description per method, and a `moveTo` 0-based-indexing note.

### Step-transition announcement test only covers the title-having branch
**Decision**: Add a "title-less popover labeling" test bullet asserting `aria-label` matches the engine option and `aria-labelledby` is absent for description-only steps.

### Title-less popover doesn't announce description content on focus
**Decision**: Add `aria-describedby={descriptionId}` whenever a `popover.description` is present, alongside the existing `aria-labelledby`/`aria-label` path.

### Discriminated-union refactor of `EngineStep` may break existing CODAP TS call sites
**Decision**: Add a "`EngineStep` discriminated union may require narrowing" bullet to "CODAP migration compatibility (forward-looking)" with a `grep -r 'EngineStep' v3/src/` recipe step.

### `highlight()` with a hidden / `display: none` element behavior undefined
**Decision**: Extend the target watcher's connectedness check to also reject elements with no layout box (`offsetParent === null` or zero-size rect). `display: none` elements follow the same `onCancelRequested` cancellation path as disconnected elements; `visibility: hidden` and `opacity: 0` still have layout boxes and are anchored normally. rAF-deferred check before firing `onCancelRequested` so React mount/effect ordering doesn't trigger spurious cancellation.

### Bundle-size verification mechanism unspecified
**Decision**: Picked `gzip -9c dist/index.js | wc -c` as the canonical measurement — reproducible, tool-agnostic, approximates what consumer bundlers download.

### `onHighlightStarted` first-arg type for viewport (no-anchor) steps
**Options considered**:
- A) Keep first arg always-`HTMLElement` (pass `container` for viewport steps).
- B) Widen to `HTMLElement | undefined`.
- C) Split into two callbacks.
- D) Drop the first positional arg entirely.

**Decision**: B — widen to `HTMLElement | undefined`. Anchored steps still pass the anchor element (CODAP's existing call signature works); viewport steps pass `undefined`. CODAP migration impact is a non-null assertion or narrowing on existing handlers.

### `onDestroyed` firing on every teardown vs end-of-sequence only
**Options considered**:
- A) Fire on every teardown.
- B) Preserve CODAP's "end-of-sequence only" semantic; add separate `onTearDown` callback later.
- C) Fire on every teardown, document explicitly in CODAP migration compatibility.

**Decision**: C — `onDestroyed` fires on every teardown (programmatic `destroy()`, end-of-sequence completion, post-cancellation `destroy()`). Symmetric with method name; matches consumer mental model. When both `onCancelRequested` and `onDestroyed` apply, `onCancelRequested` fires first.

### Popover step is borderline ~540 lines — split or keep?
**Options considered**:
- A) Keep as one step.
- B) Split into 5a (skeleton) + 5b (features).
- C) Move all popover tests into a separate test step.
- D) Keep as one and accept the overrun.

**Decision**: D — keep step 5 as a single coherent commit. The popover is one logical unit; ~60% is ported verbatim from CODAP with mechanical renames. The 500-line target is a heuristic, not a hard cap.

### Demo dev-server reads from `dist/` (built) vs `src/` (live source)
**Options considered**:
- A) Demo always imports from package exports (slow iteration, catches packaging bugs).
- B) Demo imports from `../src/...` for dev, package exports for S3-deploy build.
- C) Demo imports from `../src/...` always.
- D) Vite resolve-alias trick.

**Decision**: C — demo always imports from `../src/...`. Fastest iteration; simplest Vite config. Trade-off (no packaging sanity check at deploy) reconciled by Q9 below adding a dedicated smoke test.

### Hazbot theme — fetch concrete values from Zeplin now or leave TODO markers?
**Options considered**:
- A) Leave `TODO` markers; implementer fills during implementation pass.
- B) Fetch Zeplin values now and pin in the implementation spec.
- C) User supplies values now.

**Decision**: B — fetched via Zeplin MCP `get_screen` against the "Combined Shape" layer. Concrete values pinned (see Technical Notes → Hazbot theme).

### `useStore` stub in step 2 — keep or defer the export to step 6?
**Options considered**:
- A) Keep the stub.
- B) Defer `useStore` to step 6 entirely.
- C) Implement `useStore` correctly in step 2 using `useSyncExternalStore`.
- D) Skip the wrapper; components call `useSyncExternalStore` directly.

**Decision**: C — implement `useStore` correctly in step 2. React 18 ships `useSyncExternalStore` as a built-in, so there's no dependency reason to wait. Wrapper centralizes the SSR third-arg handling and gives components a single import surface visually distinct from generic React state.

### Constructor `steps` arg + new `drive(steps)` signature
**Options considered**:
- A) Auto-drive at construction.
- B) Drop the constructor `steps?` arg entirely.
- C) Keep `steps?` as default for `drive()`-no-arg.
- D) Auto-drive but log dev warning.

**Decision**: B — drop the constructor `steps?` arg entirely. One canonical path: `engine.drive([...])` always carries steps explicitly. Eliminates two-signatures-with-different-semantics confusion.

### `@floating-ui/react` as bundled dependency vs peer dependency
**Context**: CODAP already pins `@floating-ui/react: ^0.27.19` and uses it in three non-tour places; wildfire-model doesn't use it directly.
**Options considered**:
- A) Bundled `dependencies` (zero install friction, dedup risk).
- B) `peerDependencies` (consumer installs, dedupes naturally).
- C) Bundled for v1, revisit later.
- D) Same as B with narrower range.

**Decision**: B with range `^0.27.0`. CODAP's existing `^0.27.19` direct dep satisfies the range trivially. Hazbot adds one `npm install`. Bundle-size budget measures coachmarks' own code only — clearer baseline. `clsx` (sub-1 KB) stays in `dependencies`.

### How to replace the packaging sanity check that demo-from-src removed?
**Context**: Q4 (demo imports from `../src/...`) contradicted the earlier Q5 RESOLVED commitment that the demo's S3 deploy doubles as a pre-publish dist check.
**Options considered**:
- A) Accept the gap (Hazbot's `yalc` workflow catches packaging breakage).
- B) Add a tiny `tests/smoke.test.ts` mirroring accessibility-tools' pattern.
- C) Add a `npm run build && npm pack` + tarball install CI step.
- D) Update Q5 to remove the sanity-check claim.

**Decision**: B — add `tests/smoke.test.ts` + `vitest.smoke.config.ts`. Cheap (~30–40 lines), runs in CI after `npm run build`, restores the explicit safety net.

### Hazbot arrow/callout tail vs `@floating-ui/react`'s `FloatingArrow`
**Context**: Hazbot's callout tail is a downward-pointing V (sharp triangle), blue stroke matching `--coachmarks-popover-border`, larger than `FloatingArrow`'s default 14×7.
**Options considered**:
- A) Ship with `FloatingArrow` defaults; Hazbot accepts visual divergence.
- B) Engine option `arrowComponent?: React.ComponentType` for full custom React component.
- C) Drop `FloatingArrow`; CSS pseudo-elements per theme.
- D) CSS `clip-path` on popover root.
- E) Engine option `arrow?: { path?, width?, height?, tipRadius?, strokeWidth? }` pass-through.

**Decision**: E — engine `arrow?` option object with five pass-through fields. Smallest API surface; reuses floating-ui's positioning math. Fill and stroke continue to read from `--coachmarks-popover-bg` and `--coachmarks-popover-border` (not consumer-overridable). `strokeWidth` IS overridable so themes with thicker borders (Hazbot's 3px) match.
