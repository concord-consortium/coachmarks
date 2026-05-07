import { describe, expect, it, vi } from "vitest";
import { scrollTargetIntoView } from "./scroll-into-view";

function makeEl() {
  const el = document.createElement("div");
  // jsdom doesn't implement scrollIntoView; assign a stub before spying.
  (el as unknown as { scrollIntoView: () => void }).scrollIntoView = () => {};
  return el;
}

describe("scrollTargetIntoView", () => {
  it("calls scrollIntoView with smooth behavior when smooth=true and not reduced motion", () => {
    const el = makeEl();
    const spy = vi.spyOn(el, "scrollIntoView");
    scrollTargetIntoView(el, true, false);
    expect(spy).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "nearest",
      inline: "nearest",
    });
  });

  it("calls scrollIntoView with auto behavior when smooth=false", () => {
    const el = makeEl();
    const spy = vi.spyOn(el, "scrollIntoView");
    scrollTargetIntoView(el, false, false);
    expect(spy).toHaveBeenCalledWith({
      behavior: "auto",
      block: "nearest",
      inline: "nearest",
    });
  });

  it("forces 'auto' when prefersReducedMotion is true, even if smooth is requested", () => {
    const el = makeEl();
    const spy = vi.spyOn(el, "scrollIntoView");
    scrollTargetIntoView(el, true, true);
    expect(spy).toHaveBeenCalledWith({
      behavior: "auto",
      block: "nearest",
      inline: "nearest",
    });
  });
});
