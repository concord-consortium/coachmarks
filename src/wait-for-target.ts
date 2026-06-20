import { isLaidOut } from "./is-laid-out";

/** Resolve `selector` to a laid-out element now, or watch the document until one appears.
 *  Returns a disposer. `onResolved` fires at most once. Mirrors use-target-watcher's
 *  MutationObserver(document.body, {childList, subtree, attributes}). The immediate-resolve,
 *  appearance-on-insert, and disposer paths are unit-tested in jsdom via the jsdom-anchor
 *  stubs (makeAnchorButton/makeVisible stub offsetParent + getBoundingClientRect so isLaidOut
 *  passes), exactly as use-target-watcher.test.ts tests the inverse watcher. Only the real
 *  CSS-driven reveal (animate-open, display:none -> visible) is a demo/Playwright check. */
export function waitForTarget(
  selector: string,
  onResolved: (el: HTMLElement) => void,
): () => void {
  const tryNow = (): HTMLElement | null => {
    const el = document.querySelector<HTMLElement>(selector);
    return el && isLaidOut(el) ? el : null;
  };
  const immediate = tryNow();
  if (immediate) {
    onResolved(immediate);
    return () => {};
  }
  const observer = new MutationObserver(() => {
    const el = tryNow();
    if (el) {
      observer.disconnect();
      onResolved(el);
    }
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
  });
  return () => observer.disconnect();
}
