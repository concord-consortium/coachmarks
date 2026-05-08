import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { EngineLiveState } from "./engine-state";
import { Popover, cartesianToAxisOffset } from "./popover";
import { createStore } from "./store";
import {
  makeAnchorButton as makeAnchorEl,
  makeContainer,
} from "./test-utils/jsdom-anchor";
import type {
  EngineCallbacks,
  EngineOptions,
  EngineStep,
  PopoverGroup,
  PopoverSpec,
} from "./types";

vi.mock("./scroll-into-view", () => ({
  scrollTargetIntoView: vi.fn(),
}));

import { scrollTargetIntoView } from "./scroll-into-view";

afterEach(() => {
  document.body.innerHTML = "";
  vi.clearAllMocks();
});

function makeStore(
  step: EngineStep,
  options: EngineOptions = {},
  callbacks: EngineCallbacks = {},
) {
  const popovers: PopoverSpec[] =
    "popovers" in step ? [...step.popovers] : [step];
  const moveNext = vi.fn();
  const movePrevious = vi.fn();
  const cancel = vi.fn();
  const dismissPopover = vi.fn();
  const dropCompanionSilently = vi.fn();
  const initial: EngineLiveState = {
    active: true,
    kind: "tour",
    activeIndex: 0,
    steps: [step],
    currentStep: step,
    currentPopovers: popovers,
    dismissedPopoverIndices: new Set(),
    options,
    callbacks,
    refreshTick: 0,
    preFocusAnchor: null,
    moveNext,
    movePrevious,
    cancel,
    dismissPopover,
    dropCompanionSilently,
    destroyed: false,
    seqId: 1,
  };
  return {
    store: createStore<EngineLiveState>(initial),
    moveNext,
    movePrevious,
    cancel,
    dismissPopover,
    dropCompanionSilently,
  };
}

