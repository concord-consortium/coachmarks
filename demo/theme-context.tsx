import { type ReactNode, createContext, useContext, useMemo } from "react";
import type { CreateCoachmarksEngineArgs } from "../src";
import type { ThemeName } from "./theme-loader";

type EngineDefaults = Pick<CreateCoachmarksEngineArgs, "arrow" | "closeIcon">;

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
    // visually connects with the border at the same thickness.
    return { arrow: { strokeWidth: 3 } };
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
