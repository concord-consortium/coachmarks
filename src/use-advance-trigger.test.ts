import { fireEvent, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAdvanceTrigger } from "./use-advance-trigger";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("useAdvanceTrigger", () => {
  it("calls onAdvance when the trigger event fires on the anchor", () => {
    const anchor = document.createElement("button");
    document.body.appendChild(anchor);
    const onAdvance = vi.fn();
    renderHook(() => useAdvanceTrigger(anchor, { event: "click" }, onAdvance));
    fireEvent.click(anchor);
    expect(onAdvance).toHaveBeenCalledTimes(1);
  });

  it("removes the listener on unmount (no advance after step exit/destroy)", () => {
    const anchor = document.createElement("button");
    document.body.appendChild(anchor);
    const onAdvance = vi.fn();
    const { unmount } = renderHook(() =>
      useAdvanceTrigger(anchor, { event: "click" }, onAdvance),
    );
    unmount();
    fireEvent.click(anchor);
    expect(onAdvance).not.toHaveBeenCalled();
  });

  it("short-circuits when anchor or trigger is null/undefined", () => {
    const anchor = document.createElement("button");
    document.body.appendChild(anchor);
    const onAdvance = vi.fn();
    renderHook(() => useAdvanceTrigger(anchor, undefined, onAdvance));
    fireEvent.click(anchor);
    expect(onAdvance).not.toHaveBeenCalled();

    const onAdvance2 = vi.fn();
    renderHook(() => useAdvanceTrigger(null, { event: "click" }, onAdvance2));
    expect(onAdvance2).not.toHaveBeenCalled();
  });
});
