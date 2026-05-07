export function scrollTargetIntoView(
  el: HTMLElement,
  smooth: boolean,
  prefersReducedMotion: boolean,
) {
  const behavior = !smooth || prefersReducedMotion ? "auto" : "smooth";
  el.scrollIntoView({ behavior, block: "nearest", inline: "nearest" });
}
