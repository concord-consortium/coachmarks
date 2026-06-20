import { useEffect } from "react";

const WIDGET_ROLES = new Set([
  "menu",
  "menuitem",
  "menuitemcheckbox",
  "menuitemradio",
  "listbox",
  "option",
  "tree",
  "treeitem",
  "grid",
  "gridcell",
  "tablist",
  "tab",
  "slider",
  "spinbutton",
  "dialog",
  "alertdialog",
  "combobox",
]);

function isInInteractiveWidget(el: HTMLElement): boolean {
  const withRole = el.closest("[role]");
  if (!withRole) return false;
  const role = withRole.getAttribute("role");
  return role != null && WIDGET_ROLES.has(role);
}

interface UseKeyboardControlArgs {
  enabled: boolean;
  allowClose: boolean;
  /** When false (gated tours), ArrowLeft/ArrowRight are inert so the keyboard can't skip
   *  the gate or retreat. Escape (close) is independent of this flag. Default true. */
  allowStepNavigation?: boolean;
  popoverEl: HTMLElement | null;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
}

export function useKeyboardControl({
  enabled,
  allowClose,
  allowStepNavigation = true,
  popoverEl,
  onNext,
  onPrev,
  onClose,
}: UseKeyboardControlArgs) {
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      const t = e.target as HTMLElement | null;
      const insidePopover = popoverEl && t && popoverEl.contains(t);
      // Treat focus inside *any* coachmark popover (companion popovers in a group)
      // as "inside us" so the widget-role early-return doesn't swallow Escape on a
      // focused companion (its role="dialog" would otherwise match isInInteractiveWidget).
      const insideAnyCoachmark = !!t?.closest(".coachmarks-popover");
      if (!insidePopover && !insideAnyCoachmark) {
        if (
          t &&
          (t.tagName === "INPUT" ||
            t.tagName === "TEXTAREA" ||
            t.tagName === "SELECT" ||
            t.isContentEditable ||
            isInInteractiveWidget(t))
        ) {
          return;
        }
      }
      switch (e.key) {
        case "ArrowRight":
          if (!allowStepNavigation) return;
          onNext();
          break;
        case "ArrowLeft":
          if (!allowStepNavigation) return;
          onPrev();
          break;
        case "Escape":
          if (!allowClose) return;
          onClose();
          break;
        default:
          return;
      }
      e.preventDefault();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [
    enabled,
    allowClose,
    allowStepNavigation,
    popoverEl,
    onNext,
    onPrev,
    onClose,
  ]);
}
