# Implementation Plan: Coachmarks Hazbot Tour Support

**Jira**: https://concord-consortium.atlassian.net/browse/WM-17 (shared with the wildfire-model renderer story; no separate coachmarks ticket)
**Requirements Spec**: [requirements.md](requirements.md)
**Status**: **In Development**

## Architecture summary

Three features, delivered demo-first (build/validate each in a new `demo/sections/*` against `npm run demo`, then yalc-link to wildfire for integration validation, then `npm publish`):

1. **Action-gated advancement + lazy anchoring** (headline) — the bulk of the work, spread across types, the engine's step-entry/transition path, the popover's button/keyboard/focus handling, and a new wait-for-appearance util.
2. **Hazbot avatar badge** (default-on, opt-out) — a theme-painted element gated by a `showAvatar` option.
3. **Popover image** (`image?: ReactNode`) — a figure slot in the popover content.

Key design decisions carried from `requirements.md`:

- A gated tour is opted in **per engine** via a new `actionGated` option. When true the engine: honors selector targets with wait-for-appearance, hides Next/Previous on intermediate steps (keeps terminal Done), suppresses Arrow-key navigation, does not pull focus on advance, and **degrades a step to an anchorless centered popover instead of cancelling when its anchor is removed** (held-during-wait and terminal cases). Default false preserves today's button-driven tours exactly.
- A lazy step declares its anchor as a **CSS selector** (`target`), resolved at step entry and awaited via `MutationObserver` if absent. The engine resolves selectors to live elements when entering the step, so the popover/Root layers stay element-based and unchanged.
- The deferred-target/`advanceOn` opt-in is the presence of `target`/`advanceOn` on a step; wait-for-target therefore applies only to selector steps. Live-`element` steps keep today's cancel-on-not-laid-out behavior.

## Implementation Plan

### Types and public API surface

**Summary**: Add the new step-target form, advance trigger, engine options, and the image field to `types.ts`, and export the new public types. Pure type/surface change — no behavior — so the rest of the plan has stable names to build against.

**Files affected**:
- `src/types.ts` — new `AdvanceTrigger`, `SelectorPopover`; `advanceOn` on `AnchoredPopover`; `image` on popover content; `actionGated` + `showAvatar` on `EngineOptions`.
- `src/index.ts` — export `AdvanceTrigger`, `SelectorPopover`.

**Estimated diff size**: ~60 lines.

```ts
// types.ts

import type { ReactNode } from "react";

/** Declares when a gated step advances in response to a DOM event on its anchor.
 *  The library attaches the listener to the resolved anchor and removes it on step exit. */
export type AdvanceTrigger = {
  /** DOM event on the step's anchor that advances the step. Narrow union (only authored
   *  need is "click"); widen later if a real non-click case appears (non-breaking). */
  event: "click";
};

/** Shared popover content. `image` renders in a figure slot between title and description. */
type PopoverContentBase = {
  title?: string;
  description?: string;
  /** Optional figure/illustration. The consumer owns the element's alt/aria; for a
   *  meaningful image whose text equivalent is already in `description`, pass an
   *  `aria-hidden` element. Rendered between title and description. */
  image?: ReactNode;
};

export type AnchoredPopover = {
  element: HTMLElement;
  ringElement?: HTMLElement;
  /** Action-gated advance: advance when `advanceOn.event` fires on `element`.
   *  Honored only in an `actionGated` engine; ignored otherwise. */
  advanceOn?: AdvanceTrigger;
  popover?: PopoverContentBase & {
    side?: "top" | "right" | "bottom" | "left";
    align?: "start" | "center" | "end";
    width?: number | string;
    anchorOffset?: { x?: number; y?: number };
  };
  initialFocus?: boolean;
};

/** Like AnchoredPopover, but the anchor is a CSS selector resolved at step entry (and
 *  awaited if absent) instead of a live element. For tours whose later steps target
 *  controls that only appear after earlier steps' actions. */
export type SelectorPopover = {
  element?: undefined;
  /** CSS selector resolved against the document when the step becomes active. If it does
   *  not yet match a laid-out element, the engine waits (MutationObserver) before entering
   *  the step, keeping the prior step shown. First match wins (`querySelector`). */
  target: string;
  /** Selector for the outline-ring target. Defaults to `target`. */
  ringTarget?: string;
  advanceOn?: AdvanceTrigger;
  popover?: AnchoredPopover["popover"];
  initialFocus?: boolean;
};

export type ViewportPopover = {
  element?: undefined;
  target?: undefined;
  popover: PopoverContentBase & {
    position: ViewportPosition;
    viewportOffset?: { x?: number; y?: number };
    width?: number | string;
    arrow?: { side: "top" | "right" | "bottom" | "left"; offset?: number };
  };
  initialFocus?: boolean;
};

export type PopoverSpec = AnchoredPopover | SelectorPopover | ViewportPopover;
```

