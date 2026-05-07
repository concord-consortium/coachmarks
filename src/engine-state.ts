import type {
  EngineCallbacks,
  EngineOptions,
  EngineStep,
  PopoverGroup,
  PopoverSpec,
} from "./types";

/** Discriminate `EngineStep` (PopoverSpec | PopoverGroup) on the presence of `popovers`. */
export function isGroup(step: EngineStep): step is PopoverGroup {
  return "popovers" in step && Array.isArray((step as PopoverGroup).popovers);
}

/** Normalize an `EngineStep` into the array of popovers the rendering layer iterates. */
export function popoversOf(step: EngineStep): PopoverSpec[] {
  return isGroup(step) ? step.popovers : [step];
}

/** Bare `PopoverSpec` steps cannot type `dismissBehavior` (the field lives on
 *  `PopoverGroup`), but the engine still needs an effective value to drive the
 *  close-button branch. Bare specs collapse to `"group"` so a single-popover
 *  Close cancels the step (today's contract). Groups respect the explicit
 *  field, defaulting to `"individual"`. */
const BARE_SPEC_DEFAULT_DISMISS = "group" as const;

/** Resolve the active step's effective `dismissBehavior`. */
export function dismissBehaviorOf(step: EngineStep): "individual" | "group" {
  if (!isGroup(step)) return BARE_SPEC_DEFAULT_DISMISS;
  return step.dismissBehavior ?? "individual";
}

export interface EngineLiveState {
  active: boolean;
  kind: "highlight" | "tour";
  activeIndex: number;
  steps: EngineStep[];
  currentStep: EngineStep | null;
  /** Normalized list of popovers for the current step. */
  currentPopovers: PopoverSpec[];
  /** Indices into `currentPopovers` that have been dismissed. */
  dismissedPopoverIndices: Set<number>;
  options: EngineOptions;
  callbacks: EngineCallbacks;
  refreshTick: number;
  preFocusAnchor: HTMLElement | null;
  moveNext(): void;
  movePrevious(): void;
  cancel(): void;
  dismissPopover(popoverIndex: number): void;
  /** Silent companion drop for involuntary hides (target watcher detects the
   *  anchor lost its layout box). Adds the index to `dismissedPopoverIndices`
   *  and emits a development warning, but does NOT fire `onPopoverDismissed`. */
  dropCompanionSilently(popoverIndex: number): void;
  destroyed: boolean;
  seqId: number;
}
