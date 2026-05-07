# @concord-consortium/coachmarks

Shared popover/pointer library for tour-style coachmarks across Concord Consortium apps.

## Install

```sh
npm install @concord-consortium/coachmarks @floating-ui/react
```

Peer dependencies:

- `react` >= 18
- `react-dom` >= 18
- `@floating-ui/react` ^0.27

TypeScript types ship with the package — no separate `@types` install needed.

## Quick start

Import the engine and a theme stylesheet, then drive it imperatively. The structural CSS
ships with the engine via a side-effect import; the theme stylesheet is opt-in.

```ts
import { createCoachmarksEngine } from "@concord-consortium/coachmarks";
import "@concord-consortium/coachmarks/styles/hazbot";

const engine = createCoachmarksEngine({
  onCancelRequested: () => engine.destroy(),
});

// Anchored single-step popover
const button = document.querySelector<HTMLButtonElement>("#start")!;
engine.highlight({
  element: button,
  popover: { title: "Start here", description: "Click to begin." },
});

// No-anchor viewport-positioned cue
engine.highlight({
  popover: {
    position: "top-center",
    title: "Scroll up",
    description: "There's more above.",
  },
});
```

## Multi-step tours

Pass an array of step specs to `engine.drive()`. Each step shows one popover (or, with
`PopoverGroup`, multiple popovers) sequentially.

```ts
engine.drive([
  {
    element: hazbotMascot,
    popover: { title: "Meet Hazbot", description: "I'll guide you." },
  },
  {
    element: setupButton,
    popover: { title: "Set up your simulation", description: "Click Setup." },
  },
]);
```

Customize button labels and progress text:

```ts
const engine = createCoachmarksEngine({
  showProgress: true,
  progressText: "Step {{current}} of {{total}}",
  nextBtnText: "Show me",
  doneBtnText: "Okay",
  showButtons: ["next"], // hide the previous and close buttons
});
```

## Multiple popovers per step

A single step can render multiple popovers simultaneously via the `PopoverGroup` shape.
The first entry, `popovers[0]`, is the *primary* — it owns the step's Next/Previous/Done
navigation and is the default focus target. Companions render alongside, each with
independent positioning, drag state, and close button.

```ts
import {
  createCoachmarksEngine,
  type PopoverGroup,
} from "@concord-consortium/coachmarks";

const group: PopoverGroup = {
  popovers: [
    {
      element: hazbotMascot,
      popover: {
        title: "Run your model first",
        description: "I will analyze your model after you run it!",
      },
    },
    {
      popover: {
        position: "top-center",
        title: "Scroll up!",
      },
    },
  ],
  dismissBehavior: "individual",
};

engine.highlight(group);

// Consumer-side scroll handler dismisses just the "Scroll up!" companion.
window.addEventListener("scroll", () => {
  if (window.scrollY < 100) engine.dismissPopover(1);
});
```

`dismissBehavior` controls per-popover close-button semantics:

- `"individual"` (default): each close button dismisses only that popover.
  - Companion close → `onPopoverDismissed(idx, step)` fires; the step stays active.
  - Primary close → `onPopoverDismissed(0, step)` then `onCancelRequested` fires.
- `"group"`: any close button cancels the entire step (today's single-popover
  Close behavior). `onPopoverDismissed` does not fire.

`onHighlightStarted` and `onDeselected` fire **once per step**, not once per popover.

## Recommended React wrapper pattern

For state-driven visibility (refusal bubbles, conditional cues), wrap the engine in a hook:

```tsx
import { useEffect, useRef } from "react";
import {
  createCoachmarksEngine,
  type EngineHandle,
} from "@concord-consortium/coachmarks";

export function useCoachmark(
  visible: boolean,
  target: HTMLElement | null,
  popover: { title?: string; description?: string },
) {
  const engineRef = useRef<EngineHandle | null>(null);
  useEffect(() => {
    if (!visible || !target) return;
    const engine = createCoachmarksEngine({
      onCancelRequested: () => engine.destroy(),
      onDestroyed: () => {
        engineRef.current = null;
      },
    });
    engine.highlight({ element: target, popover });
    engineRef.current = engine;
    return () => {
      engineRef.current?.destroy();
      engineRef.current = null;
    };
  }, [visible, target, popover.title, popover.description]);
}
```

## Theming

Choose exactly one theme by importing its stylesheet:

```ts
import "@concord-consortium/coachmarks/styles/hazbot"; // or .../styles/codap
```

Themes set CSS custom properties on `:root`. Override them in your own stylesheet to
customize colors:

```css
:root {
  --coachmarks-popover-bg: #fff;
  --coachmarks-popover-border: #0050c4;
  --coachmarks-ring-color: #0050c4;
  --coachmarks-focus-color: #0050c4;
}
```

Other useful variables:

