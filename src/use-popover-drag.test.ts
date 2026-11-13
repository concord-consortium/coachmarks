import { act, renderHook } from "@testing-library/react";
import type React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePopoverDrag } from "./use-popover-drag";

function makePopoverEl(
  rect = { left: 100, top: 100, width: 200, height: 100 },
): HTMLElement {
  const el = document.createElement("div");
  document.body.appendChild(el);
  vi.spyOn(el, "getBoundingClientRect").mockReturnValue({
    ...rect,
    right: rect.left + rect.width,
    bottom: rect.top + rect.height,
    x: rect.left,
    y: rect.top,
    toJSON: () => ({}),
  } as DOMRect);
  return el;
}

function pointerDownEvent(clientX = 150, clientY = 130): React.PointerEvent {
  return {
    button: 0,
    pointerId: 7,
    clientX,
    clientY,
    target: document.body,
    preventDefault: vi.fn(),
  } as unknown as React.PointerEvent;
}

function pointer(
  type: string,
  init: MouseEventInit = {},
  pointerId = 7,
): PointerEvent {
  return Object.assign(new MouseEvent(type, init), {
    pointerId,
  }) as unknown as PointerEvent;
}

function heldCapture(popoverEl: HTMLElement) {
  let held = false;
  popoverEl.setPointerCapture = vi.fn(() => {
    held = true;
  });
  popoverEl.hasPointerCapture = vi.fn(() => held);
  const release = vi.fn(() => {
    held = false;
  });
  popoverEl.releasePointerCapture = release;
  return release;
}

