import { useRef } from "react";
import { type EngineHandle, createCoachmarksEngine } from "../../src";
import { useEngineDefaults } from "../theme-context";

export function DraggableSection() {
  const targetRef = useRef<HTMLButtonElement>(null);
  const engineRef = useRef<EngineHandle | null>(null);
  const defaults = useEngineDefaults();

  const trigger = () => {
    if (!targetRef.current) return;
    engineRef.current?.destroy();
    const engine = createCoachmarksEngine({
      ...defaults,
      onCancelRequested: () => engine.destroy(),
      onDestroyed: () => {
        engineRef.current = null;
      },
    });
    engine.highlight({
      element: targetRef.current,
      popover: {
        title: "Drag me",
        description: "Click and drag this popover. The arrow re-orients.",
      },
    });
    engineRef.current = engine;
  };

  return (
    <section>
      <h2>4. Draggable popover</h2>
      <p>Trigger, then drag the popover by its background.</p>
      <button
        ref={targetRef}
        type="button"
        className="demo-target"
        onClick={trigger}
      >
        Trigger coachmark
      </button>
    </section>
  );
}
