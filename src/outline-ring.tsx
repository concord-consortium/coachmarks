import { FloatingPortal } from "@floating-ui/react";
import { useEffect, useState } from "react";
import type { EngineLiveState } from "./engine-state";
import { type Store, useStore } from "./store";

interface OutlineRingsProps {
  store: Store<EngineLiveState>;
  container: HTMLElement;
}

interface RingRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

/** Outer component: iterates `state.currentPopovers` and renders one inner OutlineRing per
 *  anchored, non-dismissed popover. The inner component owns its own state so each ring's
 *  autoUpdate subscription is scoped correctly. */
export function OutlineRings({ store, container }: OutlineRingsProps) {
  const popovers = useStore(store, (s) => s.currentPopovers);
  const dismissed = useStore(store, (s) => s.dismissedPopoverIndices);
  const showOutlineRing = useStore(
    store,
    (s) => s.options.showOutlineRing ?? true,
  );
  if (!showOutlineRing) return null;
  return (
    <>
      {popovers.map((spec, i) => {
        if (dismissed.has(i)) return null;
        if (!spec.element) return null;
        // Ring target defaults to the anchor element, but a step may ring a
        // different element (e.g. ring a button while anchoring to its inner icon).
        const ringTarget =
          (spec as { ringElement?: HTMLElement }).ringElement ?? spec.element;
        return (
          <OutlineRing
            // biome-ignore lint/suspicious/noArrayIndexKey: index is the stable popover identity here.
            key={i}
            target={ringTarget}
            store={store}
            container={container}
          />
        );
      })}
    </>
  );
}

interface OneProps {
  target: HTMLElement;
  store: Store<EngineLiveState>;
  container: HTMLElement;
}

function OutlineRing({ target, store, container }: OneProps) {
  const refreshTick = useStore(store, (s) => s.refreshTick);
  const [rect, setRect] = useState<RingRect | null>(null);

  useEffect(() => {
    void refreshTick;
    const measure = () => {
      const r = target.getBoundingClientRect();
      const next: RingRect = {
        top: r.top - 2,
        left: r.left - 2,
        width: r.width + 4,
        height: r.height + 4,
      };
      setRect((prev) =>
        prev?.top === next.top &&
        prev?.left === next.left &&
        prev?.width === next.width &&
        prev?.height === next.height
          ? prev
          : next,
      );
    };
    measure();
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    const ro =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(measure)
        : null;
    ro?.observe(target);
    return () => {
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
      ro?.disconnect();
    };
  }, [target, refreshTick]);

  if (!rect) return null;

  return (
    <FloatingPortal root={container}>
      <div
        aria-hidden="true"
        data-testid="coachmarks-outline-ring"
        className="coachmarks-outline-ring"
        style={{
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        }}
      />
    </FloatingPortal>
  );
}
