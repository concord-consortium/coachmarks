import { act } from "@testing-library/react";
import { vi } from "vitest";

type Rect = { left: number; top: number; width: number; height: number };

const DEFAULT_RECT: Rect = { left: 100, top: 100, width: 50, height: 30 };

function stubRect(el: HTMLElement, rect: Rect): void {
  vi.spyOn(el, "getBoundingClientRect").mockReturnValue({
    ...rect,
    right: rect.left + rect.width,
    bottom: rect.top + rect.height,
    x: rect.left,
    y: rect.top,
    toJSON: () => ({}),
  } as DOMRect);
}

/** Append a `<button>` with offsetParent + getBoundingClientRect stubbed so it
 *  passes `isLaidOut`. Used by engine and popover tests as a real anchor. */
export function makeAnchorButton(rect: Rect = DEFAULT_RECT): HTMLButtonElement {
  const el = document.createElement("button");
  el.textContent = "anchor";
  document.body.appendChild(el);
  Object.defineProperty(el, "offsetParent", {
    configurable: true,
    value: document.body,
  });
  stubRect(el, rect);
  return el;
}

/** Append a `<div>` with getBoundingClientRect stubbed. Used where the
 *  consumer (e.g. OutlineRings) only reads the rect and doesn't run
 *  `isLaidOut`, so offsetParent isn't needed. */
export function makeLaidOutDiv(rect: Rect = DEFAULT_RECT): HTMLDivElement {
  const el = document.createElement("div");
  document.body.appendChild(el);
  stubRect(el, rect);
  return el;
}

/** Append a hidden `<button>` (display:none, offsetParent null). Fails
 *  `isLaidOut` so the engine treats it as a hidden-anchor cancel. */
export function makeHiddenButton(): HTMLButtonElement {
  const el = document.createElement("button");
  document.body.appendChild(el);
  Object.defineProperty(el, "offsetParent", {
    configurable: true,
    value: null,
  });
  el.style.display = "none";
  return el;
}

/** Mutate an existing element so it passes `isLaidOut`. Used by hooks tests
 *  that have to construct the element themselves before calling the hook. */
export function makeVisible(
  el: HTMLElement,
  rect: Rect = { left: 0, top: 0, width: 50, height: 50 },
): void {
  Object.defineProperty(el, "offsetParent", {
    configurable: true,
    value: document.body,
  });
  stubRect(el, rect);
}

/** Append a fresh `<div>` to body to act as a portal/render container. */
export function makeContainer(): HTMLDivElement {
  const c = document.createElement("div");
  document.body.appendChild(c);
  return c;
}

/** Flush pending React effects by awaiting a microtask inside `act`. */
export async function flushReact(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}
