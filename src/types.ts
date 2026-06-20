import type { ReactNode } from "react";

/** Declares when a gated step advances in response to a DOM event on its anchor.
 *  The library attaches the listener to the resolved anchor and removes it on step exit. */
export type AdvanceTrigger = {
  /** DOM event on the step's anchor that advances the step. Narrow union (only authored
   *  need is "click"); widen later if a real non-click case appears (non-breaking). */
  event: "click";
};

/** Shared popover content. `image` renders in a figure slot between title and description. */
export type PopoverContentBase = {
  title?: string;
  description?: string;
  /** Optional figure/illustration. The consumer owns the element's alt/aria; for a
   *  meaningful image whose text equivalent is already in `description`, pass an
   *  `aria-hidden` element. Rendered between title and description. */
  image?: ReactNode;
};

/** Layout/placement fields shared by anchored and selector popovers. */
export type AnchoredPopoverContent = PopoverContentBase & {
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  /** Fixed popover width. Number → pixels; string → raw CSS value (e.g. "20rem").
   *  Overrides the default `max-width: 320px` so larger values are honored. */
  width?: number | string;
  /** Cartesian shift applied to the popover's natural placement. Positive `x` = right;
   *  positive `y` = down. Combines with the engine-level `popoverOffset` (which sets the
   *  baseline gap between popover and anchor). Useful for fine-tuning a step that needs
   *  to nudge clear of overlapping UI without changing `side`/`align`. */
  anchorOffset?: { x?: number; y?: number };
};

export type AnchoredPopover = {
  element: HTMLElement;
  /** Element the outline (focus) ring is drawn around. Defaults to `element`.
   *  Set this to ring a different element than the popover is anchored to — e.g.
   *  anchor/center the popover over a small inner icon while ringing its larger
   *  interactive container. */
  ringElement?: HTMLElement;
  /** Action-gated advance: advance when `advanceOn.event` fires on `element`.
   *  Honored only in an `actionGated` engine; ignored otherwise. */
  advanceOn?: AdvanceTrigger;
  popover?: AnchoredPopoverContent;
  /** Within a PopoverGroup, focus this popover on step entry instead of popovers[0]. First-set-wins
   *  if multiple popovers in a group set this. Has no effect on a bare-popover step. */
  initialFocus?: boolean;
};

/** Like AnchoredPopover, but the anchor is a CSS selector resolved at step entry (and
 *  awaited if absent) instead of a live element. For tours whose later steps target
 *  controls that only appear after earlier steps' actions. Resolved to an element-anchored
 *  spec by the engine before it reaches the render layer. */
export type SelectorPopover = {
  element?: undefined;
  /** CSS selector resolved against the document when the step becomes active. If it does
   *  not yet match a laid-out element, the engine waits (MutationObserver) before entering
   *  the step, keeping the prior step shown. First match wins (`querySelector`). */
  target: string;
  /** Selector for the outline-ring target. Defaults to `target`. */
  ringTarget?: string;
  advanceOn?: AdvanceTrigger;
  popover?: AnchoredPopoverContent;
  initialFocus?: boolean;
};

export type ViewportPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "middle-left"
  | "center"
  | "middle-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

export type ViewportPopover = {
  element?: undefined;
  target?: undefined;
  popover: PopoverContentBase & {
    position: ViewportPosition;
    viewportOffset?: { x?: number; y?: number };
    /** Fixed popover width. Number → pixels; string → raw CSS value (e.g. "20rem").
     *  Overrides the default `max-width: 320px` so larger values are honored. */
    width?: number | string;
    /** Render a pointer arrow on one side of the popover, pointing away from it.
     *  Visual styling (width/height/strokeWidth/path/tipRadius) is shared with anchored
     *  popovers via the engine-level `arrow` option. `offset` shifts the arrow along the
     *  chosen edge (positive = toward right/bottom; negative = toward left/top). */
    arrow?: {
      side: "top" | "right" | "bottom" | "left";
      offset?: number;
    };
  };
  initialFocus?: boolean;
};

export type PopoverSpec = AnchoredPopover | SelectorPopover | ViewportPopover;

export type PopoverGroup = {
  /** Non-empty array. popovers[0] is the *primary* — it owns the step's Next / Previous /
   *  Done buttons and is the default initial-focus target. */
  popovers: [PopoverSpec, ...PopoverSpec[]];
  /** "individual" (default for groups): each close button dismisses only that popover.
   *  "group": any close button cancels the entire step. */
  dismissBehavior?: "individual" | "group";
};

