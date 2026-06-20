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
  /** Per-corner border-radius (TL, TR, BR, BL) in px, copied from the ring target's
   *  computed style + the 2px outset, so the ring follows the target's corner radius
   *  (e.g. a pill/tab-shaped control) instead of a fixed value. */
  radii: [number, number, number, number];
}

/** Fallback outset (px) when the --coachmarks-ring-width CSS var is unavailable. */
const DEFAULT_RING_WIDTH = 2;

/** Read the themed ring stroke width (px) from the :root `--coachmarks-ring-width` var.
 *  The ring is offset by exactly this width so its `border-box` stroke sits flush just
 *  outside the target (inner edge on the target edge) regardless of theme (hazbot = 3px). */
function ringWidth(): number {
  if (typeof getComputedStyle === "undefined") return DEFAULT_RING_WIDTH;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(
    "--coachmarks-ring-width",
  );
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? n : DEFAULT_RING_WIDTH;
}

/** Read a single computed corner radius (e.g. "8px" or "8px 4px") as a number, taking the
 *  first (horizontal) component; non-numeric / unset → 0. Elliptical corners degrade to a
 *  circular approximation, which is fine for the controls coach marks ring. */
function cornerRadius(value: string): number {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : 0;
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
      // Follow the target's own corner radii so the ring hugs pill/tab-shaped controls
      // (different corners per button) instead of a fixed radius. The ring sits `outset`
      // px outside the target on every side (= the themed stroke width, so the stroke is
      // flush just outside it), so add the outset to each corner to keep the stroke
      // parallel to the target's corner.
      const outset = ringWidth();
      const cs = getComputedStyle(target);
      const radii: [number, number, number, number] = [
        cornerRadius(cs.borderTopLeftRadius) + outset,
        cornerRadius(cs.borderTopRightRadius) + outset,
        cornerRadius(cs.borderBottomRightRadius) + outset,
        cornerRadius(cs.borderBottomLeftRadius) + outset,
      ];
      const next: RingRect = {
        top: r.top - outset,
        left: r.left - outset,
        width: r.width + outset * 2,
        height: r.height + outset * 2,
        radii,
      };
      setRect((prev) =>
        prev?.top === next.top &&
        prev?.left === next.left &&
        prev?.width === next.width &&
        prev?.height === next.height &&
        prev?.radii[0] === next.radii[0] &&
        prev?.radii[1] === next.radii[1] &&
        prev?.radii[2] === next.radii[2] &&
        prev?.radii[3] === next.radii[3]
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
          borderTopLeftRadius: rect.radii[0],
          borderTopRightRadius: rect.radii[1],
          borderBottomRightRadius: rect.radii[2],
          borderBottomLeftRadius: rect.radii[3],
        }}
      />
    </FloatingPortal>
  );
}
