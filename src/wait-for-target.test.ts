import { afterEach, describe, expect, it, vi } from "vitest";
import { makeVisible } from "./test-utils/jsdom-anchor";
import { waitForTarget } from "./wait-for-target";

afterEach(() => {
  document.body.innerHTML = "";
});

/** Append a button matching `#target` that passes `isLaidOut`. */
function appendTarget(): HTMLButtonElement {
  const el = document.createElement("button");
  el.id = "target";
  document.body.appendChild(el);
  makeVisible(el);
  return el;
}

describe("waitForTarget", () => {
  it("resolves immediately when a laid-out match already exists", () => {
    const el = appendTarget();
    const onResolved = vi.fn();
    waitForTarget("#target", onResolved);
    expect(onResolved).toHaveBeenCalledTimes(1);
    expect(onResolved.mock.calls[0][0]).toBe(el);
  });

  it("resolves once when the target is appended after a delay", async () => {
    const onResolved = vi.fn();
    waitForTarget("#target", onResolved);
    expect(onResolved).not.toHaveBeenCalled();

    const el = appendTarget();
    await Promise.resolve();
    expect(onResolved).toHaveBeenCalledTimes(1);
    expect(onResolved.mock.calls[0][0]).toBe(el);

    // Further mutations do not re-fire (observer disconnected on resolve).
    document.body.appendChild(document.createElement("span"));
    await Promise.resolve();
    expect(onResolved).toHaveBeenCalledTimes(1);
  });

  it("does not resolve for a present-but-not-laid-out match until it lays out", async () => {
    // Present in the DOM but failing isLaidOut (display:none / no offsetParent).
    const el = document.createElement("button");
    el.id = "target";
    el.style.display = "none";
    Object.defineProperty(el, "offsetParent", {
      configurable: true,
      value: null,
    });
    document.body.appendChild(el);
    const onResolved = vi.fn();
    waitForTarget("#target", onResolved);
    expect(onResolved).not.toHaveBeenCalled();

    // Lay it out and poke the DOM so the observer re-checks.
    makeVisible(el);
    document.body.appendChild(document.createElement("span"));
    await Promise.resolve();
    expect(onResolved).toHaveBeenCalledTimes(1);
  });

  it("disposer disconnects the observer (no resolve after dispose)", async () => {
    const disconnectSpy = vi.spyOn(MutationObserver.prototype, "disconnect");
    const onResolved = vi.fn();
    const dispose = waitForTarget("#target", onResolved);
    dispose();
    expect(disconnectSpy).toHaveBeenCalled();

    appendTarget();
    await Promise.resolve();
    expect(onResolved).not.toHaveBeenCalled();
    disconnectSpy.mockRestore();
  });
});
