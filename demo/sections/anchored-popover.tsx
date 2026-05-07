import { useRef, useState } from "react";
import { type EngineHandle, createCoachmarksEngine } from "../../src";
import { useEngineDefaults } from "../theme-context";

export function AnchoredPopoverSection() {
  const targetRef = useRef<HTMLButtonElement>(null);
  const engineRef = useRef<EngineHandle | null>(null);
  const [active, setActive] = useState(false);
  const defaults = useEngineDefaults();

  const trigger = () => {
    if (!targetRef.current) return;
    if (engineRef.current) {
      engineRef.current.destroy();
    }
    const engine = createCoachmarksEngine({
      ...defaults,
      onCancelRequested: () => engine.destroy(),
      onDestroyed: () => {
        engineRef.current = null;
        setActive(false);
      },
    });
    engine.highlight({
      element: targetRef.current,
      popover: {
        title: "Anchored popover",
        description: "This popover anchors to the button below.",
        side: "bottom",
        align: "center",
      },
    });
    engineRef.current = engine;
    setActive(true);
  };

  return (
    <section>
      <h2>1. Anchored popover with arrow</h2>
      <p>Click the button to anchor a popover.</p>
      <button
        ref={targetRef}
        type="button"
        className="demo-target"
        onClick={trigger}
      >
        {active ? "(coachmark active)" : "Trigger coachmark"}
      </button>
    </section>
  );
}
