import { useRef, useState } from "react";
import { type EngineHandle, createCoachmarksEngine } from "../../src";
import { useEngineDefaults } from "../theme-context";

export function ReducedMotionSection() {
  const targetRef = useRef<HTMLButtonElement>(null);
  const engineRef = useRef<EngineHandle | null>(null);
  const [animate, setAnimate] = useState(true);
  const [smoothScroll, setSmoothScroll] = useState(true);
  const defaults = useEngineDefaults();

  const trigger = () => {
    if (!targetRef.current) return;
    engineRef.current?.destroy();
    const engine = createCoachmarksEngine({
      ...defaults,
      animate,
      smoothScroll,
      onCancelRequested: () => engine.destroy(),
      onDestroyed: () => {
        engineRef.current = null;
      },
    });
    engine.highlight({
      element: targetRef.current,
      popover: {
        title: "Reduced motion",
        description: `animate=${animate}, smoothScroll=${smoothScroll}`,
      },
    });
    engineRef.current = engine;
  };

  return (
    <section>
      <h2>8. Reduced motion + animation toggles</h2>
      <p>OS-level prefers-reduced-motion overrides smoothScroll regardless.</p>
      <div className="demo-controls">
        <label>
          <input
            type="checkbox"
            checked={animate}
            onChange={(e) => setAnimate(e.target.checked)}
          />
          animate
        </label>
        <label>
          <input
            type="checkbox"
            checked={smoothScroll}
            onChange={(e) => setSmoothScroll(e.target.checked)}
          />
          smoothScroll
        </label>
        <button type="button" className="demo-target" onClick={trigger}>
          Trigger
        </button>
      </div>
      <div style={{ marginTop: 200 }}>
        <button ref={targetRef} type="button" className="demo-target">
          Target
        </button>
      </div>
    </section>
  );
}
