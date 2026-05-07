import { useRef, useState } from "react";
import { type EngineHandle, createCoachmarksEngine } from "../../src";
import { useEngineDefaults } from "../theme-context";

type Variant = "with-title" | "without-title";

export function AnchoredPopoverSection() {
  const withTitleRef = useRef<HTMLButtonElement>(null);
  const withoutTitleRef = useRef<HTMLButtonElement>(null);
  const engineRef = useRef<EngineHandle | null>(null);
  const [active, setActive] = useState<Variant | null>(null);
  const defaults = useEngineDefaults();

  const trigger = (variant: Variant) => {
    const target =
      variant === "with-title" ? withTitleRef.current : withoutTitleRef.current;
    if (!target) return;
    if (engineRef.current) {
      engineRef.current.destroy();
    }
    const engine = createCoachmarksEngine({
      ...defaults,
      onCancelRequested: () => engine.destroy(),
      onDestroyed: () => {
        engineRef.current = null;
        setActive(null);
      },
    });
    engine.highlight({
      element: target,
      popover: {
        ...(variant === "with-title" ? { title: "Anchored popover" } : {}),
        description: "This popover anchors to the button below.",
        side: "bottom",
        align: "center",
      },
    });
    engineRef.current = engine;
    setActive(variant);
  };

  return (
    <section>
      <h2>1. Anchored popover with arrow</h2>
      <p>Click a button to anchor a popover.</p>
      <button
        ref={withTitleRef}
        type="button"
        className="demo-target"
        onClick={() => trigger("with-title")}
      >
        {active === "with-title" ? "(coachmark active)" : "Popup with title"}
      </button>{" "}
      <button
        ref={withoutTitleRef}
        type="button"
        className="demo-target"
        onClick={() => trigger("without-title")}
      >
        {active === "without-title"
          ? "(coachmark active)"
          : "Popup without title"}
      </button>
    </section>
  );
}