export type EngineStep = PopoverSpec | PopoverGroup;

export interface EngineOptions {
  /** Action-gated tour: steps advance on the student's action (`advanceOn` / imperative
   *  `moveNext()`), not passive buttons. Hides Next/Previous on intermediate steps (the
   *  terminal Done button is kept), suppresses Arrow-key navigation, does not pull focus on
   *  advance, enables wait-for-target on selector-anchored steps, and degrades a step to an
   *  anchorless centered popover (instead of cancelling) when its anchor leaves layout.
   *  Default false (today's button-driven tours, unchanged). */
  actionGated?: boolean;

  /** Render the hazbot-theme robot avatar badge on this engine's popovers. Default true.
   *  Only the hazbot theme paints it (base/codap hide it via CSS), so this is effectively a
   *  hazbot-theme opt-out. Set false on a popover that should not show it (e.g. an intro
   *  highlight that already points at the robot). The badge is decorative (`aria-hidden`). */
  showAvatar?: boolean;

  showButtons?: ("next" | "previous" | "close")[];
  disableButtons?: ("next" | "previous")[];
  showProgress?: boolean;
  /** Draw the outline (focus) ring around each anchored popover's ring target.
   *  Default true. Set false to suppress the ring entirely (popover + arrow still
   *  render). */
  showOutlineRing?: boolean;
  allowKeyboardControl?: boolean;
  allowClose?: boolean;
  animate?: boolean;
  smoothScroll?: boolean;
  popoverOffset?: number;
  progressText?: string;
  nextBtnText?: string;
  prevBtnText?: string;
  doneBtnText?: string;
  draggable?: boolean;

  /** Pull focus to the popover when an iframe is the active element. Default true. */
  pullFocusFromIframe?: boolean;

  /** Parse a constrained markdown subset (bold `**…**` / `__…__`) in the popover
   *  description. Default true. HTML is always escaped (never injected). Set false
   *  to render the description verbatim. */
  parseMarkdown?: boolean;

  /** Optional close-icon override. Default: bundled coachmarks close icon. */
  closeIcon?: ReactNode;

  /** aria-label for the popover (used only when the active step has no popover.title). Default "Help". */
  ariaLabel?: string;

  /** aria-label for the close button. Default "Close". */
  closeBtnAriaLabel?: string;

  /** Heading level for the popover title. Default 2 (renders as <h2>). */
  titleHeadingLevel?: 1 | 2 | 3 | 4 | 5 | 6;

  /** Initial-focus behavior on popover open and on each step transition. Default "popover". */
  initialFocus?: "popover" | "first-button" | "none";

  /** Customize FloatingArrow shape. Pass through to @floating-ui/react's FloatingArrow. */
  arrow?: {
    path?: string;
    width?: number;
    height?: number;
    tipRadius?: number;
    strokeWidth?: number;
  };
}

export interface EngineLifecycleState {
  activeIndex: number;
}

export interface EngineCallbacks {
  /** Called once per step after the primary popover has mounted and (for anchored steps)
   *  floating-ui has reported its first computed position. Fires once per step (groups
   *  included). First arg is the primary popover's anchor element, or undefined for
   *  viewport-positioned primaries. */
  onHighlightStarted?: (
    el: HTMLElement | undefined,
    step: EngineStep,
    ctx: { state: EngineLifecycleState },
  ) => void;
  /** Called when the current step is being torn down. */
  onDeselected?: () => void;
  /** Called when the engine is torn down (any path). */
  onDestroyed?: () => void;
  /** Called when the engine needs the manager to cancel: user clicked close, pressed Escape,
   *  or a primary anchor was removed mid-step. */
  onCancelRequested?: () => void;
  /** Called when an individual popover is dismissed under "individual" mode. Index 0 is the
   *  primary; 1+ are companions. Does not fire under "group" mode or for involuntary hides. */
  onPopoverDismissed?: (popoverIndex: number, step: EngineStep) => void;
}

export interface CreateCoachmarksEngineArgs
  extends EngineOptions,
    EngineCallbacks {}

export interface EngineHandle {
  drive(steps: EngineStep[]): void;
  highlight(step: EngineStep): void;
  moveNext(): void;
  movePrevious(): void;
  moveTo(index: number): void;
  refresh(): void;
  destroy(): void;
  dismissPopover(index: number): void;
}
