import { useState } from "react";
import {
  type EngineHandle,
  type ViewportPopover,
  createCoachmarksEngine,
} from "../../src";
import { useEngineDefaults } from "../theme-context";

const POSITIONS: ViewportPopover["popover"]["position"][] = [
  "top-left",
  "top-center",
  "top-right",
  "middle-left",
  "center",
  "middle-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
];

type ArrowSide = "none" | "top" | "right" | "bottom" | "left";

export function NoAnchorCuesSection() {
  const [position, setPosition] =
    useState<ViewportPopover["popover"]["position"]>("top-center");
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(8);
  const [arrowSide, setArrowSide] = useState<ArrowSide>("none");
  const [engine, setEngine] = useState<EngineHandle | null>(null);
  const defaults = useEngineDefaults();

  const trigger = () => {
    if (engine) engine.destroy();
    const e = createCoachmarksEngine({
      ...defaults,
      onCancelRequested: () => e.destroy(),
      onDestroyed: () => setEngine(null),
    });
    e.highlight({
      popover: {
        position,
        title: "Viewport cue",
        description: `position: ${position}`,
        viewportOffset: { x: offsetX, y: offsetY },
        ...(arrowSide !== "none" && { arrow: { side: arrowSide } }),
      },
    });
    setEngine(e);
  };

  return (
    <section>
      <h2>5. No-anchor cues</h2>
      <div className="demo-controls">
        <label>
          Position:{" "}
          <select
            value={position}
            onChange={(e) =>
              setPosition(
                e.target.value as ViewportPopover["popover"]["position"],
              )
            }
          >
            {POSITIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label>
          x:{" "}
          <input
            type="number"
            value={offsetX}
            onChange={(e) => setOffsetX(Number(e.target.value))}
            style={{ width: 60 }}
          />
        </label>
        <label>
          y:{" "}
          <input
            type="number"
            value={offsetY}
            onChange={(e) => setOffsetY(Number(e.target.value))}
            style={{ width: 60 }}
          />
        </label>
        <label>
          Arrow:{" "}
          <select
            value={arrowSide}
            onChange={(e) => setArrowSide(e.target.value as ArrowSide)}
          >
            <option value="none">none</option>
            <option value="top">top</option>
            <option value="right">right</option>
            <option value="bottom">bottom</option>
            <option value="left">left</option>
          </select>
        </label>
        <button type="button" className="demo-target" onClick={trigger}>
          Trigger
        </button>
      </div>
    </section>
  );
}
