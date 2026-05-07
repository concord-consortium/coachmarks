import { afterEach, describe, expect, it, vi } from "vitest";
import { isLaidOut } from "./is-laid-out";

afterEach(() => {
  document.body.innerHTML = "";
});

function withRect(el: HTMLElement, rect: Partial<DOMRect>): HTMLElement {
  vi.spyOn(el, "getBoundingClientRect").mockReturnValue({
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: 0,
    height: 0,
    x: 0,
    y: 0,
    toJSON: () => ({}),
    ...rect,
  } as DOMRect);
  return el;
}

describe("isLaidOut", () => {
  it("returns false for a disconnected element", () => {
    const el = document.createElement("div");
    expect(isLaidOut(el)).toBe(false);
  });

  it("returns false for an element with display: none (offsetParent === null)", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    el.style.display = "none";
    Object.defineProperty(el, "offsetParent", {
      configurable: true,
      value: null,
    });
    expect(isLaidOut(el)).toBe(false);
  });

  it("returns false for a connected element with zero-size rect", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    Object.defineProperty(el, "offsetParent", {
      configurable: true,
      value: document.body,
    });
    withRect(el, { width: 0, height: 0 });
    expect(isLaidOut(el)).toBe(false);
  });

  it("returns false when only width is zero", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    Object.defineProperty(el, "offsetParent", {
      configurable: true,
      value: document.body,
    });
    withRect(el, { width: 0, height: 30 });
    expect(isLaidOut(el)).toBe(false);
  });

  it("returns false when only height is zero", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    Object.defineProperty(el, "offsetParent", {
      configurable: true,
      value: document.body,
    });
    withRect(el, { width: 50, height: 0 });
    expect(isLaidOut(el)).toBe(false);
  });

  it("returns true for a connected, visible element with non-zero rect", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    Object.defineProperty(el, "offsetParent", {
      configurable: true,
      value: document.body,
    });
    withRect(el, { width: 100, height: 50 });
    expect(isLaidOut(el)).toBe(true);
  });

  it("returns true for a position:fixed element with non-zero rect even when offsetParent is null", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    el.style.position = "fixed";
    Object.defineProperty(el, "offsetParent", {
      configurable: true,
      value: null,
    });
    withRect(el, { width: 50, height: 25 });
    expect(isLaidOut(el)).toBe(true);
  });
});
