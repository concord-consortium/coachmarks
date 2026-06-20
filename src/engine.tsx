import { type Root as ReactRoot, createRoot } from "react-dom/client";
import {
  type EngineLiveState,
  dismissBehaviorOf,
  isGroup,
  popoversOf,
} from "./engine-state";
import { isLaidOut } from "./is-laid-out";
import { Root } from "./root";
import { createStore } from "./store";
import type {
  CreateCoachmarksEngineArgs,
  EngineHandle,
  EngineStep,
  PopoverSpec,
  SelectorPopover,
  ViewportPopover,
} from "./types";
import { waitForTarget } from "./wait-for-target";
import { warnings } from "./warnings";

/** A selector-anchored popover whose target has not yet been resolved to a live element. */
function isSelector(spec: PopoverSpec): spec is SelectorPopover {
  return (
    spec.element == null && typeof (spec as SelectorPopover).target === "string"
  );
}

/** Resolve a `SelectorPopover` to an element-anchored spec by querying the document.
 *  `element`/`ringElement` may be undefined if the selector does not currently match.
 *  Non-selector specs pass through unchanged. */
function resolvePopover(spec: PopoverSpec): PopoverSpec {
  if (!isSelector(spec)) return spec;
  const element = document.querySelector<HTMLElement>(spec.target) ?? undefined;
  const ringSelector = spec.ringTarget ?? spec.target;
  const ringElement =
    document.querySelector<HTMLElement>(ringSelector) ?? undefined;
  // Cast: when `element` is found this is an AnchoredPopover (with a harmless extra
  // `target`); the primary is always laid-out before entry (goToStep waits), so an
  // undefined `element` only occurs for an absent companion, handled downstream.
  return { ...spec, element, ringElement } as PopoverSpec;
}

function resolvePopovers(specs: PopoverSpec[]): PopoverSpec[] {
  return specs.map(resolvePopover);
}

const IS_DEV = process.env.NODE_ENV !== "production";

function devWarn(msg: string) {
  if (IS_DEV) console.warn(`[coachmarks] ${msg}`);
}

