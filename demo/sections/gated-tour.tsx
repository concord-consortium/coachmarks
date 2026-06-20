import { useRef, useState } from "react";
import { type EngineHandle, createCoachmarksEngine } from "../../src";
import { useEngineDefaults } from "../theme-context";

/** Two-sub-panel wizard mimicking wildfire's Setup wizard, driving a gated tour over selector
 *  targets. Each advance removes the prior step's anchor so the section exercises lazy
 *  wait-for-target, advanceOn:{event:"click"}, and BOTH cases of degrade-on-removal:
 *   - open-btn removed on click while step-2 target is still mounting → degrade case (a)
 *   - terminal step's panel closed via "Close panel" → degrade case (b)
 */
export function GatedTourSection() {
  // "idle": open button shown. "a": sub-panel A (its Next appears after a ~400ms reveal).
  // "b": sub-panel B (control + Close panel). "closed": panel B removed (terminal anchor gone).
  const [wiz, setWiz] = useState<"idle" | "a" | "b" | "closed">("idle");
  const [aReady, setAReady] = useState(false);
  const engineRef = useRef<EngineHandle | null>(null);
  const aRevealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const defaults = useEngineDefaults();

  const reset = () => {
    if (aRevealTimer.current) clearTimeout(aRevealTimer.current);
    setAReady(false);
    setWiz("idle");
  };

  const openPanelA = () => {
    setWiz("a");
    // Sub-panel A's Next button (step-2 target) appears after a ~400ms animate-open, so the
    // tour holds step 1 (now degraded — its anchor was just removed) until it lays out.
    aRevealTimer.current = setTimeout(() => setAReady(true), 400);
  };

  const startTour = () => {
    engineRef.current?.destroy();
    reset();
    const engine = createCoachmarksEngine({
      ...defaults,
      actionGated: true,
      showProgress: true,
      // "next" required for the terminal Done; the actionGated rule hides Next on intermediate
      // steps and renders it as Done only on the last step.
      showButtons: ["next", "close"],
      doneBtnText: "Got it!",
      onCancelRequested: () => engine.destroy(),
      onDestroyed: () => {
        engineRef.current = null;
      },
    });
    engine.drive([
      // Step 1 — present anchor, advance on click. Clicking opens sub-panel A AND removes the
      // open button (degrade case (a): held step re-floats centered, then advances).
      {
        target: '[data-testid="open-btn"]',
        advanceOn: { event: "click" },
        popover: { description: "Click to open the panel." },
      },
      // Step 2 — lazy selector in sub-panel A: the engine waits for it, then anchors. Clicking
      // Next swaps to sub-panel B (removing this anchor).
      {
        target: '[data-testid="panel-a-next"]',
        advanceOn: { event: "click" },
        popover: { description: "This appeared after the click. Click Next." },
      },
      // Step 3 — terminal, anchored to a control in sub-panel B (selector + wait). NOT
      // action-gated, so it shows the [Got it!] Done button. "Close panel" removes the panel →
      // degrade case (b): the terminal re-floats centered but keeps Done/progress.
      {
        target: '[data-testid="panel-b-control"]',
        popover: {
          description: "Adjust this, then close the panel and finish.",
        },
      },
    ]);
    engineRef.current = engine;
  };

  return (
    <section>
      <h2>11. Gated tour (action-gated + degrade-on-removal)</h2>
      <p>
        A gated tour over selector targets: it waits for each control to appear,
        advances on the student&apos;s click, hides the Next button on
        intermediate steps, and re-floats a step as a centered popover when its
        anchor is removed (instead of cancelling).
      </p>
      <div className="demo-controls">
        <button type="button" className="demo-target" onClick={startTour}>
          Start gated tour
        </button>
        <button type="button" onClick={reset}>
          Reset wizard
        </button>
      </div>

      <div className="demo-wizard" style={{ marginTop: 160, minHeight: 120 }}>
        {wiz === "idle" && (
          <button
            type="button"
            className="demo-target"
            data-testid="open-btn"
            onClick={openPanelA}
          >
            Open panel
          </button>
        )}

        {wiz === "a" && (
          <div className="demo-panel">
            <p>Sub-panel A</p>
            {aReady ? (
              <button
                type="button"
                className="demo-target"
                data-testid="panel-a-next"
                onClick={() => setWiz("b")}
              >
                Next
              </button>
            ) : (
              <p>
                <em>opening…</em>
              </p>
            )}
          </div>
        )}

        {wiz === "b" && (
          <div className="demo-panel">
            <p>Sub-panel B</p>
            <input
              type="range"
              data-testid="panel-b-control"
              aria-label="A control"
            />
            <div>
              <button type="button" onClick={() => setWiz("closed")}>
                Close panel
              </button>
            </div>
          </div>
        )}

        {wiz === "closed" && (
          <p>
            Panel closed — the terminal step is now a centered popover. Click{" "}
            <strong>Got it!</strong> to finish.
          </p>
        )}
      </div>
    </section>
  );
}
