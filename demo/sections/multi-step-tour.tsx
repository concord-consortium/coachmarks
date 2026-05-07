import { useRef } from "react";
import { type EngineHandle, createCoachmarksEngine } from "../../src";
import { useEngineDefaults } from "../theme-context";

export function MultiStepTourSection() {
  const aRef = useRef<HTMLButtonElement>(null);
  const bRef = useRef<HTMLButtonElement>(null);
  const engineRef = useRef<EngineHandle | null>(null);
  const defaults = useEngineDefaults();

  const triggerStandard = () => {
    if (!aRef.current || !bRef.current) return;
    engineRef.current?.destroy();
    const engine = createCoachmarksEngine({
      ...defaults,
      showProgress: true,
      onCancelRequested: () => engine.destroy(),
      onDestroyed: () => {
        engineRef.current = null;
      },
    });
    engine.drive([
      {
        element: aRef.current,
        popover: { title: "Step one", description: "First step." },
      },
      {
        element: bRef.current,
        popover: { title: "Step two", description: "Second step." },
      },
    ]);
    engineRef.current = engine;
  };

  const triggerCustomLabels = () => {
    if (!aRef.current || !bRef.current) return;
    engineRef.current?.destroy();
    const engine = createCoachmarksEngine({
      ...defaults,
      showButtons: ["next"],
      nextBtnText: "Show me",
      doneBtnText: "Okay",
      onCancelRequested: () => engine.destroy(),
      onDestroyed: () => {
        engineRef.current = null;
      },
    });
    engine.drive([
      {
        element: aRef.current,
        popover: { title: "Meet the helper" },
      },
      {
        element: bRef.current,
        popover: { title: "Now click here." },
      },
    ]);
    engineRef.current = engine;
  };

  return (
    <section>
      <h2>3. Multi-step tour</h2>
      <p>
        Two examples: standard with progress text, and a variant with custom
        button labels and no Previous button.
      </p>
      <div className="demo-controls">
        <button type="button" className="demo-target" onClick={triggerStandard}>
          Standard tour
        </button>
        <button
          type="button"
          className="demo-target"
          onClick={triggerCustomLabels}
        >
          Custom labels (no Previous)
        </button>
      </div>
      <div style={{ marginTop: 200, display: "flex", gap: 240 }}>
        <button ref={aRef} type="button" className="demo-target">
          Target A
        </button>
        <button ref={bRef} type="button" className="demo-target">
          Target B
        </button>
      </div>
    </section>
  );
}
