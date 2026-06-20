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
  /** Gated degrade-on-removal: re-render the active step's primary as an anchorless
   *  centered popover (keeping content + step number + buttons) instead of cancelling.
   *  No-op outside an `actionGated` engine. Does NOT bump `activeIndex`/`seqId`. */
  degradeCurrentStep(): void;
  /** Fire `onHighlightStarted` at most once per step (keyed on `seqId:activeIndex`),
   *  surviving a degrade re-mount of the primary popover. Called by the primary popover
   *  once mounted and (for anchored steps) positioned. */
  fireHighlightStarted(activeIndex: number): void;
  destroyed: boolean;
  seqId: number;
  /** Disposer for a pending wait-for-target, or null when none is in flight. A non-null
   *  value also means "an advance is committed and waiting" — used as the single-in-flight
   *  re-entrancy guard and to distinguish degrade case (a) held-during-wait from (b). */
  waitDispose: (() => void) | null;
  /** Bumped on each gated degrade so the (otherwise activeIndex-keyed) focus effect can
   *  re-pull focus to a degraded terminal Done step. */
  degradeSeq: number;
}
