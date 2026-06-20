import { useRef } from "react";
import { type EngineHandle, createCoachmarksEngine } from "../../src";
import { useEngineDefaults } from "../theme-context";

/** A small inline SVG figure (decorative — its meaning is carried by the description). */
function MountainGlyph() {
  return (
    <svg
      width="120"
      height="72"
      viewBox="0 0 120 72"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="120" height="72" rx="6" fill="#cfe8ff" />
      <path d="M0 72 L40 24 L66 56 L88 30 L120 72 Z" fill="#5b8def" />
      <circle cx="96" cy="20" r="10" fill="#ffd34d" />
    </svg>
  );
}

export function ImagePopoverSection() {
  const svgRef = useRef<HTMLButtonElement>(null);
  const imgRef = useRef<HTMLButtonElement>(null);
  const engineRef = useRef<EngineHandle | null>(null);
  const defaults = useEngineDefaults();

  const showSvg = () => {
    if (!svgRef.current) return;
    engineRef.current?.destroy();
    const engine = createCoachmarksEngine({
      ...defaults,
      onCancelRequested: () => engine.destroy(),
      onDestroyed: () => {
        engineRef.current = null;
      },
    });
    engine.highlight({
      element: svgRef.current,
      popover: {
        title: "Mountain top",
        image: <MountainGlyph />,
        description:
          "An inline SVG figure renders between the title and this description.",
      },
    });
    engineRef.current = engine;
  };

  const showImg = () => {
    if (!imgRef.current) return;
    engineRef.current?.destroy();
    const engine = createCoachmarksEngine({
      ...defaults,
      onCancelRequested: () => engine.destroy(),
      onDestroyed: () => {
        engineRef.current = null;
      },
    });
    // A data-URI <img> with its own alt — the consumer owns the element's a11y.
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="60"><rect width="120" height="60" rx="6" fill="#ffe0b3"/><text x="60" y="36" font-size="16" text-anchor="middle" fill="#7a4a00">map</text></svg>';
    const dataUri = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    engine.highlight({
      element: imgRef.current,
      popover: {
        title: "With an <img>",
        image: (
          <img
            src={dataUri}
            alt="Map of the burn area"
            width={120}
            height={60}
          />
        ),
        description:
          "An <img> with its own alt text, supplied by the consumer.",
      },
    });
    engineRef.current = engine;
  };

  return (
    <section>
      <h2>10. Image / figure popover</h2>
      <p>
        A popover can render an <code>image?: ReactNode</code> in a figure slot
        between the title and description. The consumer owns the element&apos;s
        alt/aria.
      </p>
      <div className="demo-controls">
        <button
          ref={svgRef}
          type="button"
          className="demo-target"
          onClick={showSvg}
        >
          Inline SVG figure
        </button>
        <button
          ref={imgRef}
          type="button"
          className="demo-target"
          onClick={showImg}
        >
          &lt;img&gt; with alt
        </button>
      </div>
    </section>
  );
}
