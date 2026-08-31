import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Capture how the ring subscribes to its target. `autoUpdate` is the only piece that
// tracks a target which MOVES without resizing, so the tests below drive its `update`
// callback directly; jsdom has no IntersectionObserver to fire the real one.
const autoUpdateMock = vi.hoisted(() => ({
  calls: [] as {
    reference: unknown;
    floating: unknown;
    update: () => void;
  }[],
  disposed: 0,
}));

vi.mock("@floating-ui/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@floating-ui/react")>();
  return {
    ...actual,
    autoUpdate: (reference: unknown, floating: unknown, update: () => void) => {
      autoUpdateMock.calls.push({ reference, floating, update });
      return () => {
        autoUpdateMock.disposed++;
      };
    },
  };
});
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

// Reset on the way IN, not out: Testing Library's auto-cleanup unmounts the previous
// test's tree from its own afterEach, which disposes that test's subscription after
// this file's afterEach has already run.
beforeEach(() => {
  autoUpdateMock.calls.length = 0;
  autoUpdateMock.disposed = 0;
});

/** Re-stub an anchor's rect (`makeLaidOutDiv` already mocked the method). */
function moveTo(
  el: HTMLElement,
  rect: { left: number; top: number; width: number; height: number },
): void {
  vi.mocked(el.getBoundingClientRect).mockReturnValue({
    ...rect,
    right: rect.left + rect.width,
    bottom: rect.top + rect.height,
    x: rect.left,
    y: rect.top,
    toJSON: () => ({}),
  } as DOMRect);
}

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

  it("follows the target's per-corner radius (target radius + 2px outset)", () => {
    const target = makeAnchor({ top: 10, left: 20, width: 40, height: 30 });
    // Tab-shaped control: rounded top corners, square bottom (like the bottom-bar end buttons).
    target.style.borderTopLeftRadius = "10px";
    target.style.borderTopRightRadius = "10px";
    target.style.borderBottomRightRadius = "0px";
    target.style.borderBottomLeftRadius = "0px";
    const container = makeContainer();
    const step: PopoverSpec = { element: target, popover: { title: "T" } };
    const store = createStore<EngineLiveState>(makeState(step));
    render(<OutlineRings store={store} container={container} />);
    const ring = screen.getByTestId("coachmarks-outline-ring");
    expect(ring.style.borderTopLeftRadius).toBe("12px");
    expect(ring.style.borderTopRightRadius).toBe("12px");
    expect(ring.style.borderBottomRightRadius).toBe("2px");
    expect(ring.style.borderBottomLeftRadius).toBe("2px");
  });

  it("offsets the ring by the themed --coachmarks-ring-width (3px) so the stroke stays flush", () => {
    document.documentElement.style.setProperty(
      "--coachmarks-ring-width",
      "3px",
    );
    try {
      const target = makeAnchor({ top: 10, left: 20, width: 40, height: 30 });
      target.style.borderTopLeftRadius = "9px";
      target.style.borderTopRightRadius = "9px";
      const container = makeContainer();
      const step: PopoverSpec = { element: target, popover: { title: "T" } };
      const store = createStore<EngineLiveState>(makeState(step));
      render(<OutlineRings store={store} container={container} />);
      const ring = screen.getByTestId("coachmarks-outline-ring");
      // Inflated by 3px on every side, radii += 3.
      expect(ring.style.top).toBe("7px");
      expect(ring.style.left).toBe("17px");
      expect(ring.style.width).toBe("46px");
      expect(ring.style.height).toBe("36px");
      expect(ring.style.borderTopLeftRadius).toBe("12px");
      expect(ring.style.borderBottomLeftRadius).toBe("3px");
    } finally {
      document.documentElement.style.removeProperty("--coachmarks-ring-width");
    }
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

  it("tracks the target with autoUpdate, wired to the target and the rendered ring", () => {
    const target = makeAnchor({ top: 10, left: 20, width: 40, height: 30 });
    const container = makeContainer();
    const step: PopoverSpec = { element: target, popover: { title: "T" } };
    const store = createStore<EngineLiveState>(makeState(step));
    render(<OutlineRings store={store} container={container} />);
    const ring = screen.getByTestId("coachmarks-outline-ring");
    expect(autoUpdateMock.calls.length).toBe(1);
    expect(autoUpdateMock.calls[0].reference).toBe(target);
    expect(autoUpdateMock.calls[0].floating).toBe(ring);
  });

  it("re-measures when the target moves without changing size", () => {
    const target = makeAnchor({ top: 10, left: 20, width: 40, height: 30 });
    const container = makeContainer();
    const step: PopoverSpec = { element: target, popover: { title: "T" } };
    const store = createStore<EngineLiveState>(makeState(step));
    render(<OutlineRings store={store} container={container} />);
    const ring = screen.getByTestId("coachmarks-outline-ring");
    expect(ring.style.left).toBe("18px");
    expect(autoUpdateMock.calls.length).toBe(1);
    // Same size, new position: the case a ResizeObserver on the target cannot see.
    moveTo(target, { top: 10, left: 500, width: 40, height: 30 });
    act(() => {
      autoUpdateMock.calls[0].update();
    });
    expect(ring.style.left).toBe("498px");
    expect(ring.style.width).toBe("44px");
  });

  it("disposes the autoUpdate subscription when the ring unmounts", () => {
    const target = makeAnchor();
    const container = makeContainer();
    const step: PopoverSpec = { element: target, popover: { title: "T" } };
    const store = createStore<EngineLiveState>(makeState(step));
    const { unmount } = render(
      <OutlineRings store={store} container={container} />,
    );
    expect(autoUpdateMock.calls.length).toBe(1);
    expect(autoUpdateMock.disposed).toBe(0);
    unmount();
    expect(autoUpdateMock.disposed).toBe(1);
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
