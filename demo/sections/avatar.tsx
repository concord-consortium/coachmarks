import { useRef } from "react";
import { type EngineHandle, createCoachmarksEngine } from "../../src";
import { useEngineDefaults } from "../theme-context";

/** Demonstrates the hazbot-theme robot avatar badge and its `showAvatar: false` opt-out.
 *  Switch the demo theme to "hazbot" to see the badge; base/codap never paint it. */
export function AvatarSection() {
  const withAvatarRef = useRef<HTMLButtonElement>(null);
  const noAvatarRef = useRef<HTMLButtonElement>(null);
  const engineRef = useRef<EngineHandle | null>(null);
  const defaults = useEngineDefaults();

  const show = (anchor: HTMLElement | null, showAvatar: boolean) => {
    if (!anchor) return;
    engineRef.current?.destroy();
    const engine = createCoachmarksEngine({
      ...defaults,
      showAvatar,
      onCancelRequested: () => engine.destroy(),
      onDestroyed: () => {
        engineRef.current = null;
      },
    });
    engine.highlight({
      element: anchor,
      popover: {
        // No title — matches wildfire's description-only hazbot popovers so the avatar
        // overlap reads against the body text the way the Zeplin design shows it.
        description: showAvatar
          ? "Place one spark in Zone 1 and one spark in Zone 2, then run the model again."
          : "showAvatar: false — the badge is suppressed on this popover.",
      },
    });
    engineRef.current = engine;
  };

  return (
    <section>
      <h2>9. Avatar badge</h2>
      <p>
        The hazbot-theme robot avatar renders by default and is suppressed with{" "}
        <code>showAvatar: false</code>. (Switch the theme to{" "}
        <strong>hazbot</strong> — base/codap never paint it.)
      </p>
      <div className="demo-controls">
        <button
          ref={withAvatarRef}
          type="button"
          className="demo-target"
          onClick={() => show(withAvatarRef.current, true)}
        >
          Default (avatar shown)
        </button>
        <button
          ref={noAvatarRef}
          type="button"
          className="demo-target"
          onClick={() => show(noAvatarRef.current, false)}
        >
          showAvatar: false (suppressed)
        </button>
      </div>
    </section>
  );
}
