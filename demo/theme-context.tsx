import { type ReactNode, createContext, useContext, useMemo } from "react";
import type { CreateCoachmarksEngineArgs } from "../src";
import type { ThemeName } from "./theme-loader";

type EngineDefaults = Pick<
  CreateCoachmarksEngineArgs,
  "arrow" | "closeIcon" | "popoverOffset"
>;

const ThemeContext = createContext<{
  theme: ThemeName;
  engineDefaults: EngineDefaults;
}>({
  theme: "hazbot",
  engineDefaults: {},
});

function defaultsFor(theme: ThemeName): EngineDefaults {
  if (theme === "hazbot") {
    // Hazbot's popover has a 3px border; match the arrow stroke so the tail
    // visually connects with the border at the same thickness. Width/height
    // are sized up from FloatingArrow's 14×7 default to match the AP-64
    // callout-tail spec — a prominent downward-pointing V. popoverOffset
    // bumps the default 10px gap to 30px so the larger arrow + halo doesn't
    // crowd the anchor — applies engine-wide so call sites don't need to
    // set anchorOffset per popover.
    return {
      arrow: { width: 28, height: 16, strokeWidth: 3 },
      popoverOffset: 30,
    };
  }
  if (theme === "codap") {
    // CODAP's tour plugin uses the multiplication-sign character for its close button.
    return {
      arrow: { strokeWidth: 1 },
      closeIcon: (
        <span className="coachmarks-popover-close-icon" aria-hidden="true">
          ×
        </span>
      ),
    };
  }
  return {};
}

export function ThemeProvider({
  theme,
  children,
}: {
  theme: ThemeName;
  children: ReactNode;
}) {
  const value = useMemo(
    () => ({ theme, engineDefaults: defaultsFor(theme) }),
    [theme],
  );
  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useEngineDefaults(): EngineDefaults {
  return useContext(ThemeContext).engineDefaults;
}
