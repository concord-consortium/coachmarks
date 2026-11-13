import { useCallback, useEffect, useRef, useState } from "react";

export interface PopoverDragState {
  position: { x: number; y: number } | null;
  isDragging: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
}

export function usePopoverDrag(
  resetKey: unknown,
  popoverEl: HTMLElement | null,
): PopoverDragState {
  const [position, setPosition] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [isDragging, setIsDragging] = useState(false);
  const cleanupRef = useRef<(() => void) | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: resetKey is intentionally an opaque trigger for reset.
  useEffect(() => {
    // Detach any in-flight drag listeners from the prior step — without this,
    // a step transition mid-drag leaves pointermove bound and setPosition
    // continues firing after the reset, leaving isDragging false but position
    // updating under the cursor.
    cleanupRef.current?.();
    setPosition(null);
    setIsDragging(false);
  }, [resetKey]);

  useEffect(
    () => () => {
      cleanupRef.current?.();
    },
    [],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!popoverEl) return;
      if (e.button !== 0) return;
      if (
        (e.target as HTMLElement).closest("button, input, select, textarea, a")
      ) {
        return;
      }
      e.preventDefault();
      cleanupRef.current?.();

      const rect = popoverEl.getBoundingClientRect();
      const grabX = e.clientX - rect.left;
      const grabY = e.clientY - rect.top;
      const popW = rect.width;
      const popH = rect.height;
      const padding = 8;

      setIsDragging(true);
      // Captured events still bubble to document, and keep arriving while the
      // pointer is over an iframe. Capturing once the pointer moves, rather than
      // on pointerdown, leaves a click's target where it was pressed; pointerleave
      // covers a first move that lands in an iframe. jsdom lacks setPointerCapture.
      // Only the pointer that started the drag moves or ends it, so a second finger is ignored.
      const pointerId = e.pointerId;
      let captured = false;
      const capture = (ev: PointerEvent) => {
        if (captured || ev.pointerId !== pointerId) return;
        captured = true;
        try {
          popoverEl.setPointerCapture?.(pointerId);
        } catch {
          // Throws for a pointer that is no longer active; the drag goes on uncaptured.
        }
      };

      const onMove = (ev: PointerEvent) => {
        if (ev.pointerId !== pointerId) return;
        capture(ev);
        const newX = ev.clientX - grabX;
        const newY = ev.clientY - grabY;
        const maxX = window.innerWidth - popW - padding;
        const maxY = window.innerHeight - popH - padding;
        setPosition({
          x: Math.max(padding, Math.min(newX, maxX)),
          y: Math.max(padding, Math.min(newY, maxY)),
        });
      };
      const detach = () => {
        if (captured && popoverEl.hasPointerCapture?.(pointerId)) {
          popoverEl.releasePointerCapture(pointerId);
        }
        popoverEl.removeEventListener("pointerleave", capture);
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        document.removeEventListener("pointercancel", onUp);
        cleanupRef.current = null;
      };
      const onUp = (ev: PointerEvent) => {
        if (ev.pointerId !== pointerId) return;
        setIsDragging(false);
        detach();
      };
      cleanupRef.current = detach;
      popoverEl.addEventListener("pointerleave", capture);
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
      document.addEventListener("pointercancel", onUp);
    },
    [popoverEl],
  );

  return { position, isDragging, onPointerDown };
}
