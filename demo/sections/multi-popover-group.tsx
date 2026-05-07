import { useRef, useState } from "react";
import {
  type EngineHandle,
  type PopoverGroup,
  createCoachmarksEngine,
} from "../../src";
import { useEngineDefaults } from "../theme-context";

export function MultiPopoverGroupSection() {
  const targetRef = useRef<HTMLButtonElement>(null);
  const [behavior, setBehavior] = useState<"individual" | "group">(
    "individual",
  );
  const [companionFocus, setCompanionFocus] = useState(false);
  const [engine, setEngine] = useState<EngineHandle | null>(null);
  const defaults = useEngineDefaults();

  const trigger = () => {
    if (!targetRef.current) return;
    if (engine) engine.destroy();
    const e = createCoachmarksEngine({
      ...defaults,
      doneBtnText: "Okay",
      showButtons: ["next", "close"],
      onCancelRequested: () => e.destroy(),
      onDestroyed: () => setEngine(null),
    });
    const group: PopoverGroup = {
      popovers: [
        {
          element: targetRef.current,
          popover: {
            title: "Hazbot",
            description: "I will analyze your model after you run it!",
          },
        },
        {
          popover: {
            position: "top-center",
            title: "Scroll up!",
          },
          initialFocus: companionFocus,
        },
      ],
      dismissBehavior: behavior,
    };
    e.highlight(group);
    setEngine(e);
  };

  const dismissCompanion = () => {
    engine?.dismissPopover(1);
  };

  return (
    <section>
      <h2>6. Multi-popover group</h2>
      <div className="demo-controls">
        <label>
          dismissBehavior:{" "}
          <select
            value={behavior}
            onChange={(e) =>
              setBehavior(e.target.value as "individual" | "group")
            }
          >
            <option value="individual">individual</option>
            <option value="group">group</option>
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={companionFocus}
            onChange={(e) => setCompanionFocus(e.target.checked)}
          />
          companion gets initialFocus
        </label>
      </div>
      <div className="demo-controls">
        <button type="button" className="demo-target" onClick={trigger}>
          Trigger group
        </button>
        <button
          type="button"
          className="demo-target"
          onClick={dismissCompanion}
        >
          Dismiss companion (idx 1)
        </button>
      </div>
      <div style={{ marginTop: 200 }}>
        <button ref={targetRef} type="button" className="demo-target">
          Hazbot mascot
        </button>
      </div>
    </section>
  );
}