```ts
// EngineOptions additions

  /** Action-gated tour: steps advance on the student's action (`advanceOn` / imperative
   *  `moveNext()`), not passive buttons. Hides Next/Previous on intermediate steps (the
   *  terminal Done button is kept), suppresses Arrow-key navigation, does not pull focus on
   *  advance, and enables wait-for-target on selector-anchored steps. Default false
   *  (today's button-driven tours, unchanged). */
  actionGated?: boolean;

  /** Render the hazbot-theme robot avatar badge on this engine's popovers. Default true.
   *  Only the hazbot theme paints it (base/codap hide it via CSS), so this is effectively a
   *  hazbot-theme opt-out. Set false on a popover that should not show it (e.g. an intro
   *  highlight that already points at the robot). The badge is decorative (`aria-hidden`). */
  showAvatar?: boolean;
```

**Note on granularity (resolved in requirements, restated here):** `actionGated` and `showAvatar` are **engine-level**. wildfire's intro `highlight()` and the launched tour therefore use **separate engine instances** (intro: `showAvatar: false`, no `actionGated`; tour: `actionGated: true`, `showAvatar` default). This is the cleanest way to let the intro differ from the tour given they would otherwise share one engine. See Open Question below if per-popover `showAvatar` is preferred instead.

---

### Selector target resolution and wait-for-appearance

**Summary**: When entering a step, resolve any `SelectorPopover.target`/`ringTarget` to live elements, producing element-anchored specs in `currentPopovers` (so the popover/Root layers are untouched). If a selector step's primary target is not yet laid out, wait for it via a new appearance-watcher before transitioning, keeping the current step shown. Live-`element` steps keep today's cancel-on-not-laid-out path.

**Files affected**:
- `src/wait-for-target.ts` — **new**. Appearance-watcher (the inverse of `use-target-watcher`).
- `src/engine.tsx` — resolve selectors at step entry; gate the transition on wait-for-appearance for selector steps.
- `src/engine-state.ts` — `currentPopovers` already holds `PopoverSpec[]`; resolved specs are element-anchored, so no shape change, but document that selector steps are stored resolved.

**Estimated diff size**: ~120 lines.

New util — mirrors the existing removal-watcher ([src/use-target-watcher.ts](../../src/use-target-watcher.ts)), reusing `isLaidOut`:

```ts
// wait-for-target.ts
import { isLaidOut } from "./is-laid-out";

/** Resolve `selector` to a laid-out element now, or watch the document until one appears.
 *  Returns a disposer. `onResolved` fires at most once. Mirrors use-target-watcher's
 *  MutationObserver(document.body, {childList, subtree, attributes}). The immediate-resolve,
 *  appearance-on-insert, and disposer paths are unit-tested in jsdom via the jsdom-anchor
 *  stubs (makeAnchorButton/makeVisible stub offsetParent + getBoundingClientRect so isLaidOut
 *  passes), exactly as use-target-watcher.test.ts tests the inverse watcher. Only the real
 *  CSS-driven reveal (animate-open, display:none -> visible) is a demo/Playwright check. */
export function waitForTarget(
  selector: string,
  onResolved: (el: HTMLElement) => void,
): () => void {
  const tryNow = (): HTMLElement | null => {
    const el = document.querySelector<HTMLElement>(selector);
    return el && isLaidOut(el) ? el : null;
  };
  const immediate = tryNow();
  if (immediate) {
    onResolved(immediate);
    return () => {};
  }
  const observer = new MutationObserver(() => {
    const el = tryNow();
    if (el) {
      observer.disconnect();
      onResolved(el);
    }
  });
  observer.observe(document.body, { childList: true, subtree: true, attributes: true });
  return () => observer.disconnect();
}
```

**Observation cost (note, not a change):** the observer is intentionally document-wide and re-runs `querySelector + isLaidOut` on every mutation, but it is bounded by the student-paced wait window and disposed on resolve / `destroy()` / re-`drive()`, mirroring the existing `use-target-watcher`. `attributes: true` is needed only if a target can appear via an attribute/`display`/`class` flip on an already-present element; if appearance is always a DOM insertion, `childList`/`subtree` alone suffice and avoid waking on every attribute mutation. Confirm which mode actually fires against the demo's `~400ms` animate-open reveal and drop `attributes: true` if it's not required.

