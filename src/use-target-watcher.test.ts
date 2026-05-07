import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { makeVisible } from "./test-utils/jsdom-anchor";
import { useTargetWatcher } from "./use-target-watcher";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("useTargetWatcher", () => {
  it("fires onRemoved on a microtask at mount when target is already disconnected", async () => {
    const target = document.createElement("div");
    const onRemoved = vi.fn();
    renderHook(() => useTargetWatcher(target, onRemoved));
    // Deferred so the host store update doesn't re-enter mid-commit.
    expect(onRemoved).not.toHaveBeenCalled();
    await Promise.resolve();
    expect(onRemoved).toHaveBeenCalledTimes(1);
  });

  it("fires onRemoved exactly once when the target is removed after mount", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    makeVisible(target);
    const onRemoved = vi.fn();
    renderHook(() => useTargetWatcher(target, onRemoved));
    expect(onRemoved).not.toHaveBeenCalled();

    target.remove();
    await Promise.resolve();
    expect(onRemoved).toHaveBeenCalledTimes(1);

    document.body.appendChild(document.createElement("span"));
    await Promise.resolve();
    expect(onRemoved).toHaveBeenCalledTimes(1);
  });

  it("detects ancestor detach (target's parent removed)", async () => {
    const parent = document.createElement("div");
    const target = document.createElement("div");
    parent.appendChild(target);
    document.body.appendChild(parent);
    makeVisible(target);
    const onRemoved = vi.fn();
    renderHook(() => useTargetWatcher(target, onRemoved));

    parent.remove();
    await Promise.resolve();
    expect(onRemoved).toHaveBeenCalledTimes(1);
  });

  it("disconnects the observer on unmount", () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    makeVisible(target);
    const disconnectSpy = vi.spyOn(MutationObserver.prototype, "disconnect");
    const onRemoved = vi.fn();
    const { unmount } = renderHook(() => useTargetWatcher(target, onRemoved));
    disconnectSpy.mockClear();
    unmount();
    expect(disconnectSpy).toHaveBeenCalled();
    disconnectSpy.mockRestore();
  });

  it("fires onRemoved on a microtask at mount when target is hidden via display: none", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    target.style.display = "none";
    Object.defineProperty(target, "offsetParent", {
      configurable: true,
      value: null,
    });
    const onRemoved = vi.fn();
    renderHook(() => useTargetWatcher(target, onRemoved));
    expect(onRemoved).not.toHaveBeenCalled();
    await Promise.resolve();
    expect(onRemoved).toHaveBeenCalledTimes(1);
  });

  it("fires onRemoved when an attribute change hides the target mid-life", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    makeVisible(target);
    const onRemoved = vi.fn();
    renderHook(() => useTargetWatcher(target, onRemoved));
    expect(onRemoved).not.toHaveBeenCalled();

    // Simulate an attribute mutation that triggers a re-check.
    Object.defineProperty(target, "offsetParent", {
      configurable: true,
      value: null,
    });
    target.style.display = "none";
    target.setAttribute("data-touch", "1");
    await Promise.resolve();
    expect(onRemoved).toHaveBeenCalledTimes(1);
  });
});
