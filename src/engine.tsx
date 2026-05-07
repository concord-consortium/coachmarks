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
} from "./types";
import { warnings } from "./warnings";

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
    moveNext: () => moveNext(),
    movePrevious: () => movePrevious(),
    cancel: () => {
      const s = store.getSnapshot();
      if (!s.active || s.destroyed) return;
      s.callbacks.onCancelRequested?.();
    },
    dismissPopover: (idx: number) => dismissPopoverInternal(idx),
    dropCompanionSilently: (idx: number) => dropCompanionSilentlyInternal(idx),
  });

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
    const popovers = popoversOf(step);
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

  function leaveStep() {
    const s = store.getSnapshot();
    if (!s.active) return;
    s.callbacks.onDeselected?.();
  }

  function startStepWithDeferral(
    step: EngineStep,
    indexInSequence: number,
    seqId: number,
  ) {
    const popovers = popoversOf(step);
    const primary = popovers[0];

    if (!primary.element) {
      checkCompanionsAndEnter(step, indexInSequence, seqId, new Set());
      return;
    }
    if (isLaidOut(primary.element)) {
      checkCompanionsAndEnter(step, indexInSequence, seqId, new Set());
      return;
    }
    requestAnimationFrame(() => {
      const cur = store.getSnapshot();
      if (cur.destroyed || cur.seqId !== seqId) return;
      // primary.element is non-null here: the !primary.element early return
      // above means we only reach the rAF when it was set.
      if (isLaidOut(primary.element as HTMLElement)) {
        checkCompanionsAndEnter(step, indexInSequence, seqId, new Set());
      } else {
        cur.callbacks.onCancelRequested?.();
      }
    });
  }

  function checkCompanionsAndEnter(
    step: EngineStep,
    indexInSequence: number,
    seqId: number,
    dismissed: Set<number>,
  ) {
    const popovers = popoversOf(step);
    if (popovers.length === 1) {
      enterStep(indexInSequence, dismissed);
      return;
    }
    const needsRaf: number[] = [];
    for (let i = 1; i < popovers.length; i++) {
      const p = popovers[i];
      if (!p.element) continue;
      if (isLaidOut(p.element)) continue;
      needsRaf.push(i);
    }
    if (needsRaf.length === 0) {
      enterStep(indexInSequence, dismissed);
      return;
    }
    requestAnimationFrame(() => {
      const cur = store.getSnapshot();
      if (cur.destroyed || cur.seqId !== seqId) return;
      for (const i of needsRaf) {
        // p.element is non-null: needsRaf only collected indices where
        // p.element was set above.
        const p = popovers[i] as { element: HTMLElement };
        if (isLaidOut(p.element)) continue;
        dismissed.add(i);
        devWarn(warnings.companionDropped(i));
      }
      enterStep(indexInSequence, dismissed);
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
      };
    });
    if (wasActive) before.callbacks.onDeselected?.();
    if (!firstStep) return;
    startStepWithDeferral(firstStep, 0, mySeqId);
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
      };
    });
    if (wasActive) before.callbacks.onDeselected?.();
    startStepWithDeferral(step, 0, mySeqId);
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
    leaveStep();
    enterStep(next);
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
    leaveStep();
    enterStep(prev);
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
    leaveStep();
    enterStep(index);
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
