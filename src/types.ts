import type { ReactNode } from "react";

export type AnchoredPopover = {
  element: HTMLElement;
  popover?: {
    title?: string;
    description?: string;
    side?: "top" | "right" | "bottom" | "left";
    align?: "start" | "center" | "end";
  };
  /** Within a PopoverGroup, focus this popover on step entry instead of popovers[0]. First-set-wins
   *  if multiple popovers in a group set this. Has no effect on a bare-popover step. */
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
  popover: {
    title?: string;
    description?: string;
    position: ViewportPosition;
    viewportOffset?: { x?: number; y?: number };
  };
  initialFocus?: boolean;
};

export type PopoverSpec = AnchoredPopover | ViewportPopover;

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
  showButtons?: ("next" | "previous" | "close")[];
  disableButtons?: ("next" | "previous")[];
  showProgress?: boolean;
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