describe("usePopoverDrag", () => {
  beforeEach(() => {
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      value: 1024,
    });
    Object.defineProperty(window, "innerHeight", {
      writable: true,
      value: 768,
    });
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("starts inactive with no position", () => {
    const popoverEl = makePopoverEl();
    const { result } = renderHook(() => usePopoverDrag("step-key", popoverEl));
    expect(result.current.isDragging).toBe(false);
    expect(result.current.position).toBeNull();
  });

  it("sets isDragging on pointerdown and updates position on pointermove", () => {
    const popoverEl = makePopoverEl();
    const { result } = renderHook(() => usePopoverDrag("step-key", popoverEl));

    act(() => {
      result.current.onPointerDown(pointerDownEvent(150, 130));
    });
    expect(result.current.isDragging).toBe(true);

    const move = pointer("pointermove", { clientX: 200, clientY: 180 });
    act(() => {
      document.dispatchEvent(move);
    });
    expect(result.current.position).toEqual({ x: 150, y: 150 });
  });

  it("clears isDragging on pointerup and removes document listeners", () => {
    const popoverEl = makePopoverEl();
    const { result } = renderHook(() => usePopoverDrag("step-key", popoverEl));

    act(() => {
      result.current.onPointerDown(pointerDownEvent());
    });
    act(() => {
      document.dispatchEvent(pointer("pointerup"));
    });
    expect(result.current.isDragging).toBe(false);

    const before = result.current.position;
    act(() => {
      document.dispatchEvent(
        pointer("pointermove", { clientX: 999, clientY: 999 }),
      );
    });
    expect(result.current.position).toBe(before);
  });

  it("removes in-flight document listeners when the hook unmounts mid-drag", () => {
    const popoverEl = makePopoverEl();
    const removeSpy = vi.spyOn(document, "removeEventListener");
    const { result, unmount } = renderHook(() =>
      usePopoverDrag("step-key", popoverEl),
    );

    act(() => {
      result.current.onPointerDown(pointerDownEvent());
    });
    removeSpy.mockClear();

    unmount();

    const removedEvents = removeSpy.mock.calls.map((c) => c[0]);
    expect(removedEvents).toContain("pointermove");
    expect(removedEvents).toContain("pointerup");
    expect(removedEvents).toContain("pointercancel");

    removeSpy.mockRestore();
  });

  it("ignores pointerdown on interactive children (button/input/select/textarea/a)", () => {
    const popoverEl = makePopoverEl();
    const capture = vi.fn();
    popoverEl.setPointerCapture = capture;
    const button = document.createElement("button");
    popoverEl.appendChild(button);
    const { result } = renderHook(() => usePopoverDrag("step-key", popoverEl));

    const evt = {
      button: 0,
      pointerId: 7,
      clientX: 150,
      clientY: 130,
      target: button,
      preventDefault: vi.fn(),
    } as unknown as React.PointerEvent;
    act(() => {
      result.current.onPointerDown(evt);
    });

    expect(result.current.isDragging).toBe(false);
    expect(evt.preventDefault).not.toHaveBeenCalled();
    expect(capture).not.toHaveBeenCalled();
  });

  it("captures the pointer on the popover once, at the first move of a drag", () => {
    const popoverEl = makePopoverEl();
    const capture = vi.fn();
    popoverEl.setPointerCapture = capture;
    const { result } = renderHook(() => usePopoverDrag("step-key", popoverEl));

    act(() => {
      result.current.onPointerDown(pointerDownEvent());
    });
    expect(capture).not.toHaveBeenCalled();

    const move = (clientX: number) =>
      pointer("pointermove", { clientX, clientY: 130 });
    act(() => {
      document.dispatchEvent(move(160));
      document.dispatchEvent(move(170));
    });
    expect(capture).toHaveBeenCalledTimes(1);
    expect(capture).toHaveBeenCalledWith(7);
  });

  it("captures the pointer when it leaves the popover before any move reaches the page", () => {
    const popoverEl = makePopoverEl();
    const capture = vi.fn();
    popoverEl.setPointerCapture = capture;
    const { result } = renderHook(() => usePopoverDrag("step-key", popoverEl));

    act(() => {
      result.current.onPointerDown(pointerDownEvent());
    });
    popoverEl.dispatchEvent(pointer("pointerleave"));

    expect(capture).toHaveBeenCalledWith(7);
  });

  it("releases the pointer capture when a step change ends the drag", () => {
    const popoverEl = makePopoverEl();
    const release = heldCapture(popoverEl);
    const { result, rerender } = renderHook(
      ({ key }) => usePopoverDrag(key, popoverEl),
      { initialProps: { key: "step-1" } },
    );

    act(() => {
      result.current.onPointerDown(pointerDownEvent());
    });
    act(() => {
      document.dispatchEvent(
        pointer("pointermove", { clientX: 160, clientY: 130 }),
      );
    });
    rerender({ key: "step-2" });

    expect(release).toHaveBeenCalledWith(7);
  });

  for (const end of ["pointerup", "pointercancel"]) {
    it(`releases the pointer capture on ${end}`, () => {
      const popoverEl = makePopoverEl();
      const release = heldCapture(popoverEl);
      const { result } = renderHook(() =>
        usePopoverDrag("step-key", popoverEl),
      );

      act(() => {
        result.current.onPointerDown(pointerDownEvent());
      });
      act(() => {
        document.dispatchEvent(
          pointer("pointermove", { clientX: 160, clientY: 130 }),
        );
      });
      act(() => {
        document.dispatchEvent(pointer(end));
      });

      expect(release).toHaveBeenCalledWith(7);
      expect(result.current.isDragging).toBe(false);
    });
  }

  it("captures once when the pointer leaves the popover and then moves", () => {
    const popoverEl = makePopoverEl();
    const capture = vi.fn();
    popoverEl.setPointerCapture = capture;
    const { result } = renderHook(() => usePopoverDrag("step-key", popoverEl));

    act(() => {
      result.current.onPointerDown(pointerDownEvent());
    });
    popoverEl.dispatchEvent(pointer("pointerleave"));
    act(() => {
      document.dispatchEvent(
        pointer("pointermove", { clientX: 160, clientY: 130 }),
      );
    });

    expect(capture).toHaveBeenCalledTimes(1);
  });

  it("stops listening for pointerleave once the drag ends", () => {
    const popoverEl = makePopoverEl();
    const capture = vi.fn();
    popoverEl.setPointerCapture = capture;
    const { result } = renderHook(() => usePopoverDrag("step-key", popoverEl));

    act(() => {
      result.current.onPointerDown(pointerDownEvent());
    });
    act(() => {
      document.dispatchEvent(pointer("pointerup"));
    });
    popoverEl.dispatchEvent(pointer("pointerleave"));

    expect(capture).not.toHaveBeenCalled();
  });

  it("ignores a second pointer during a drag", () => {
    const popoverEl = makePopoverEl();
    const capture = vi.fn();
    popoverEl.setPointerCapture = capture;
    const { result } = renderHook(() => usePopoverDrag("step-key", popoverEl));

    act(() => {
      result.current.onPointerDown(pointerDownEvent(150, 130));
    });
    popoverEl.dispatchEvent(pointer("pointerleave", {}, 8));
    act(() => {
      document.dispatchEvent(
        pointer("pointermove", { clientX: 400, clientY: 400 }, 8),
      );
      document.dispatchEvent(pointer("pointerup", {}, 8));
    });
    expect(capture).not.toHaveBeenCalled();
    expect(result.current.position).toBeNull();
    expect(result.current.isDragging).toBe(true);

    act(() => {
      document.dispatchEvent(
        pointer("pointermove", { clientX: 200, clientY: 180 }),
      );
    });
    expect(capture).toHaveBeenCalledWith(7);
    expect(result.current.position).toEqual({ x: 150, y: 150 });
  });

  it("keeps dragging when the pointer cannot be captured", () => {
    const popoverEl = makePopoverEl();
    popoverEl.setPointerCapture = vi.fn(() => {
      throw new DOMException("No active pointer", "NotFoundError");
    });
    const { result } = renderHook(() => usePopoverDrag("step-key", popoverEl));

    act(() => {
      result.current.onPointerDown(pointerDownEvent(150, 130));
    });
    act(() => {
      document.dispatchEvent(
        pointer("pointermove", { clientX: 200, clientY: 180 }),
      );
    });

    expect(result.current.position).toEqual({ x: 150, y: 150 });
  });

  it("clamps drag position to viewport with 8px padding", () => {
    const popoverEl = makePopoverEl({
      left: 0,
      top: 0,
      width: 200,
      height: 100,
    });
    const { result } = renderHook(() => usePopoverDrag("step-key", popoverEl));

    act(() => {
      result.current.onPointerDown(pointerDownEvent(0, 0));
    });
    act(() => {
      document.dispatchEvent(
        pointer("pointermove", { clientX: 99999, clientY: 99999 }),
      );
    });
    expect(result.current.position).toEqual({ x: 816, y: 660 });

    act(() => {
      document.dispatchEvent(
        pointer("pointermove", { clientX: -99999, clientY: -99999 }),
      );
    });
    expect(result.current.position).toEqual({ x: 8, y: 8 });
  });

  it("detaches leaked listeners from a prior gesture when pointerdown fires twice without pointerup", () => {
    const popoverEl = makePopoverEl();
    const { result } = renderHook(() => usePopoverDrag("step-key", popoverEl));

    act(() => {
      result.current.onPointerDown(pointerDownEvent(150, 130));
    });
    act(() => {
      result.current.onPointerDown(pointerDownEvent(300, 200));
    });

    act(() => {
      document.dispatchEvent(
        pointer("pointermove", { clientX: 310, clientY: 210 }),
      );
    });
    expect(result.current.position).toEqual({ x: 110, y: 110 });
  });

  it("detaches in-flight drag listeners when resetKey changes mid-drag", () => {
    const popoverEl = makePopoverEl();
    const removeSpy = vi.spyOn(document, "removeEventListener");
    const { result, rerender } = renderHook(
      ({ key }: { key: string }) => usePopoverDrag(key, popoverEl),
      { initialProps: { key: "step-1" } },
    );

    act(() => {
      result.current.onPointerDown(pointerDownEvent());
    });
    removeSpy.mockClear();

    rerender({ key: "step-2" });

    const removedEvents = removeSpy.mock.calls.map((c) => c[0]);
    expect(removedEvents).toContain("pointermove");
    expect(removedEvents).toContain("pointerup");
    expect(removedEvents).toContain("pointercancel");

    // Subsequent pointermove must not mutate position — the listener is gone.
    act(() => {
      document.dispatchEvent(
        pointer("pointermove", { clientX: 999, clientY: 999 }),
      );
    });
    expect(result.current.position).toBeNull();

    removeSpy.mockRestore();
  });

  it("resets position when resetKey changes (e.g. step transition)", () => {
    const popoverEl = makePopoverEl();
    const { result, rerender } = renderHook(
      ({ key }: { key: string }) => usePopoverDrag(key, popoverEl),
      { initialProps: { key: "step-1" } },
    );

    act(() => {
      result.current.onPointerDown(pointerDownEvent());
    });
    act(() => {
      document.dispatchEvent(
        pointer("pointermove", { clientX: 200, clientY: 180 }),
      );
    });
    act(() => {
      document.dispatchEvent(pointer("pointerup"));
    });
    expect(result.current.position).not.toBeNull();

    rerender({ key: "step-2" });
    expect(result.current.position).toBeNull();
  });
});
