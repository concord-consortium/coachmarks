import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useTargetUnclickable } from "./use-target-unclickable";

afterEach(() => {
  document.body.innerHTML = "";
});

// MutationObserver delivers its records on a microtask; act() wraps the resulting setState.
const flushMutations = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

describe("useTargetUnclickable", () => {
  it("reads true at mount when the target is already disabled", () => {
    const target = document.createElement("button");
    target.disabled = true;
    document.body.appendChild(target);
    const { result } = renderHook(() => useTargetUnclickable(target));
    expect(result.current).toBe(true);
  });

  it("reads false at mount for a live target", () => {
    const target = document.createElement("button");
    document.body.appendChild(target);
    const { result } = renderHook(() => useTargetUnclickable(target));
    expect(result.current).toBe(false);
  });

  it("flips to true when the target is disabled after mount", async () => {
    const target = document.createElement("button");
    document.body.appendChild(target);
    const { result } = renderHook(() => useTargetUnclickable(target));
    expect(result.current).toBe(false);

    target.disabled = true;
    await flushMutations();
    expect(result.current).toBe(true);
  });

  it("flips back to false when the target is re-enabled", async () => {
    const target = document.createElement("button");
    target.disabled = true;
    document.body.appendChild(target);
    const { result } = renderHook(() => useTargetUnclickable(target));
    expect(result.current).toBe(true);

    target.disabled = false;
    await flushMutations();
    expect(result.current).toBe(false);
  });

  it("honors aria-disabled on a non-button anchor", async () => {
    const target = document.createElement("div");
    target.setAttribute("aria-disabled", "true");
    document.body.appendChild(target);
    const { result } = renderHook(() => useTargetUnclickable(target));
    expect(result.current).toBe(true);

    target.setAttribute("aria-disabled", "false");
    await flushMutations();
    expect(result.current).toBe(false);
  });

  it("returns false for a null target", () => {
    const { result } = renderHook(() => useTargetUnclickable(null));
    expect(result.current).toBe(false);
  });

  it("disconnects its observer on unmount", () => {
    const target = document.createElement("button");
    document.body.appendChild(target);
    const disconnect = vi.spyOn(MutationObserver.prototype, "disconnect");
    const { unmount } = renderHook(() => useTargetUnclickable(target));
    expect(disconnect).not.toHaveBeenCalled();
    unmount();
    expect(disconnect).toHaveBeenCalled();
  });
});