- `--coachmarks-z-index` (default `10001`) — host apps with their own stacking
  contexts can override at `:root`, `html`, or `body`. (The library portals popovers
  under `document.body`, so deeper-ancestor overrides don't apply.)

## Localization

Built-in defaults are English. Pass overrides for non-English locales:

| Option | Default |
|---|---|
| `prevBtnText` | `"Previous"` |
| `nextBtnText` | `"Next"` |
| `doneBtnText` | `"Done"` |
| `progressText` | `"{{current}} of {{total}}"` |
| `ariaLabel` | `"Help"` |
| `closeBtnAriaLabel` | `"Close"` |

## API reference

### `createCoachmarksEngine(args?)`

Returns an `EngineHandle`. All options are optional.

#### Behavior

- `showButtons?: ("next" | "previous" | "close")[]` — which buttons render. Default all three.
- `disableButtons?: ("next" | "previous")[]` — which rendered buttons appear disabled.
- `showProgress?: boolean` — show the "X of Y" indicator (in tour kind only).
- `allowKeyboardControl?: boolean` — Arrow/Escape keyboard navigation. Default `true`.
- `allowClose?: boolean` — allow close via button or Escape. Default `true`.
- `animate?: boolean` — `false` disables popover animations.
- `smoothScroll?: boolean` — smooth `scrollIntoView`. Default `true`. Forced to `auto` under `prefers-reduced-motion: reduce`.
- `popoverOffset?: number` — distance (px) between anchor and popover. Default `10`.
- `draggable?: boolean` — allow pointer drag on anchored popovers. Default `true`.

#### Look & feel

- `closeIcon?: React.ReactNode` — overrides the bundled close icon. The default icon ships with `className="coachmarks-popover-close-icon"` so theme stylesheets can target it (e.g., the `codap` theme styles its hover color through this class). When you pass a custom node, apply the same className yourself if you want theme hover/color rules to apply: `closeIcon: <CloseTileIcon className="coachmarks-popover-close-icon" />`.
- `arrow?: { path?, width?, height?, tipRadius?, strokeWidth? }` — passes through to floating-ui's `FloatingArrow`.
- `titleHeadingLevel?: 1 | 2 | 3 | 4 | 5 | 6` — title element. Default `2`.

#### Accessibility

- `ariaLabel?: string` — popover `aria-label`, used only when no `popover.title` is set. Default `"Help"`.
- `closeBtnAriaLabel?: string` — close-button accessible name. Default `"Close"`.
- `pullFocusFromIframe?: boolean` — pull focus from an active iframe to the popover so keydown listeners fire. Default `true`.
- `initialFocus?: "popover" | "first-button" | "none"` — what receives focus on step entry. Default `"popover"`.

#### Lifecycle callbacks

- `onHighlightStarted?: (el, step, ctx) => void` — fires after the popover is positioned. `el` is the primary popover's anchor (or `undefined` for viewport-positioned primaries).
- `onDeselected?: () => void` — fires once when the current step is being torn down (transition or cancel).
- `onDestroyed?: () => void` — fires on every teardown path.
- `onCancelRequested?: () => void` — fires when the user clicks Close, presses Escape, or the primary anchor is hidden mid-step.
- `onPopoverDismissed?: (popoverIndex, step) => void` — fires per individual popover close under `"individual"` mode. Does not fire under `"group"` mode or for involuntary hides.

### `EngineStep` discriminated union

```ts
type EngineStep = PopoverSpec | PopoverGroup;
```

`PopoverSpec` is one popover (`AnchoredPopover` or `ViewportPopover`). `PopoverGroup`
is `{ popovers: [PopoverSpec, ...], dismissBehavior?: "individual" | "group" }`.

### `EngineHandle`

```ts
interface EngineHandle {
  drive(steps: EngineStep[]): void;
  highlight(step: EngineStep): void;
  moveNext(): void;
  movePrevious(): void;
  moveTo(index: number): void;
  refresh(): void;
  destroy(): void;
  dismissPopover(index: number): void;
}
```

`moveNext` on the last step of a `drive()` sequence fires `onDestroyed` and tears the
engine down — same path as the "Done" button. `refresh()` re-runs floating-ui positioning
for every popover in the active step. `dismissPopover(idx)` is the imperative equivalent
of clicking a popover's close button under `"individual"` mode.

On a bare `PopoverSpec` step (not a `PopoverGroup`), `dismissPopover(0)` cancels the
step (calls `onCancelRequested`) but does **not** fire `onPopoverDismissed` — bare steps
default to `dismissBehavior: "group"`, which never fires the per-popover callback.

### Placement vocabularies

| Variant | Placement option | Values |
|---|---|---|
| Anchored (`element` set) | `popover.side` + `popover.align` | side: `top` `right` `bottom` `left`; align: `start` `center` `end` |
| Viewport (no `element`) | `popover.position` | nine viewport anchors: corners, edge midpoints, `center` |

The two are intentionally different — anchored placement reasons relative to a target
rect; viewport placement reasons relative to the viewport rect.

## Local development workflow

```sh
npm install
npm run demo        # serve the demo at http://localhost:5173
npm test            # vitest
npm run check       # biome lint/format + tsc --noEmit
npm run build       # tsup + copy theme stylesheets to dist/styles/
```

For local testing in a consuming app via `yalc`:

```sh
# in this repo
npm run build
yalc publish

# in the consuming app
yalc add @concord-consortium/coachmarks
```
