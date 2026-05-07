import { describe, expect, it, vi } from "vitest";
import { createStore } from "./store";

describe("createStore", () => {
  it("returns the initial state via getSnapshot", () => {
    const store = createStore({ count: 0 });
    expect(store.getSnapshot()).toEqual({ count: 0 });
  });

  it("notifies subscribers on setState", () => {
    const store = createStore(0);
    const listener = vi.fn();
    store.subscribe(listener);
    store.setState((prev) => prev + 1);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot()).toBe(1);
  });

  it("supports multiple subscribers", () => {
    const store = createStore(0);
    const a = vi.fn();
    const b = vi.fn();
    store.subscribe(a);
    store.subscribe(b);
    store.setState(() => 1);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it("unsubscribe removes the listener", () => {
    const store = createStore(0);
    const listener = vi.fn();
    const unsub = store.subscribe(listener);
    unsub();
    store.setState(() => 1);
    expect(listener).not.toHaveBeenCalled();
  });

  it("Strict-Mode mount->unmount->remount leaves no leaked listeners", () => {
    const store = createStore(0);
    const listener = vi.fn();
    const unsub1 = store.subscribe(listener);
    unsub1();
    const unsub2 = store.subscribe(listener);
    store.setState(() => 1);
    expect(listener).toHaveBeenCalledTimes(1);
    unsub2();
    store.setState(() => 2);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("subscribe-during-notify does not skip already-pending listeners", () => {
    const store = createStore(0);
    const a = vi.fn();
    const b = vi.fn();
    const c = vi.fn();
    store.subscribe(a);
    store.subscribe(() => {
      b();
      // Subscribe a third listener mid-notify; it should not fire for THIS setState.
      store.subscribe(c);
    });
    store.setState(() => 1);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    expect(c).toHaveBeenCalledTimes(0);
    store.setState(() => 2);
    expect(c).toHaveBeenCalledTimes(1);
  });

  it("unsubscribe-during-notify does not skip subsequent listeners", () => {
    const store = createStore(0);
    const a = vi.fn();
    const b = vi.fn();
    let unsubB: (() => void) | null = null;
    store.subscribe(() => {
      a();
      unsubB?.();
    });
    unsubB = store.subscribe(b);
    store.setState(() => 1);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    store.setState(() => 2);
    expect(a).toHaveBeenCalledTimes(2);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it("primitive selector returns stable reference across getSnapshot calls when state unchanged", () => {
    const store = createStore({ a: 1, b: 2 });
    const first = store.getSnapshot();
    const second = store.getSnapshot();
    expect(first).toBe(second);
  });
});
