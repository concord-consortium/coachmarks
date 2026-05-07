import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useReducedMotion } from "./use-reduced-motion";

describe("useReducedMotion", () => {
  let addedListeners: Array<{
    event: string;
    fn: (e: MediaQueryListEvent) => void;
  }>;
  let removedListeners: Array<{
    event: string;
    fn: (e: MediaQueryListEvent) => void;
  }>;
  let originalMatchMedia: typeof window.matchMedia;
  let initialMatches: boolean;

  beforeEach(() => {
    originalMatchMedia = window.matchMedia;
    addedListeners = [];
    removedListeners = [];
    initialMatches = false;
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: initialMatches,
        media: query,
        onchange: null,
        addEventListener: (
          event: string,
          fn: (e: MediaQueryListEvent) => void,
        ) => addedListeners.push({ event, fn }),
        removeEventListener: (
          event: string,
          fn: (e: MediaQueryListEvent) => void,
        ) => removedListeners.push({ event, fn }),
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => true,
      }),
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: originalMatchMedia,
    });
  });

  it("reads initial matchMedia value at mount", () => {
    initialMatches = true;
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(true);
  });

  it("returns false when matchMedia does not match", () => {
    initialMatches = false;
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
  });

  it("subscribes via addEventListener('change', ...) and updates on change", () => {
    const { result } = renderHook(() => useReducedMotion());
    expect(addedListeners).toHaveLength(1);
    expect(addedListeners[0].event).toBe("change");

    act(() => {
      addedListeners[0].fn({ matches: true } as MediaQueryListEvent);
    });
    expect(result.current).toBe(true);
  });

  it("removes the listener on unmount", () => {
    const { unmount } = renderHook(() => useReducedMotion());
    expect(removedListeners).toHaveLength(0);
    unmount();
    expect(removedListeners).toHaveLength(1);
    expect(removedListeners[0].event).toBe("change");
  });
});
