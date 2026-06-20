import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { EngineLiveState } from "./engine-state";
import { OutlineRings } from "./outline-ring";
import { createStore } from "./store";
import {
  makeLaidOutDiv as makeAnchor,
  makeContainer,
} from "./test-utils/jsdom-anchor";
import type { EngineStep, PopoverGroup, PopoverSpec } from "./types";

afterEach(() => {
  document.body.innerHTML = "";
});

function makeState(step: EngineStep): EngineLiveState {
  const popovers: PopoverSpec[] =
    "popovers" in step ? [...step.popovers] : [step];
  return {
    active: true,
    kind: "tour",
    activeIndex: 0,
    steps: [step],
    currentStep: step,
    currentPopovers: popovers,
    dismissedPopoverIndices: new Set(),
    options: {},
    callbacks: {},
    refreshTick: 0,
    preFocusAnchor: null,
    moveNext: vi.fn(),
    movePrevious: vi.fn(),
    cancel: vi.fn(),
    dismissPopover: vi.fn(),
    dropCompanionSilently: vi.fn(),
    degradeCurrentStep: vi.fn(),
    fireHighlightStarted: vi.fn(),
    destroyed: false,
    seqId: 1,
    waitDispose: null,
    degradeSeq: 0,
  };
}

describe("OutlineRings", () => {
  it("renders one ring around an anchored popover with aria-hidden and pointer-events:none style class", () => {
    const target = makeAnchor();
    const container = makeContainer();
    const step: PopoverSpec = { element: target, popover: { title: "T" } };
    const store = createStore<EngineLiveState>(makeState(step));
    render(<OutlineRings store={store} container={container} />);
    const ring = screen.getByTestId("coachmarks-outline-ring");
    expect(ring.getAttribute("aria-hidden")).toBe("true");
    expect(ring.className).toContain("coachmarks-outline-ring");
  });

  it("rect inflates target rect by 2px on every side (top/left -2, width/height +4)", () => {
    const target = makeAnchor({ top: 10, left: 20, width: 40, height: 30 });
    const container = makeContainer();
    const step: PopoverSpec = { element: target, popover: { title: "T" } };
    const store = createStore<EngineLiveState>(makeState(step));
    render(<OutlineRings store={store} container={container} />);
    const ring = screen.getByTestId("coachmarks-outline-ring");
    expect(ring.style.top).toBe("8px");
    expect(ring.style.left).toBe("18px");
    expect(ring.style.width).toBe("44px");
    expect(ring.style.height).toBe("34px");
  });

  it("renders no ring for a viewport popover (no anchor element)", () => {
    const container = makeContainer();
    const step: PopoverSpec = {
      popover: { position: "top-center", title: "viewport" },
    } as PopoverSpec;
    const store = createStore<EngineLiveState>(makeState(step));
    render(<OutlineRings store={store} container={container} />);
    expect(screen.queryByTestId("coachmarks-outline-ring")).toBeNull();
  });

  it("renders one ring per anchored popover in a group", () => {
    const a1 = makeAnchor({ top: 10, left: 20, width: 40, height: 30 });
    const a2 = makeAnchor({ top: 100, left: 20, width: 40, height: 30 });
    const a3 = makeAnchor({ top: 200, left: 20, width: 40, height: 30 });
    const container = makeContainer();
    const group: PopoverGroup = {
      popovers: [
        { element: a1, popover: { title: "1" } },
        { element: a2, popover: { title: "2" } },
        { element: a3, popover: { title: "3" } },
      ],
    };
    const store = createStore<EngineLiveState>(makeState(group));
    render(<OutlineRings store={store} container={container} />);
    expect(screen.getAllByTestId("coachmarks-outline-ring").length).toBe(3);
  });

  it("mixed group with anchored + viewport popovers renders only the anchored ones' rings", () => {
    const a1 = makeAnchor({ top: 10, left: 20, width: 40, height: 30 });
    const container = makeContainer();
    const group: PopoverGroup = {
      popovers: [
        { element: a1, popover: { title: "anchored" } },
        {
          popover: { position: "top-center", title: "viewport" },
        } as PopoverSpec,
      ],
    };
    const store = createStore<EngineLiveState>(makeState(group));
    render(<OutlineRings store={store} container={container} />);
    expect(screen.getAllByTestId("coachmarks-outline-ring").length).toBe(1);
  });

  it("draws the ring around ringElement when it differs from the anchor", () => {
    const anchor = makeAnchor({ top: 10, left: 20, width: 40, height: 30 });
    const ringTarget = makeAnchor({
      top: 100,
      left: 200,
      width: 80,
      height: 60,
    });
    const container = makeContainer();
    const step: PopoverSpec = {
      element: anchor,
      ringElement: ringTarget,
      popover: { title: "T" },
    };
    const store = createStore<EngineLiveState>(makeState(step));
    render(<OutlineRings store={store} container={container} />);
    const ring = screen.getByTestId("coachmarks-outline-ring");
    // Inflated rect of ringTarget (not the anchor): top/left -2, width/height +4.
    expect(ring.style.top).toBe("98px");
    expect(ring.style.left).toBe("198px");
    expect(ring.style.width).toBe("84px");
    expect(ring.style.height).toBe("64px");
  });

  it("renders no ring when showOutlineRing is false", () => {
    const target = makeAnchor();
    const container = makeContainer();
    const step: PopoverSpec = { element: target, popover: { title: "T" } };
    const state = makeState(step);
    state.options = { showOutlineRing: false };
    const store = createStore<EngineLiveState>(state);
    render(<OutlineRings store={store} container={container} />);
    expect(screen.queryByTestId("coachmarks-outline-ring")).toBeNull();
  });

  it("dismissing a companion removes its ring on the next render", () => {
    const a1 = makeAnchor({ top: 10, left: 20, width: 40, height: 30 });
    const a2 = makeAnchor({ top: 100, left: 20, width: 40, height: 30 });
    const container = makeContainer();
    const group: PopoverGroup = {
      popovers: [
        { element: a1, popover: { title: "1" } },
        { element: a2, popover: { title: "2" } },
      ],
    };
    const store = createStore<EngineLiveState>(makeState(group));
    const { rerender: _ } = render(
      <OutlineRings store={store} container={container} />,
    );
    void _;
    expect(screen.getAllByTestId("coachmarks-outline-ring").length).toBe(2);
    act(() => {
      store.setState((s) => {
        const next = new Set(s.dismissedPopoverIndices);
        next.add(1);
        return { ...s, dismissedPopoverIndices: next };
      });
    });
    expect(screen.getAllByTestId("coachmarks-outline-ring").length).toBe(1);
  });
});