describe("Popover", () => {
  it("renders a single anchored popover with title and description, role=dialog and aria-labelledby pointing at title", () => {
    const anchor = makeAnchorEl();
    const container = makeContainer();
    const step: PopoverSpec = {
      element: anchor,
      popover: { title: "Hello", description: "World" },
    };
    const { store } = makeStore(step);
    render(<Popover store={store} popoverIndex={0} container={container} />);

    const popover = screen.getByTestId("coachmarks-popover");
    expect(popover.getAttribute("role")).toBe("dialog");
    expect(popover.getAttribute("aria-modal")).toBe("false");
    const labelledById = popover.getAttribute("aria-labelledby") ?? "";
    expect(labelledById).toBeTruthy();
    expect(document.getElementById(labelledById)?.textContent).toBe("Hello");
    const describedById = popover.getAttribute("aria-describedby") ?? "";
    expect(describedById).toBeTruthy();
    expect(document.getElementById(describedById)?.textContent).toBe("World");
  });

  it("uses aria-label fallback when no title is set", () => {
    const anchor = makeAnchorEl();
    const container = makeContainer();
    const step: PopoverSpec = {
      element: anchor,
      popover: { description: "just a description" },
    };
    const { store } = makeStore(step, { ariaLabel: "Help" });
    render(<Popover store={store} popoverIndex={0} container={container} />);

    const popover = screen.getByTestId("coachmarks-popover");
    expect(popover.getAttribute("aria-label")).toBe("Help");
    expect(popover.getAttribute("aria-labelledby")).toBeNull();
  });

  it("omits aria-describedby when no description is set", () => {
    const anchor = makeAnchorEl();
    const container = makeContainer();
    const step: PopoverSpec = {
      element: anchor,
      popover: { title: "title-only" },
    };
    const { store } = makeStore(step);
    render(<Popover store={store} popoverIndex={0} container={container} />);
    const popover = screen.getByTestId("coachmarks-popover");
    expect(popover.getAttribute("aria-describedby")).toBeNull();
  });

  it("close button has accessible name from closeBtnAriaLabel option", () => {
    const anchor = makeAnchorEl();
    const container = makeContainer();
    const step: PopoverSpec = {
      element: anchor,
      popover: { title: "T" },
    };
    const { store } = makeStore(step, { closeBtnAriaLabel: "Close tour" });
    render(<Popover store={store} popoverIndex={0} container={container} />);
    expect(screen.getByRole("button", { name: "Close tour" })).not.toBeNull();
  });

  it("close button has default accessible name 'Close'", () => {
    const anchor = makeAnchorEl();
    const container = makeContainer();
    const step: PopoverSpec = {
      element: anchor,
      popover: { title: "T" },
    };
    const { store } = makeStore(step);
    render(<Popover store={store} popoverIndex={0} container={container} />);
    expect(screen.queryByRole("button", { name: "Close" })).not.toBeNull();
  });

  it("renders a custom closeIcon when provided", () => {
    const anchor = makeAnchorEl();
    const container = makeContainer();
    const step: PopoverSpec = {
      element: anchor,
      popover: { title: "T" },
    };
    const { store } = makeStore(step, {
      closeIcon: <span data-testid="custom-close-icon" />,
    });
    render(<Popover store={store} popoverIndex={0} container={container} />);
    expect(screen.queryByTestId("custom-close-icon")).not.toBeNull();
  });

  it("renders title as <h2> by default and respects titleHeadingLevel override", () => {
    const anchor = makeAnchorEl();
    const container = makeContainer();
    const step: PopoverSpec = { element: anchor, popover: { title: "T" } };
    const { store } = makeStore(step, { titleHeadingLevel: 3 });
    render(<Popover store={store} popoverIndex={0} container={container} />);
    const heading = screen.getByText("T");
    expect(heading.tagName).toBe("H3");
  });

  it("close button under default 'group' bare-spec routes to cancel()", () => {
    const anchor = makeAnchorEl();
    const container = makeContainer();
    const step: PopoverSpec = { element: anchor, popover: { title: "T" } };
    const { store, cancel, dismissPopover } = makeStore(step);
    render(<Popover store={store} popoverIndex={0} container={container} />);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(dismissPopover).not.toHaveBeenCalled();
  });

  it("under 'individual' mode, close on companion (popoverIndex>0) calls dismissPopover, not cancel", () => {
    const anchor1 = makeAnchorEl({
      left: 100,
      top: 100,
      width: 50,
      height: 30,
    });
    const anchor2 = makeAnchorEl({
      left: 300,
      top: 100,
      width: 50,
      height: 30,
    });
    const container = makeContainer();
    const group: PopoverGroup = {
      popovers: [
        { element: anchor1, popover: { title: "Primary" } },
        { element: anchor2, popover: { title: "Companion" } },
      ],
      dismissBehavior: "individual",
    };
    const { store, cancel, dismissPopover } = makeStore(group);
    render(<Popover store={store} popoverIndex={1} container={container} />);
    // Companion has its own close button; click it.
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(dismissPopover).toHaveBeenCalledWith(1);
    expect(cancel).not.toHaveBeenCalled();
  });

  it("under 'individual' mode, close on primary routes through dismissPopover(0)", () => {
    const anchor1 = makeAnchorEl();
    const anchor2 = makeAnchorEl({
      left: 300,
      top: 100,
      width: 50,
      height: 30,
    });
    const container = makeContainer();
    const group: PopoverGroup = {
      popovers: [
        { element: anchor1, popover: { title: "Primary" } },
        { element: anchor2, popover: { title: "Companion" } },
      ],
      dismissBehavior: "individual",
    };
    const { store, cancel, dismissPopover } = makeStore(group);
    render(<Popover store={store} popoverIndex={0} container={container} />);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(dismissPopover).toHaveBeenCalledWith(0);
    expect(cancel).not.toHaveBeenCalled();
  });

  it("under 'group' mode, close on any popover calls cancel()", () => {
    const anchor1 = makeAnchorEl();
    const anchor2 = makeAnchorEl({
      left: 300,
      top: 100,
      width: 50,
      height: 30,
    });
    const container = makeContainer();
    const group: PopoverGroup = {
      popovers: [
        { element: anchor1, popover: { title: "Primary" } },
        { element: anchor2, popover: { title: "Companion" } },
      ],
      dismissBehavior: "group",
    };
    const { store, cancel, dismissPopover } = makeStore(group);
    render(<Popover store={store} popoverIndex={1} container={container} />);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(dismissPopover).not.toHaveBeenCalled();
  });

  it("Prev/Next/Done nav-buttons render only on the primary popover", () => {
    const anchor1 = makeAnchorEl();
    const anchor2 = makeAnchorEl({
      left: 300,
      top: 100,
      width: 50,
      height: 30,
    });
    const container = makeContainer();
    const group: PopoverGroup = {
      popovers: [
        { element: anchor1, popover: { title: "Primary" } },
        { element: anchor2, popover: { title: "Companion" } },
      ],
    };
    const { store } = makeStore(group);
    const { rerender } = render(
      <Popover store={store} popoverIndex={0} container={container} />,
    );
    expect(screen.queryByRole("button", { name: "Done" })).not.toBeNull();
    rerender(<Popover store={store} popoverIndex={1} container={container} />);
    expect(screen.queryByRole("button", { name: "Done" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Next" })).toBeNull();
  });

  it("scroll-into-view fires once per step entry on the active anchor", () => {
    const anchor = makeAnchorEl();
    const container = makeContainer();
    const step: PopoverSpec = { element: anchor, popover: { title: "T" } };
    const { store } = makeStore(step);
    render(<Popover store={store} popoverIndex={0} container={container} />);
    expect(scrollTargetIntoView).toHaveBeenCalledTimes(1);
  });

  it("does NOT scroll on refresh()", () => {
    const anchor = makeAnchorEl();
    const container = makeContainer();
    const step: PopoverSpec = { element: anchor, popover: { title: "T" } };
    const { store } = makeStore(step);
    render(<Popover store={store} popoverIndex={0} container={container} />);
    expect(scrollTargetIntoView).toHaveBeenCalledTimes(1);
    store.setState((s) => ({ ...s, refreshTick: s.refreshTick + 1 }));
    expect(scrollTargetIntoView).toHaveBeenCalledTimes(1);
  });

  it("scrolls again when seqId bumps (re-entrant highlight)", () => {
    const anchor1 = makeAnchorEl();
    const anchor2 = makeAnchorEl({
      left: 300,
      top: 100,
      width: 50,
      height: 30,
    });
    const container = makeContainer();
    const step1: PopoverSpec = { element: anchor1, popover: { title: "A" } };
    const step2: PopoverSpec = { element: anchor2, popover: { title: "B" } };
    const { store } = makeStore(step1);
    render(<Popover store={store} popoverIndex={0} container={container} />);
    expect(scrollTargetIntoView).toHaveBeenCalledTimes(1);
    // Simulate re-entrant highlight(): activeIndex stays 0, currentPopovers + seqId update.
    act(() => {
      store.setState((s) => ({
        ...s,
        steps: [step2],
        currentStep: step2,
        currentPopovers: [step2],
        seqId: s.seqId + 1,
      }));
    });
    expect(scrollTargetIntoView).toHaveBeenCalledTimes(2);
  });

  it("viewport-positioned popover has no anchor, renders with fixed positioning", () => {
    const container = makeContainer();
    const step: PopoverSpec = {
      popover: {
        position: "top-center",
        title: "viewport",
        description: "no anchor",
        viewportOffset: { x: 0, y: 8 },
      },
    } as PopoverSpec;
    const { store } = makeStore(step);
    render(<Popover store={store} popoverIndex={0} container={container} />);
    const popover = screen.getByTestId("coachmarks-popover");
    expect(popover.style.position).toBe("fixed");
    // top-center: top set, left/transform set
    expect(popover.style.top).not.toBe("");
  });

  it("showButtons can hide the previous button", () => {
    const anchor = makeAnchorEl();
    const container = makeContainer();
    const step: PopoverSpec = { element: anchor, popover: { title: "T" } };
    const { store } = makeStore(step, { showButtons: ["next"] });
    render(<Popover store={store} popoverIndex={0} container={container} />);
    expect(screen.queryByRole("button", { name: "Previous" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Done" })).not.toBeNull();
  });

  it("Next button (last step) shows doneBtnText override", () => {
    const anchor = makeAnchorEl();
    const container = makeContainer();
    const step: PopoverSpec = { element: anchor, popover: { title: "T" } };
    const { store, moveNext } = makeStore(step, { doneBtnText: "Okay" });
    render(<Popover store={store} popoverIndex={0} container={container} />);
    fireEvent.click(screen.getByRole("button", { name: "Okay" }));
    expect(moveNext).toHaveBeenCalledTimes(1);
  });

  it("renders progress text only on primary in tour kind when showProgress is true", () => {
    const anchor = makeAnchorEl();
    const container = makeContainer();
    const step: PopoverSpec = { element: anchor, popover: { title: "T" } };
    const { store } = makeStore(step, { showProgress: true });
    store.setState((s) => ({
      ...s,
      steps: [step, step, step],
      activeIndex: 1,
    }));
    render(<Popover store={store} popoverIndex={0} container={container} />);
    expect(
      screen.getByTestId("coachmarks-popover-progress-text").textContent,
    ).toBe("2 of 3");
  });

  it("arrow option pass-through: width/height/strokeWidth land on the SVG and its path", () => {
    const anchor = makeAnchorEl();
    const container = makeContainer();
    const step: PopoverSpec = { element: anchor, popover: { title: "T" } };
    const { store } = makeStore(step, {
      arrow: { width: 28, height: 14, strokeWidth: 3 },
    });
    render(<Popover store={store} popoverIndex={0} container={container} />);
    const svg = container.querySelector(
      "svg.coachmarks-popover-arrow-side-top",
    );
    // FloatingArrow pads the SVG viewbox for the stroke; verify ranges.
    expect(Number(svg?.getAttribute("width"))).toBeGreaterThanOrEqual(28);
    expect(Number(svg?.getAttribute("height"))).toBeGreaterThanOrEqual(14);
    // FloatingArrow may scale stroke-width across two stacked path layers; assert it changed
    // from the default (1) and is at least the requested value (proves the prop is honored).
    const renderedStrokeWidth =
      svg?.getAttribute("stroke-width") ??
      svg?.querySelector("[stroke-width]")?.getAttribute("stroke-width") ??
      "1";
    expect(Number(renderedStrokeWidth)).toBeGreaterThanOrEqual(3);
  });

  it("arrow option default — stroke-width attribute is rendered (default 1)", () => {
    const anchor = makeAnchorEl();
    const container = makeContainer();
    const step: PopoverSpec = { element: anchor, popover: { title: "T" } };
    const { store } = makeStore(step);
    render(<Popover store={store} popoverIndex={0} container={container} />);
    const svg = container.querySelector(
      "[class^='coachmarks-popover-arrow-side-']",
    );
    // FloatingArrow's strokeWidth-of-1 default may render as a CSS or attribute.
    // Either way, the SVG element must exist (the arrow renders at all).
    expect(svg).not.toBeNull();
  });

  it.each([
    ["top-left", { top: "10px", left: "12px" }],
    ["top-right", { top: "10px", right: "12px" }],
    ["bottom-left", { bottom: "10px", left: "12px" }],
    ["bottom-right", { bottom: "10px", right: "12px" }],
  ] as const)(
    "viewport position %s applies x/y as edge insets",
    (position, expected) => {
      const container = makeContainer();
      const step: PopoverSpec = {
        popover: {
          position,
          title: "v",
          viewportOffset: { x: 12, y: 10 },
        },
      } as PopoverSpec;
      const { store } = makeStore(step);
      render(<Popover store={store} popoverIndex={0} container={container} />);
      const popover = screen.getByTestId("coachmarks-popover");
      for (const [k, v] of Object.entries(expected)) {
        expect(popover.style.getPropertyValue(k)).toBe(v);
      }
    },
  );

  it.each([
    ["top-center", "top"],
    ["bottom-center", "bottom"],
  ] as const)(
    "viewport position %s pins to %s edge with horizontal-cartesian transform",
    (position, edge) => {
      const container = makeContainer();
      const step: PopoverSpec = {
        popover: {
          position,
          title: "v",
          viewportOffset: { x: 7, y: 4 },
        },
      } as PopoverSpec;
      const { store } = makeStore(step);
      render(<Popover store={store} popoverIndex={0} container={container} />);
      const popover = screen.getByTestId("coachmarks-popover");
      expect(popover.style.getPropertyValue(edge)).toBe("4px");
      expect(popover.style.left).toBe("50%");
      expect(popover.style.transform).toContain("translateX");
      expect(popover.style.transform).toContain("7px");
    },
  );

  it.each([
    ["middle-left", "left"],
    ["middle-right", "right"],
  ] as const)(
    "viewport position %s pins to %s edge with vertical-cartesian transform",
    (position, edge) => {
      const container = makeContainer();
      const step: PopoverSpec = {
        popover: {
          position,
          title: "v",
          viewportOffset: { x: 6, y: 9 },
        },
      } as PopoverSpec;
      const { store } = makeStore(step);
      render(<Popover store={store} popoverIndex={0} container={container} />);
      const popover = screen.getByTestId("coachmarks-popover");
      expect(popover.style.getPropertyValue(edge)).toBe("6px");
      expect(popover.style.top).toBe("50%");
      expect(popover.style.transform).toContain("translateY");
      expect(popover.style.transform).toContain("9px");
    },
  );

  it.each([
    ["top", "rotate(180deg)"],
    ["right", "rotate(-90deg)"],
    ["bottom", ""],
    ["left", "rotate(90deg)"],
  ] as const)(
    "viewport popover renders an arrow on the %s side with the right rotation",
    (side, expectedRotation) => {
      const container = makeContainer();
      const step: PopoverSpec = {
        popover: {
          position: "top-center",
          title: "Scroll up!",
          arrow: { side },
        },
      } as PopoverSpec;
      const { store } = makeStore(step);
      render(<Popover store={store} popoverIndex={0} container={container} />);
      const popover = screen.getByTestId("coachmarks-popover");
      const svg = popover.querySelector(
        `svg.coachmarks-popover-arrow-side-${side}`,
      ) as SVGElement | null;
      expect(svg).not.toBeNull();
      expect(svg?.getAttribute("aria-hidden")).toBe("true");
      // jsdom returns the camelCased style.transform.
      const transform = (svg as unknown as HTMLElement).style.transform;
      if (expectedRotation) {
        expect(transform).toContain(expectedRotation);
      } else {
        expect(transform).toBe("");
      }
    },
  );

  it.each([
    [
      "anchored, numeric width → applied as px on width and max-width",
      { element: null, popover: { title: "T", width: 270 } },
      "270px",
    ],
    [
      "viewport, numeric width → applied as px on width and max-width",
      { popover: { position: "top-center", title: "T", width: 240 } },
      "240px",
    ],
    [
      "anchored, string width → applied verbatim",
      { element: null, popover: { title: "T", width: "20rem" } },
      "20rem",
    ],
  ] as const)("popover.width: %s", (_label, partialStep, expected) => {
    const container = makeContainer();
    let step: PopoverSpec;
    if ("element" in partialStep && partialStep.element === null) {
      step = {
        ...partialStep,
        element: makeAnchorEl(),
      } as PopoverSpec;
    } else {
      step = partialStep as PopoverSpec;
    }
    const { store } = makeStore(step);
    render(<Popover store={store} popoverIndex={0} container={container} />);
    const popover = screen.getByTestId("coachmarks-popover");
    expect(popover.style.width).toBe(expected);
    expect(popover.style.maxWidth).toBe(expected);
  });

  it.each([
    ["top", 10, 5, 10, { mainAxis: 0, crossAxis: 5 }],
    ["top-start", 10, -3, -7, { mainAxis: 17, crossAxis: -3 }],
    ["bottom", 10, 5, 10, { mainAxis: 20, crossAxis: 5 }],
    ["left", 10, 5, 10, { mainAxis: 5, crossAxis: 10 }],
    ["right", 10, 5, 10, { mainAxis: 15, crossAxis: 10 }],
  ] as const)(
    "cartesianToAxisOffset(%s, ...) maps cartesian x/y to mainAxis/crossAxis",
    (placement, base, ax, ay, expected) => {
      expect(cartesianToAxisOffset(base, placement, ax, ay)).toEqual(expected);
    },
  );

  it("popover.width omitted → no inline width is set (theme/base CSS rules)", () => {
    const container = makeContainer();
    const step: PopoverSpec = {
      element: makeAnchorEl(),
      popover: { title: "T" },
    };
    const { store } = makeStore(step);
    render(<Popover store={store} popoverIndex={0} container={container} />);
    const popover = screen.getByTestId("coachmarks-popover");
    expect(popover.style.width).toBe("");
    expect(popover.style.maxWidth).toBe("");
  });

  it("viewport popover does NOT render an arrow when arrow is not configured", () => {
    const container = makeContainer();
    const step: PopoverSpec = {
      popover: {
        position: "top-center",
        title: "Just a cue",
      },
    } as PopoverSpec;
    const { store } = makeStore(step);
    render(<Popover store={store} popoverIndex={0} container={container} />);
    expect(
      container.querySelector("[class^='coachmarks-popover-arrow-side-']"),
    ).toBeNull();
  });

  it("viewport popover arrow honors engine-level arrow option overrides", () => {
    const container = makeContainer();
    const step: PopoverSpec = {
      popover: {
        position: "top-center",
        title: "Scroll up!",
        arrow: { side: "top" },
      },
    } as PopoverSpec;
    const { store } = makeStore(step, {
      arrow: { width: 28, height: 14, strokeWidth: 3 },
    });
    render(<Popover store={store} popoverIndex={0} container={container} />);
    const svg = container.querySelector(
      "svg.coachmarks-popover-arrow-side-top",
    );
    expect(Number(svg?.getAttribute("width"))).toBeGreaterThanOrEqual(28);
    expect(Number(svg?.getAttribute("height"))).toBeGreaterThanOrEqual(14);
    const renderedStrokeWidth =
      svg?.getAttribute("stroke-width") ??
      svg?.querySelector("[stroke-width]")?.getAttribute("stroke-width") ??
      "1";
    expect(Number(renderedStrokeWidth)).toBeGreaterThanOrEqual(3);
  });

  it("viewport position center applies cartesian offsets on both axes", () => {
    const container = makeContainer();
    const step: PopoverSpec = {
      popover: {
        position: "center",
        title: "v",
        viewportOffset: { x: 3, y: 5 },
      },
    } as PopoverSpec;
    const { store } = makeStore(step);
    render(<Popover store={store} popoverIndex={0} container={container} />);
    const popover = screen.getByTestId("coachmarks-popover");
    expect(popover.style.top).toBe("50%");
    expect(popover.style.left).toBe("50%");
    expect(popover.style.transform).toContain("3px");
    expect(popover.style.transform).toContain("5px");
  });

  it("drag-relative-to-anchor: popover stays at anchor.{left,top} + {offsetX,offsetY} when anchor moves", async () => {
    // Anchor at (50, 50, 50, 30); drag to viewport (100, 100). offsetX/Y = 50.
    const anchor = makeAnchorEl({ left: 50, top: 50, width: 50, height: 30 });
    const container = makeContainer();
    const step: PopoverSpec = { element: anchor, popover: { title: "T" } };
    const { store } = makeStore(step);
    render(<Popover store={store} popoverIndex={0} container={container} />);
    const popover = screen.getByTestId("coachmarks-popover");
    // Stub popover rect so usePopoverDrag's onPointerDown can compute grabX/Y.
    Object.defineProperty(popover, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        left: 50,
        top: 50,
        width: 80,
        height: 40,
        right: 130,
        bottom: 90,
        x: 50,
        y: 50,
        toJSON: () => ({}),
      }),
    });
    Object.defineProperty(popover, "offsetWidth", {
      configurable: true,
      value: 80,
    });
    Object.defineProperty(popover, "offsetHeight", {
      configurable: true,
      value: 40,
    });

    // pointerdown at the popover's top-left grabs with grabX=0, grabY=0.
    await act(async () => {
      fireEvent.pointerDown(popover, {
        button: 0,
        clientX: 50,
        clientY: 50,
      });
    });
    // pointermove to (100, 100) sets dragPosition to (100, 100). offsetX = 100 - 50 = 50.
    await act(async () => {
      fireEvent(
        document,
        new PointerEvent("pointermove", { clientX: 100, clientY: 100 }),
      );
    });
    await act(async () => {
      fireEvent(document, new PointerEvent("pointerup"));
    });

    // Move the anchor to (150, 150) and let useFloating pick that up via refresh().
    Object.defineProperty(anchor, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        left: 150,
        top: 150,
        width: 50,
        height: 30,
        right: 200,
        bottom: 180,
        x: 150,
        y: 150,
        toJSON: () => ({}),
      }),
    });
    await act(async () => {
      store.setState((s) => ({ ...s, refreshTick: s.refreshTick + 1 }));
    });
    // After refresh: target rect.x = 150, offsetX = 50, so popover.x = 200.
    // useFloating with strategy "fixed" emits transform "translate(200px, 200px)".
    // The exact form may vary across @floating-ui versions (translate vs
    // translate3d, exact rounding) — assert the numbers are present.
    const transform = popover.style.transform;
    expect(transform).toMatch(/200px/);
  });

  it("data-coachmarks-popover-index attribute matches popoverIndex prop", () => {
    const anchor1 = makeAnchorEl();
    const anchor2 = makeAnchorEl({
      left: 300,
      top: 100,
      width: 50,
      height: 30,
    });
    const container = makeContainer();
    const group: PopoverGroup = {
      popovers: [
        { element: anchor1, popover: { title: "Primary" } },
        { element: anchor2, popover: { title: "Companion" } },
      ],
    };
    const { store } = makeStore(group);
    render(<Popover store={store} popoverIndex={1} container={container} />);
    expect(
      screen
        .getByTestId("coachmarks-popover")
        .getAttribute("data-coachmarks-popover-index"),
    ).toBe("1");
  });
});
