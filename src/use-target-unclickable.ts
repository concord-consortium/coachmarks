import { useEffect, useState } from "react";

/**
 * Reactive un-clickability of an anchored target: true while the element is `disabled` or
 * `aria-disabled="true"`. Read at effect mount and re-read on the attribute mutation, so a
 * gated step whose anchor is dead can offer Next, and one whose anchor comes back is gated
 * again.
 *
 * Deliberately not part of `useTargetWatcher`. That hook answers "is the target gone" once
 * and disconnects, and its callback cancels the tour; un-clickability is reversible and must
 * not reach that path.
 *
 * Pass `null` for viewport popovers, which have no anchor.
 */
export function useTargetUnclickable(target: HTMLElement | null): boolean {
  const [unclickable, setUnclickable] = useState(false);
  useEffect(() => {
    if (!target) {
      setUnclickable(false);
      return;
    }
    const read = () =>
      (target as HTMLButtonElement).disabled === true ||
      target.getAttribute("aria-disabled") === "true";
    setUnclickable(read());
    const observer = new MutationObserver(() => setUnclickable(read()));
    observer.observe(target, {
      attributes: true,
      attributeFilter: ["disabled", "aria-disabled"],
    });
    return () => observer.disconnect();
  }, [target]);
  return unclickable;
}
