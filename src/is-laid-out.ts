export function isLaidOut(el: HTMLElement): boolean {
  if (!el.isConnected) return false;
  // `display: none` → no offsetParent unless `position: fixed`.
  // `visibility: hidden` and `opacity: 0` retain layout boxes — not rejected here.
  if (el.offsetParent === null && getComputedStyle(el).position !== "fixed") {
    return false;
  }
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return false;
  return true;
}