Engine changes:

- Add a `resolveStep(step)` helper that maps each `SelectorPopover` in the step to an element-anchored spec (`{ ...spec, element: querySelector(target), ringElement: querySelector(ringTarget ?? target) }`), leaving `AnchoredPopover`/`ViewportPopover` untouched. Store the resolved popovers in `currentPopovers`. (Implementation note: `querySelector` can return `null`, so the spread's `element` is `HTMLElement | undefined` and the result needs an `as PopoverSpec` cast; the primary is always laid-out before entry — `goToStep` waits — so an undefined `element` only arises for a not-yet-present **companion** selector, which `checkCompanionsAndEnter` drops like a not-laid-out anchor rather than rendering a malformed viewport bubble.)
- Refactor the `moveNext()`/`moveTo()`/`drive()` entry path so the transition runs through a single `goToStep(nextIndex)`:
  - If the next step's **primary is a live `element`** (or viewport / already-laid-out selector): behave as today (`startStepWithDeferral`, which keeps the existing `onCancelRequested` for not-laid-out live elements). **Back-compat caveat**: today `moveNext()`/`moveTo()` call `enterStep` *directly* ([engine.tsx:320-321](../../src/engine.tsx#L320-L321)) with no rAF, so a not-laid-out *mid-tour* live step currently cancels via the target-watcher microtask ([use-target-watcher.ts:17-29](../../src/use-target-watcher.ts#L17-L29)), not the first-step rAF guard. Routing mid-tour advances through `startStepWithDeferral` moves that cancel to the rAF path. Because the deferral defers `enterStep` until the element is laid out, the popover never mounts when the element is absent and the target-watcher never runs, so `onCancelRequested` must still fire **exactly once**. Preserve this single-cancel semantics.
  - If the next step's **primary is a `SelectorPopover`** whose target is absent: register the current `seqId`, call `waitForTarget(primary.target, …)`, and **do not leave the current step**. On resolve (guarded by `seqId`/`destroyed`), `leaveStep()` + `enterStep(next)` with the resolved popovers. Store the disposer so `destroy()`/re-`drive()` cancels a pending wait. (Wait-for-target is **gated-only**: it applies to selector steps, which this story authors only inside `actionGated` tours where Next is hidden. A button-driven tour that wanted to disable Next while waiting for a selector target is out of scope; if such a consumer ever appears, add a `disabled`-while-waiting signal then — non-breaking.)
    - **Single in-flight wait (re-entrancy guard):** while a wait is pending the held step stays mounted and its `advanceOn` listener stays attached, so a second advance can arrive (anchor re-click, or a second imperative `moveNext()`). `seqId` does **not** bump on `moveNext()`, so it can't dedupe these sibling waits. `goToStep()` must therefore **no-op a new advance when a wait is already pending** (non-null `waitDispose`): the pending `next` is unchanged, so the in-flight wait already targets it. This guarantees at most one `waitForTarget` is live and exactly one `leaveStep()`/`enterStep()` runs when the target appears (no double `onDeselected`/double entry).
    - **Gated degrade-on-removal (generalizes requirements Round 4 / decision A):** in an `actionGated` tour, a step's primary-anchor removal (the `useTargetWatcher` `onRemoved` predicate — DOM removal or `display:none`/zero-size) must **not** cancel the tour. Instead, the engine **re-renders the current step as an anchorless centered popover**: it replaces the step's resolved primary in `currentPopovers` with a centered `ViewportPopover`-shaped spec (`element: undefined`, `popover.position: "center"`, same `title`/`description`/`image` and the engine's progress/buttons, and **no `popover.arrow`** so the degraded bubble renders **arrowless** — it points at nothing), so the popover re-mounts floating with its identity, step number, and Done/close intact. This is wired by routing the gated step's `useTargetWatcher` `onRemoved` to a `degradeCurrentStep()` engine method (guarded by `actionGated`) rather than the cancel path. **Same-step invariant:** degrade is a re-render of the *active* step, not a transition — it does **not** bump `activeIndex`/`seqId`, and `onHighlightStarted`/`onDeselected` must **not** re-fire on it (the once-per-step latch keys on `activeIndex`/`seqId`, not on "primary popover mounted", so the anchored→centered re-mount and its new floating-ui first-position do not produce a second `onHighlightStarted` for the same step). This preserves the "fires once per gated step" contract that per-step logging consumers depend on. It covers two cases with one mechanism:
      - **(a) Held step during a pending wait** (`waitDispose` non-null) whose anchor is removed — the wildfire Setup-wizard "Click Next" → "Wind" case (clicking Next unmounts the panel-1 Next while the engine waits for the panel-2 Wind). The held step degrades to centered and the pending `waitForTarget` still resolves → `leaveStep()`/`enterStep(next)` when Wind appears. (This replaces the original `waitDispose`-gated removal-suppression; the held step is briefly centered rather than frozen at a stale anchor position.)
      - **(b) Step with no pending advance** — typically the **terminal** Done step anchored to a transient container (the Zeplin-anchored "Setup panel"/"Wind" terminals whose "…then run again" instruction closes the panel). Its anchor is removed with no wait in flight; it degrades to centered and stays until `[Got it!]`/close. **Focus on degrade:** because the popover re-mounts (anchored → centered), the terminal-focus exception ([gated focus section](#)) must re-pull focus to the degraded popover/Done so a keyboard/SR user who closed the panel does not lose the only completion control to `<body>` — drive the re-pull off the degrade transition (it does not bump `activeIndex`, so the `activeIndex`-keyed initial-focus effect won't re-fire on its own), gated on the same `isLast && showNext` predicate.
      Normal teardown is unchanged: student cancel (close/Escape) and `destroy()` work throughout; **non-gated** tours keep today's cancel-on-removal via `useTargetWatcher` → `onCancelRequested`. (For case (a) this also removes the step-3-removal vs step-4-appearance race: a removal degrades rather than cancels, so the only outcome is "advance when the next target appears.")
- The `EngineLiveState` gains `waitDispose: (() => void) | null` (a non-null value also means "a wait is in flight" for the re-entrancy guard and distinguishes degrade case (a) held-during-wait from case (b) no-pending-advance above); `destroy()`/`drive()`/`highlight()` call `waitDispose?.()` and clear it.

**Tests** (`wait-for-target.test.ts`, `engine.test.tsx`): immediate-resolve path; appearance after a delayed `appendChild`; disposer disconnects the observer; selector step whose target never appears keeps the prior step active (no cancel); **two `moveNext()` calls during one wait window produce a single transition** (re-entrancy guard — one `onDeselected`, one entry); **gated degrade-on-removal, case (a) held-during-wait**: advancing to a briefly-absent next target while synchronously removing the held step's anchor degrades the held step to a centered popover and then advances when the next target appears — `onCancelRequested` does **not** fire; **gated degrade-on-removal, case (b) no pending advance**: removing the current (terminal) gated step's anchor with no wait in flight re-renders it as a centered popover that keeps its Done/close buttons and step number — `onCancelRequested` does **not** fire, and clicking Done still completes (`onDestroyed`); **non-gated tours still cancel on removal** (a non-gated step's anchor removed fires `onCancelRequested`); **degrade fires `onHighlightStarted` once per step** (a step that degrades emits exactly **one** `onHighlightStarted` across its life — anchored entry + later degrade does not double-fire — and no `onDeselected` until it actually leaves). **Back-compat regression**: a non-gated multi-step tour advancing (via `moveNext()`) to a not-laid-out live-`element` step fires `onCancelRequested` **exactly once** (asserts the rAF path and the target-watcher microtask don't both fire after the `goToStep()` refactor). Layout-dependent assertions use the `jsdom-anchor.ts` stubs; the genuine animate-open case is a demo/Playwright check.

---

### Declarative `advanceOn` and the gated transition

**Summary**: Attach the `advanceOn` DOM listener to the (resolved) primary anchor while a gated step is active, calling `moveNext()` on the event. The imperative `moveNext()` path (already present) remains the escape hatch for app-state steps.

**Files affected**:
- `src/use-advance-trigger.ts` — **new** hook, attaches/cleans up the listener.
- `src/popover.tsx` — call it for the primary popover.

**Estimated diff size**: ~50 lines.

```ts
// use-advance-trigger.ts
import { useEffect } from "react";
import type { AdvanceTrigger } from "./types";

/** While mounted, advance the tour when `trigger.event` fires on `anchor`. Used only for the
 *  primary popover of an actionGated step. Null anchor/trigger short-circuits. */
export function useAdvanceTrigger(
  anchor: HTMLElement | null,
  trigger: AdvanceTrigger | undefined,
  onAdvance: () => void,
) {
  useEffect(() => {
    if (!anchor || !trigger) return;
    const handler = () => onAdvance();
    anchor.addEventListener(trigger.event, handler);
    return () => anchor.removeEventListener(trigger.event, handler);
  }, [anchor, trigger, onAdvance]);
}
```

In `popover.tsx` (primary only), wired like the existing keyboard/target hooks:

```tsx
const advanceOn = isPrimary && anchored ? (spec as AnchoredPopover).advanceOn : undefined;
const onAdvance = useCallback(() => store.getSnapshot().moveNext(), [store]);
useAdvanceTrigger(anchored ? (spec as AnchoredPopover).element : null, advanceOn, onAdvance);
```

The listener attaches to the real app control (the anchor), so clicking Setup both performs the app action and advances. Because advance routes through `moveNext()` → `goToStep()`, a lazy next step transparently waits for its target (previous step stays up).

**Tests** (`use-advance-trigger.test.ts`, `engine.test.tsx`): listener fires `moveNext`; removed on step exit/destroy; a 2-step gated tour where clicking the step-1 anchor advances to step 2.

---

### Gated navigation: buttons, keyboard, and focus

**Summary**: Under `actionGated`, hide Next on intermediate steps (keep terminal Done), never show Previous, suppress Arrow-key navigation, and don't pull focus on step entry. Matches the Zeplin coach-mark (avatar + text + progress + close + arrow only).

**Files affected**:
- `src/popover.tsx` — button rendering, keyboard-control wiring, initial-focus suppression.
- `src/use-keyboard-control.ts` — add `allowStepNavigation` to gate Arrow keys (Escape unaffected).

**Estimated diff size**: ~70 lines.

Button rendering (replaces the current `showButtons.includes("next")`/`"previous"` blocks):

```tsx
const actionGated = opts.actionGated ?? false;
// Gated: never Previous; Next only on the terminal step (rendered as Done).
const showPrev = showButtons.includes("previous") && !isFirst && !actionGated;
const showNext = showButtons.includes("next") && (!actionGated || isLast);
```

**Precondition (don't drop `"next"`):** the gated rule *suppresses* the Next button on intermediate steps but still renders it as Done on the terminal step, so a gated tour that wants a `[Got it!]` Done button **must include `"next"` in `showButtons`** (e.g. `["next", "close"]`). The `actionGated` rule handles hiding it everywhere except the last step; omitting `"next"` (e.g. `["close"]`) hides Done on the terminal step too. Use `["close"]` only for a gated tour whose final step is itself action-gated (advances via `advanceOn`/`moveNext()` rather than a Done click).

`use-keyboard-control.ts` — gate the Arrow branches; Escape stays:

```ts
interface UseKeyboardControlArgs { /* …existing… */ allowStepNavigation: boolean; }
// in handler:
case "ArrowRight":
  if (!allowStepNavigation) return;
  onNext(); break;
case "ArrowLeft":
  if (!allowStepNavigation) return;
  onPrev(); break;
```

Wired in `popover.tsx`: `allowStepNavigation: !actionGated`.

Focus suppression — the existing initial-focus effect ([popover.tsx:473,481-506](../../src/popover.tsx#L481-L506)) computes its mode from `opts.initialFocus ?? "popover"`; gate it:

```tsx
// Gated tours don't steal focus on advance — EXCEPT a Done-terminated terminal step, whose
// Done button is the sole completion affordance and must be focus-reachable for keyboard/SR
// users. Key on Done-terminated (isLast && showNext), NOT position alone: a gated tour whose
// final step is itself action-gated (["close"], no Done, completes via an in-app action) keeps
// no-focus-steal there too. `showNext` is the Done-terminated predicate from the button block
// above (on the last step it reduces to showButtons.includes("next")).
const initialFocus =
  actionGated && !(isLast && showNext) ? "none" : (opts.initialFocus ?? "popover");
```

Escape-to-cancel still works without popover focus: `useKeyboardControl` listens on `document`, and the Escape branch is independent of `allowStepNavigation`. The close button remains Tab/click reachable.

**Scope of no-focus-steal:** only the initial-focus effect above is gated. The separate `pullFocusFromIframe` effect ([popover.tsx:462-469](../../src/popover.tsx#L462-L469)) is deliberately left active for gated tours (it rescues keyboard focus out of a cross-origin iframe; otherwise keystrokes are lost). It never fires for WM-17 (no iframe anchors), and a gated consumer that wants it off sets `pullFocusFromIframe: false`.

**Tests** (`popover.test.tsx`, `use-keyboard-control.test.ts`): gated intermediate step shows neither Next nor Previous; gated terminal step shows Done; ArrowRight/ArrowLeft are no-ops when `allowStepNavigation:false` while Escape still calls `onClose`; gated **intermediate** step entry does not move focus into the popover, while a **Done-terminated** gated terminal step (`isLast && showNext`) does pull focus (terminal focus exception); a final step that is itself action-gated (`["close"]`, no Done) keeps no-focus-steal.

---

### Hazbot avatar badge (default-on, opt-out)

**Summary**: Render a decorative avatar element on the primary popover when `showAvatar !== false`; paint it only in the hazbot theme (base/codap hide it), so it is effectively a hazbot opt-out. Add the artwork asset.

**Files affected**:
- `src/popover.tsx` — render `<span class="coachmarks-popover-avatar" aria-hidden="true" />` on the primary when enabled.
- `src/styles/base.css` — `.coachmarks-popover-avatar { display: none; }` (default hidden).
- `src/styles/hazbot.css` — show + position the badge (overlap popover top-left) via `background-image`.
- `src/styles/assets/hazbot-avatar.svg` — **new** artwork (from the Hazbot design; see Open Question on art source). No build-script change needed: `scripts/copy-styles.mjs` already does a recursive `cpSync("src/styles", "dist/styles")`, so anything under `src/styles/` is copied; placing the asset at `src/styles/assets/` keeps the CSS `url("./assets/hazbot-avatar.svg")` relative-correct after copy.
- `demo/sections/avatar.tsx` — **new** demo section rendering two hazbot-theme popovers, one default (avatar shown) and one `showAvatar: false` (suppressed), so the opt-out is reviewable in isolation. Registered in `demo/demo-app.tsx`.

**Estimated diff size**: ~40 lines + asset.

```tsx
// popover.tsx, primary only, inside the popover root
{isPrimary && (opts.showAvatar ?? true) && (
  <span className="coachmarks-popover-avatar" aria-hidden="true" data-testid="coachmarks-popover-avatar" />
)}
```

```css
/* base.css — decorative element is theme-painted; hidden by default. */
.coachmarks-popover-avatar { display: none; }

/* hazbot.css — red circular robot face overlapping the popover's top-left, per the design. */
.coachmarks-popover-avatar {
  display: block;
  position: absolute;
  top: 0; left: 0;
  width: 44px; height: 44px;
  transform: translate(-40%, -40%);
  background: url("./assets/hazbot-avatar.svg") center / contain no-repeat;
  pointer-events: none;
}
```

Keeping the element theme-agnostic (core renders an empty decorative span; the theme paints it) avoids importing hazbot art into core `popover.tsx`.

**Tests** (`popover.test.tsx`): avatar element renders on the primary when `showAvatar` defaults/true; absent when `showAvatar:false`; never on companions; carries `aria-hidden`. (Visual placement is a demo/Playwright check.)

**Demo**: a dedicated `avatar.tsx` section shows both hazbot-theme states side by side — default (avatar shown) and `showAvatar: false` (suppressed) — so the opt-out is reviewable/Playwright-verifiable in isolation. The avatar also appears automatically across the gated-tour and anchored sections, and the existing theme switcher exercises the base/codap hidden case.

---

### Popover image/figure support

**Summary**: Render `popover.image` (a `ReactNode`) in a figure slot between title and description.

**Files affected**:
- `src/popover.tsx` — render the image slot.
- `src/styles/base.css` / `hazbot.css` — figure layout (max-width 100%, spacing).
- `demo/sections/image-popover.tsx` — **new** demo section passing an inline SVG.

**Estimated diff size**: ~40 lines.

```tsx
// popover.tsx, in the content block, between title and description
{popoverContent?.image && (
  <div className="coachmarks-popover-figure" data-testid="coachmarks-popover-figure">
    {popoverContent.image}
  </div>
)}
```

```css
.coachmarks-popover-figure { margin: 0 0 10px; }
.coachmarks-popover-figure :is(img, svg) { display: block; max-width: 100%; height: auto; }
```

**Tests** (`popover.test.tsx`): image node renders between title and description; absent when not supplied; no alt enforced by the library (consumer owns it).

**Demo**: a section passing an inline `<svg aria-hidden="true">…</svg>` and one passing an `<img alt="…">`, in both themes.

---

### Gated-tour demo section, wildfire integration, publish

**Summary**: The headline feature's demo harness, then the cross-repo wiring and release. This is the "build it in the demo, then yalc, then publish" tail of the workflow.

**Files affected**:
- `demo/sections/gated-tour.tsx` — **new**. A two-sub-panel wizard mimicking wildfire's Setup wizard (open button → sub-panel A with a Next → sub-panel B with a control + a "Close panel" button), driving a gated tour (`actionGated: true`, `showProgress`) over selector targets. Authored so each advance removes the prior step's anchor (open button removed on click; A→B swap removes the Next; closing the panel removes the terminal's anchor) — exercising lazy wait-for-target, `advanceOn:{event:"click"}`, and **both cases of degrade-on-removal** (held-during-wait and terminal) in isolation.
- `demo/demo-app.tsx` — register the new sections in `SECTIONS`.

**Estimated diff size**: ~120 lines (demo only).

```tsx
// demo/sections/gated-tour.tsx (shape)
const engine = createCoachmarksEngine({
  ...defaults,
  actionGated: true,
  showProgress: true,
  showButtons: ["next", "close"],    // "next" required for the terminal Done; the actionGated
                                     // rule hides Next on intermediate steps and shows it as
                                     // Done only on the last step.
  doneBtnText: "Got it!",
  onHighlightStarted: (_el, _step, { state }) => { activeIndexRef.current = state.activeIndex; },
  onCancelRequested: () => engine.destroy(),
  onDestroyed: () => { engineRef.current = null; },
});
engine.drive([
  // Step 1 — present anchor, declarative advance on click. Clicking it opens sub-panel A AND
  //          removes the open button itself (mimics wildfire's wizard), so on advance the held
  //          step's anchor is gone while step 2's target is still mounting → exercises
  //          degrade-on-removal case (a) (held step re-floats centered, then advances).
  { target: '[data-testid="open-btn"]', advanceOn: { event: "click" },
    popover: { description: "Click to open the panel." } },
  // Step 2 — lazy selector target in sub-panel A: the engine waits for it to appear, then anchors.
  //          advanceOn its Next button, which swaps to sub-panel B (removing this anchor).
  { target: '[data-testid="panel-a-next"]', advanceOn: { event: "click" },
    popover: { description: "This appeared after the click. Click Next." } },
  // Step 3 — terminal, anchored to a control in sub-panel B (selector + wait). NOT action-gated,
  //          so it shows the [Got it!] Done button. A demo "Close panel" control removes the panel
  //          → degrade-on-removal case (b): the terminal re-floats centered but keeps Done/progress,
  //          and clicking Done still completes. Validates both "terminal shows Done" and case (b).
  { target: '[data-testid="panel-b-control"]',
    popover: { description: "Adjust this, then close the panel and finish." } },
]);
// open-btn onClick: reveals sub-panel A (~400ms animate-open) and removes open-btn;
// panel-a-next onClick: swaps sub-panel A → B (removes panel-a-next, reveals panel-b-control);
// a "Close panel" button removes the panel while step 3 is active (degrade case b);
// the terminal step is finished with the [Got it!] Done button throughout.
```

Gated-tour demo Playwright checklist (the layout-dependent branches that unit tests in jsdom cannot cover):
1. **Intermediate gated steps** (steps 1-2) show **neither** Next nor Previous (only avatar + text + progress + close + arrow).
2. The **terminal step** (step 3) shows the `[Got it!]` Done button, focus lands in the popover/Done on entry (the terminal focus exception), and clicking it completes the tour (`onDestroyed`).
3. **Wait-for-appearance**: after clicking the step-1 anchor, step 1 stays on screen until the `~400ms` lazy panel lays out, then step 2 appears anchored to it (no orphaned/unanchored bubble in the gap).
4. **No focus steal**: on each gated advance, `document.activeElement` stays on the app control the student operated (not pulled into the popover).
5. **ArrowRight/ArrowLeft** do nothing on gated steps while **Escape** still cancels.
6. **Gated degrade-on-removal (the headline new behavior; both cases):** (a) *held-during-wait* — clicking the step-1 anchor (which the demo removes on click) while step 2's target is briefly absent degrades step 1 to a centered popover and then advances to step 2 when its target appears, with **no** cancel; (b) *terminal* — removing the terminal step's anchor (a demo "close panel" control) re-floats it as a centered popover that **keeps its `[Got it!]` Done + progress + close**, and clicking Done still completes (`onDestroyed`, not `onCancelRequested`). The demo's gated tour is authored so both removals actually occur (step-1 anchor removed on click; terminal anchored to the closeable panel), so this is Playwright-verifiable in isolation.

Validation tail (per the demo-first workflow in requirements Technical Notes):
1. Validate all three features in `npm run demo` (Playwright per the checklist above, plus avatar placement and the image slot).
2. `yalc push` into wildfire; wire the `(ruleSetId, categoryId)` map + intro/tour engines (wildfire-side, WM-17); validate real spark/`SimulationStarted` advance.
3. Bump version; `npm publish` (by the user); WM-17 pins it.

**Tests**: covered per-feature above; this step adds no library code, only demo + the manual validation deliverable.

## Open Questions

### RESOLVED: `actionGated`/`showAvatar` granularity — engine-level (two engines) vs per-popover
**Context**: The plan makes both engine-level, so wildfire uses **two engine instances** (intro highlight vs. tour). The alternative is per-popover-spec fields so a single engine can vary. Requirements left this to implementation.
**Options considered**:
- A) Engine-level options + two engines (current plan): simplest library surface; wildfire restructures the `hazbot-button.tsx` effect to destroy the intro engine and create a tour engine on `[Show me]`.
- B) Per-popover `showAvatar`/gating fields: one engine spans intro + tour; more spec surface and per-step plumbing.

**Decision**: **A — engine-level options + two engines.** `actionGated` is inherently tour-wide (nav/keyboard/focus/wait-for-target for a whole `drive()`) and must differ between the non-gated intro `highlight()` and the gated tour, which a single shared engine cannot express. wildfire's effect ([hazbot-button.tsx:81-139](../../../wildfire-model/src/components/hazbot-button.tsx#L81-L139)) already creates/destroys an engine per open, and intro→tour is already a destroy-then-create lifecycle, so two engines fit the existing shape; each engine owns its own container + React root, so they are independent. With two engines, engine-level `showAvatar` suffices (intro `false`, tour default), so per-popover fields add surface for no gain.

### RESOLVED: Avatar artwork source
**Context**: Requirement #2 says the artwork lives in the library. The plan references `src/styles/assets/hazbot-avatar.svg`, but the actual art must come from the Hazbot design (the red robot face in the Zeplin screenshot), not be invented here.
**Options considered**:
- A) Export the avatar SVG from the Zeplin design and commit it to the library.
- B) Reuse/adapt wildfire's existing `HazbotBack`/`HazbotEyes` SVGs (composited) as the library asset.
- C) Ship a placeholder asset now; swap the final art before publish.

**Decision**: **B — composite wildfire's `hazbot-back.svg` + `hazbot-eyes.svg`** (open eyes, static, no blink) into a single 48×48 `src/styles/assets/hazbot-avatar.svg` committed to the library. This is the canonical Hazbot face already shown in the bottom-bar button ([hazbot-button.tsx:182-187](../../../wildfire-model/src/components/hazbot-button.tsx#L182-L187)), so the coach-mark badge stays visually consistent with the in-app robot, with no design round-trip or placeholder churn. Confirm during the demo step that the Zeplin badge matches the bottom-bar framing/expression; if design wants a badge-specific variant, export that one asset from Zeplin (fallback to A).

**Provenance / drift guard:** the committed SVG is a *point-in-time composite* of wildfire's `hazbot-back.svg`+`hazbot-eyes.svg` — the canonical face lives in two repos with no build-time link. Record this in a leading comment inside the committed `hazbot-avatar.svg` ("Composited from wildfire-model hazbot-back.svg + hazbot-eyes.svg as of WM-17; re-export if the in-app robot art changes"). A wildfire robot restyle is therefore a known cross-repo coupling (see requirements.md Out of Scope), not a silent divergence.

### RESOLVED: `advanceOn.event` type breadth
**Context**: The only authored need is `"click"`.
**Options considered**:
- A) Keep the broad `keyof HTMLElementEventMap` (flexible, slight footgun if a consumer picks an event that doesn't bubble/fire on the anchor).
- B) Narrow to a small union (`"click"`) and widen later when needed.

**Decision**: **B — `event: "click"`.** Only authored need; matches the library's closed-union convention (`showButtons`, `ViewportPosition`, `side`/`align`, `initialFocus`); documents intent and avoids the wrong-event footgun. Widening to a union later is non-breaking, and the imperative `moveNext()` escape hatch already covers any non-click case.
