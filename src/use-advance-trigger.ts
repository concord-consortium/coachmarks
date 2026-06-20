import { useEffect } from "react";
import type { AdvanceTrigger } from "./types";

/** While mounted, advance the tour when `trigger.event` fires on `anchor`. Used only for the
 *  primary popover of an actionGated step. Null anchor/trigger short-circuits. */
export function useAdvanceTrigger(
  anchor: HTMLElement | null,
  trigger: AdvanceTrigger | undefined,
  onAdvance: () => void,
) {
  useEffect(() => {
    if (!anchor || !trigger) return;
    const handler = () => onAdvance();
    anchor.addEventListener(trigger.event, handler);
    return () => anchor.removeEventListener(trigger.event, handler);
  }, [anchor, trigger, onAdvance]);
}
