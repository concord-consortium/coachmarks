import { useEffect, useState } from "react";
// base.css is auto-imported by the engine via src/index.ts side-effect import.
import { AnchoredPopoverSection } from "./sections/anchored-popover";
import { AvatarSection } from "./sections/avatar";
import { DraggableSection } from "./sections/draggable";
import { MultiPopoverGroupSection } from "./sections/multi-popover-group";
import { MultiStepTourSection } from "./sections/multi-step-tour";
import { NoAnchorCuesSection } from "./sections/no-anchor-cues";
import { OutlineRingScrollSection } from "./sections/outline-ring-scroll";
import { ReducedMotionSection } from "./sections/reduced-motion";
import { ThemeSwitcherSection } from "./sections/theme-switcher";
import { ThemeProvider } from "./theme-context";
import { type ThemeName, loadTheme } from "./theme-loader";

interface Section {
  id: string;
  label: string;
  Component: React.ComponentType;
}

const SECTIONS: Section[] = [
  {
    id: "anchored",
    label: "1. Anchored popover",
    Component: AnchoredPopoverSection,
  },
  {
    id: "ring",
    label: "2. Outline ring + scroll",
    Component: OutlineRingScrollSection,
  },
  { id: "tour", label: "3. Multi-step tour", Component: MultiStepTourSection },
  {
    id: "draggable",
    label: "4. Draggable popover",
    Component: DraggableSection,
  },
  {
    id: "no-anchor",
    label: "5. No-anchor cues",
    Component: NoAnchorCuesSection,
  },
  {
    id: "group",
    label: "6. Multi-popover group",
    Component: MultiPopoverGroupSection,
  },
  { id: "theme", label: "7. Theme switcher", Component: ThemeSwitcherSection },
  {
    id: "reduced",
    label: "8. Reduced motion",
    Component: ReducedMotionSection,
  },
  { id: "avatar", label: "9. Avatar badge", Component: AvatarSection },
];

export function DemoApp() {
  const [activeId, setActiveId] = useState("anchored");
  const [theme, setTheme] = useState<ThemeName>("hazbot");

  useEffect(() => {
    loadTheme(theme);
  }, [theme]);

  const Active = SECTIONS.find((s) => s.id === activeId)?.Component ?? null;

  return (
    <ThemeProvider theme={theme}>
      <a
        className="demo-github-link"
        href="https://github.com/concord-consortium/coachmarks"
        target="_blank"
        rel="noopener noreferrer"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          width="24"
          height="24"
          fill="currentColor"
        >
          <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.27-.01-1-.02-1.96-3.2.69-3.87-1.54-3.87-1.54-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.69.08-.69 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.69 1.24 3.34.95.1-.74.4-1.24.72-1.53-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.04 11.04 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.62 1.59.23 2.76.12 3.05.74.81 1.18 1.84 1.18 3.1 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.06.78 2.13 0 1.54-.01 2.78-.01 3.16 0 .31.21.68.8.56C20.21 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z" />
        </svg>
        <span className="demo-sr-only">View on GitHub</span>
      </a>
      <div className="demo-app">
        <aside className="demo-sidebar">
          <h1>Coachmarks Demo</h1>
          <ul>
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  className={s.id === activeId ? "active" : undefined}
                  onClick={() => setActiveId(s.id)}
                >
                  {s.label}
                </button>
              </li>
            ))}
          </ul>
          <label className="demo-theme-switcher">
            Theme:{" "}
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value as ThemeName)}
            >
              <option value="hazbot">hazbot</option>
              <option value="codap">codap</option>
            </select>
          </label>
        </aside>
        <main className="demo-main">{Active && <Active />}</main>
      </div>
    </ThemeProvider>
  );
}