export function createCoachmarksEngine(
  args: CreateCoachmarksEngineArgs = {},
): EngineHandle {
  const {
    onHighlightStarted,
    onDeselected,
    onDestroyed,
    onCancelRequested,
    onPopoverDismissed,
    ...rawOptions
  } = args;

  // Validate titleHeadingLevel.
  const options = { ...rawOptions };
  if (options.titleHeadingLevel !== undefined) {
    const lvl = options.titleHeadingLevel;
    if (!Number.isInteger(lvl) || lvl < 1 || lvl > 6) {
      devWarn(warnings.titleHeadingLevelInvalid(lvl));
      options.titleHeadingLevel = 2;
    }
  }

  const store = createStore<EngineLiveState>({
    active: false,
    kind: "tour",
    activeIndex: 0,
    steps: [],
    currentStep: null,
    currentPopovers: [],
    dismissedPopoverIndices: new Set(),
    options,
    callbacks: {
      onHighlightStarted,
      onDeselected,
      onDestroyed,
      onCancelRequested,
      onPopoverDismissed,
    },
    refreshTick: 0,
    preFocusAnchor: null,
    destroyed: false,
    seqId: 0,
    waitDispose: null,
    degradeSeq: 0,
    moveNext: () => moveNext(),
    movePrevious: () => movePrevious(),
    cancel: () => {
      const s = store.getSnapshot();
      if (!s.active || s.destroyed) return;
      s.callbacks.onCancelRequested?.();
    },
    dismissPopover: (idx: number) => dismissPopoverInternal(idx),
    dropCompanionSilently: (idx: number) => dropCompanionSilentlyInternal(idx),
    degradeCurrentStep: () => degradeCurrentStep(),
    fireHighlightStarted: (activeIndex: number) =>
      fireHighlightStartedOnce(activeIndex),
  });

  // onHighlightStarted dedup latch lives here (not in the popover) so it survives the
  // anchored→centered remount of a degraded primary: a degrade re-render must NOT
  // re-fire onHighlightStarted for the same step.
  let firedHighlightKey: string | null = null;

  const container = document.createElement("div");
  container.setAttribute("data-testid", "coachmarks-root");
  document.body.appendChild(container);
  const reactRoot: ReactRoot = createRoot(container);
  reactRoot.render(<Root store={store} container={container} />);

  function captureActiveElement(): HTMLElement | null {
    const a = document.activeElement;
    return a && a !== document.body ? (a as HTMLElement) : null;
  }

  function enterStep(index: number, initialDismissed: Set<number> = new Set()) {
    const s = store.getSnapshot();
    const step = s.steps[index];
    if (!step) return;
    // Resolve selector targets to live elements before storing: the render layer
    // (popover.tsx / outline-ring.tsx) only ever sees element-anchored or viewport
    // specs. `currentStep` keeps the authored step (selectors intact); `currentPopovers`
    // holds the resolved element-anchored specs.
    const popovers = resolvePopovers(popoversOf(step));
    store.setState((prev) => ({
      ...prev,
      activeIndex: index,
      currentStep: step,
      currentPopovers: popovers,
      dismissedPopoverIndices: initialDismissed,
      active: true,
      preFocusAnchor: prev.preFocusAnchor ?? captureActiveElement(),
    }));
    // onHighlightStarted is fired by the primary Popover once it has mounted
    // and (for anchored steps) floating-ui has reported isPositioned. This
    // ensures consumer code that touches the popover or its rect runs after
    // it's been placed.
  }

  // Fire onHighlightStarted at most once per step (keyed on seqId:activeIndex). The latch
  // lives in the engine closure, not the popover, so a degrade remount of the primary does
  // not re-fire it. seqId bumps on drive()/highlight() so stale keys never collide.
  function fireHighlightStartedOnce(activeIndex: number) {
    const s = store.getSnapshot();
    if (s.destroyed || !s.currentStep) return;
    const key = `${s.seqId}:${activeIndex}`;
    if (firedHighlightKey === key) return;
    firedHighlightKey = key;
    const primaryAnchor = s.currentPopovers[0]?.element;
    s.callbacks.onHighlightStarted?.(primaryAnchor, s.currentStep, {
      state: { activeIndex },
    });
  }

  function leaveStep() {
    const s = store.getSnapshot();
    if (!s.active) return;
    s.callbacks.onDeselected?.();
  }

  function startStepWithDeferral(index: number, seqId: number) {
    const s = store.getSnapshot();
    const step = s.steps[index];
    if (!step) return;
    const primary = resolvePopover(popoversOf(step)[0]);

    if (!primary.element) {
      checkCompanionsAndEnter(index, seqId, new Set());
      return;
    }
    if (isLaidOut(primary.element)) {
      checkCompanionsAndEnter(index, seqId, new Set());
      return;
    }
    requestAnimationFrame(() => {
      const cur = store.getSnapshot();
      if (cur.destroyed || cur.seqId !== seqId) return;
      // primary.element is non-null here: the !primary.element early return
      // above means we only reach the rAF when it was set.
      if (isLaidOut(primary.element as HTMLElement)) {
        checkCompanionsAndEnter(index, seqId, new Set());
      } else {
        cur.callbacks.onCancelRequested?.();
      }
    });
  }

  function checkCompanionsAndEnter(
    index: number,
    seqId: number,
    dismissed: Set<number>,
  ) {
    const s = store.getSnapshot();
    const step = s.steps[index];
    if (!step) return;
    const popovers = resolvePopovers(popoversOf(step));
    if (popovers.length === 1) {
      enterStep(index, dismissed);
      return;
    }
    const needsRaf: number[] = [];
    for (let i = 1; i < popovers.length; i++) {
      const p = popovers[i];
      if (!p.element) {
        // An unresolved selector companion (carries `target`, no live element) is dropped
        // like a not-laid-out anchor so it never reaches the render layer as a malformed
        // viewport bubble. A genuine ViewportPopover companion (no `target`) stays.
        if (typeof (p as SelectorPopover).target === "string") {
          dismissed.add(i);
          devWarn(warnings.companionDropped(i));
        }
        continue;
      }
      if (isLaidOut(p.element)) continue;
      needsRaf.push(i);
    }
    if (needsRaf.length === 0) {
      enterStep(index, dismissed);
      return;
    }
    requestAnimationFrame(() => {
      const cur = store.getSnapshot();
      if (cur.destroyed || cur.seqId !== seqId) return;
      const resolved = resolvePopovers(popoversOf(step));
      for (const i of needsRaf) {
        const p = resolved[i];
        if (p.element && isLaidOut(p.element)) continue;
        dismissed.add(i);
        devWarn(warnings.companionDropped(i));
      }
      enterStep(index, dismissed);
    });
  }

  // Single entry point for every step transition (drive/highlight first step, moveNext,
  // movePrevious, moveTo). Routes selector-anchored steps through wait-for-target and
  // live-element/viewport steps through the existing deferral (which keeps the
  // cancel-on-not-laid-out back-compat path).
  function goToStep(index: number, isInitial: boolean) {
    const s = store.getSnapshot();
    if (s.destroyed) return;
    // Single in-flight wait (re-entrancy guard): while a wait-for-target is pending the engine
    // is committed to leaving the current step for the already-chosen next index, so no-op ANY
    // new advance — including an imperative move to a non-selector step — until it resolves.
    // Otherwise the pending wait leaks and later fires a second transition.
    if (s.waitDispose) return;
    const step = s.steps[index];
    if (!step) return;
    const primary = popoversOf(step)[0];
    const seqId = s.seqId;

    if (isSelector(primary)) {
      const el = document.querySelector<HTMLElement>(primary.target);
      if (el && isLaidOut(el)) {
        commitTransition(index, isInitial, seqId);
        return;
      }
      // Target absent/not-laid-out: wait for it to appear, holding the current step.
      const dispose = waitForTarget(primary.target, () => {
        const cur = store.getSnapshot();
        if (cur.destroyed || cur.seqId !== seqId) return;
        store.setState((prev) => ({ ...prev, waitDispose: null }));
        commitTransition(index, isInitial, seqId);
      });
      store.setState((prev) => ({ ...prev, waitDispose: dispose }));
      return;
    }

    commitTransition(index, isInitial, seqId);
  }

  function commitTransition(index: number, isInitial: boolean, seqId: number) {
    if (!isInitial) leaveStep();
    startStepWithDeferral(index, seqId);
  }

  // Gated degrade-on-removal: when an actionGated step's primary anchor leaves layout,
  // re-render the step as an anchorless centered popover (same content / step number /
  // buttons, no arrow) instead of cancelling. Same-step invariant: does NOT bump
  // activeIndex/seqId, so onHighlightStarted/onDeselected do not re-fire.
  function degradeCurrentStep() {
    const s = store.getSnapshot();
    if (s.destroyed || !s.active || !s.currentStep) return;
    if (!s.options.actionGated) return;
    const primary = s.currentPopovers[0];
    if (!primary) return;
    // Already degraded (anchorless centered)? Don't churn.
    if (!primary.element && (primary as ViewportPopover).popover?.position)
      return;
    const content = primary.popover ?? {};
    const degraded: ViewportPopover = {
      element: undefined,
      popover: {
        title: content.title,
        description: content.description,
        image: content.image,
        position: "center",
        ...(content.width != null ? { width: content.width } : null),
      },
    };
    store.setState((prev) => {
      const next = [...prev.currentPopovers];
      next[0] = degraded;
      return {
        ...prev,
        currentPopovers: next,
        degradeSeq: prev.degradeSeq + 1,
      };
    });
  }

  function dropCompanionSilentlyInternal(idx: number) {
    const s = store.getSnapshot();
    if (s.destroyed || !s.active || !s.currentStep) return;
    if (idx <= 0 || idx >= s.currentPopovers.length) return;
    if (s.dismissedPopoverIndices.has(idx)) return;
    store.setState((prev) => {
      const next = new Set(prev.dismissedPopoverIndices);
      next.add(idx);
      return { ...prev, dismissedPopoverIndices: next };
    });
    devWarn(warnings.companionDropped(idx));
  }

  function dismissPopoverInternal(idx: number) {
    const s = store.getSnapshot();
    if (s.destroyed) {
      devWarn(warnings.postDestroy("dismissPopover"));
      return;
    }
    if (!s.active || !s.currentStep) {
      devWarn(warnings.dismissPopoverNoActive());
      return;
    }
    const behavior = dismissBehaviorOf(s.currentStep);

    if (!isGroup(s.currentStep)) {
      if (idx === 0) {
        s.callbacks.onCancelRequested?.();
        return;
      }
      devWarn(warnings.dismissPopoverBareOutOfBounds(idx));
      return;
    }

    if (behavior === "group") {
      devWarn(warnings.dismissPopoverGroupMode(idx));
      return;
    }

    const popovers = s.currentPopovers;
    if (idx < 0 || idx >= popovers.length) {
      devWarn(warnings.dismissPopoverOutOfBounds(idx, popovers.length));
      return;
    }
    if (s.dismissedPopoverIndices.has(idx)) return;

    if (idx === 0) {
      s.callbacks.onPopoverDismissed?.(0, s.currentStep);
      s.callbacks.onCancelRequested?.();
      return;
    }

    store.setState((prev) => {
      const next = new Set(prev.dismissedPopoverIndices);
      next.add(idx);
      return { ...prev, dismissedPopoverIndices: next };
    });
    s.callbacks.onPopoverDismissed?.(idx, s.currentStep);
  }

  function drive(steps: EngineStep[]) {
    const before = store.getSnapshot();
    if (before.destroyed) {
      devWarn(warnings.postDestroy("drive"));
      return;
    }
    warnOnElementPositionCollisions(steps);
    const firstStep = steps.length > 0 ? steps[0] : null;
    if (firstStep && popoversOf(firstStep).length === 0) {
      devWarn(warnings.emptyPopovers());
      return;
    }
    // setState before firing onDeselected so consumers reading state from
    // inside the callback see "no current step" (not the stale prior step).
    // The seqId increment is inside the updater so re-entrant drive()/
    // highlight() from inside onDeselected can't collide on a stale read.
    const wasActive = before.active;
    before.waitDispose?.();
    let mySeqId = 0;
    store.setState((prev) => {
      mySeqId = prev.seqId + 1;
      return {
        ...prev,
        kind: "tour",
        steps,
        activeIndex: 0,
        active: false,
        currentStep: null,
        currentPopovers: [],
        dismissedPopoverIndices: new Set(),
        seqId: mySeqId,
        waitDispose: null,
      };
    });
    if (wasActive) before.callbacks.onDeselected?.();
    if (!firstStep) return;
    goToStep(0, true);
  }

  function highlight(step: EngineStep) {
    const before = store.getSnapshot();
    if (before.destroyed) {
      devWarn(warnings.postDestroy("highlight"));
      return;
    }
    warnOnElementPositionCollisions([step]);
    if (popoversOf(step).length === 0) {
      devWarn(warnings.emptyPopovers());
      return;
    }
    const wasActive = before.active;
    before.waitDispose?.();
    let mySeqId = 0;
    store.setState((prev) => {
      mySeqId = prev.seqId + 1;
      return {
        ...prev,
        kind: "highlight",
        steps: [step],
        activeIndex: 0,
        active: false,
        currentStep: null,
        currentPopovers: [],
        dismissedPopoverIndices: new Set(),
        seqId: mySeqId,
        waitDispose: null,
      };
    });
    if (wasActive) before.callbacks.onDeselected?.();
    goToStep(0, true);
  }

  function moveNext() {
    const s = store.getSnapshot();
    if (s.destroyed) {
      devWarn(warnings.postDestroy("moveNext"));
      return;
    }
    if (!s.active) return;
    const next = s.activeIndex + 1;
    if (next >= s.steps.length) {
      destroy();
      return;
    }
    goToStep(next, false);
  }

  function movePrevious() {
    const s = store.getSnapshot();
    if (s.destroyed) {
      devWarn(warnings.postDestroy("movePrevious"));
      return;
    }
    if (!s.active) return;
    const prev = s.activeIndex - 1;
    if (prev < 0) return;
    goToStep(prev, false);
  }

  function moveTo(index: number) {
    const s = store.getSnapshot();
    if (s.destroyed) {
      devWarn(warnings.postDestroy("moveTo"));
      return;
    }
    if (!s.active) {
      devWarn(warnings.moveToNoActive());
      return;
    }
    if (index < 0 || index >= s.steps.length) {
      devWarn(warnings.moveToOutOfBounds(index, s.steps.length));
      return;
    }
    if (index === s.activeIndex) return;
    goToStep(index, false);
  }

  function refresh() {
    const s = store.getSnapshot();
    if (s.destroyed) {
      devWarn(warnings.postDestroy("refresh"));
      return;
    }
    if (!s.active) {
      devWarn(warnings.refreshNoActive());
      return;
    }
    store.setState((prev) => ({ ...prev, refreshTick: prev.refreshTick + 1 }));
  }

  function destroy() {
    const s = store.getSnapshot();
    if (s.destroyed) return;

    s.waitDispose?.();
    leaveStep();

    const active = document.activeElement as HTMLElement | null;
    const focusedPopoverEl = active?.closest(
      ".coachmarks-popover",
    ) as HTMLElement | null;
    const focusInEngine =
      !!focusedPopoverEl && container.contains(focusedPopoverEl);

    let focusTarget: HTMLElement | null = null;
    if (focusInEngine && s.currentStep) {
      const popovers = s.currentPopovers;
      const idxAttr = focusedPopoverEl?.getAttribute(
        "data-coachmarks-popover-index",
      );
      const idx = idxAttr === null ? 0 : Number(idxAttr);
      const focusedSpec = popovers[idx] ?? popovers[0];
      focusTarget = focusedSpec?.element ?? popovers[0]?.element ?? null;
    }
    const preAnchor = s.preFocusAnchor;

    store.setState((prev) => ({
      ...prev,
      active: false,
      currentStep: null,
      currentPopovers: [],
      dismissedPopoverIndices: new Set(),
      destroyed: true,
      waitDispose: null,
    }));

    if (focusInEngine) {
      if (focusTarget?.isConnected) {
        if (!focusTarget.hasAttribute("tabindex")) {
          focusTarget.setAttribute("tabindex", "-1");
        }
        focusTarget.focus({ preventScroll: true });
      } else if (preAnchor?.isConnected) {
        preAnchor.focus({ preventScroll: true });
      }
    }

    queueMicrotask(() => {
      reactRoot.unmount();
      container.remove();
    });

    s.callbacks.onDestroyed?.();
  }

  function warnOnElementPositionCollisions(steps: EngineStep[]) {
    if (!IS_DEV) return;
    for (let stepIdx = 0; stepIdx < steps.length; stepIdx++) {
      const step = steps[stepIdx];
      const popovers = popoversOf(step);
      for (let popIdx = 0; popIdx < popovers.length; popIdx++) {
        const specAny = popovers[popIdx] as {
          element?: HTMLElement;
          popover?: { position?: string };
        };
        if (specAny.element && specAny.popover?.position) {
          const where = isGroup(step)
            ? `step ${stepIdx} popover ${popIdx}`
            : `step ${stepIdx}`;
          devWarn(warnings.elementPositionCollision(where));
        }
      }
    }
  }

  return {
    drive,
    highlight,
    moveNext,
    movePrevious,
    moveTo,
    refresh,
    destroy,
    dismissPopover: dismissPopoverInternal,
  };
}
