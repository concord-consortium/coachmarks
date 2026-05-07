import { useEffect } from "react";
import { isLaidOut } from "./is-laid-out";

/**
 * Watches for the target element being removed from the document or hidden via
 * `display: none` / zero-size rect. Fires `onRemoved` once when the element fails
 * the layout-box predicate. Pass `null` to disable the watcher (used for viewport
 * popovers that have no anchor).
 */
export function useTargetWatcher(
  target: HTMLElement | null,
  onRemoved: () => void,
) {
  useEffect(() => {
    if (!target) return;
    let cancelled = false;
    if (!isLaidOut(target)) {
      // Defer to a microtask: the engine's rAF guard already validated the
      // target before we mounted, so this fires only when an ancestor
      // synchronously hid the target between rAF and effect mount. Dispatching
      // synchronously inside the effect body would re-enter the store update
      // mid-commit; queueMicrotask runs after React's commit phase.
      queueMicrotask(() => {
        if (!cancelled) onRemoved();
      });
      return () => {
        cancelled = true;
      };
    }
    const observer = new MutationObserver(() => {
      if (!isLaidOut(target)) {
        onRemoved();
        observer.disconnect();
      }
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
    });
    return () => observer.disconnect();
  }, [target, onRemoved]);
}
