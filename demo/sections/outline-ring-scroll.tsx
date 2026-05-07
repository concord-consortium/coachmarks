import { useRef } from "react";
import { type EngineHandle, createCoachmarksEngine } from "../../src";
import { useEngineDefaults } from "../theme-context";

export function OutlineRingScrollSection() {
  const farTargetRef = useRef<HTMLButtonElement>(null);
  const engineRef = useRef<EngineHandle | null>(null);
  const defaults = useEngineDefaults();

  const trigger = () => {
    if (!farTargetRef.current) return;
    engineRef.current?.destroy();
    const engine = createCoachmarksEngine({
      ...defaults,
      onCancelRequested: () => engine.destroy(),
      onDestroyed: () => {
        engineRef.current = null;
      },
    });
    engine.highlight({
      element: farTargetRef.current,
      popover: {
        title: "Way down here",
        description: "The engine scrolled this into view.",
        side: "top",
      },
    });
    engineRef.current = engine;
  };

  return (
    <section>
      <h2>2. Outline ring + scroll-into-view</h2>
      <p>Click the button. The engine scrolls down to the far target.</p>
      <button type="button" className="demo-target" onClick={trigger}>
        Trigger coachmark
      </button>
      <div className="demo-tall-spacer" />
      <button ref={farTargetRef} type="button" className="demo-target">
        Far target
      </button>
      <div className="demo-tall-spacer" />
    </section>
  );
}
