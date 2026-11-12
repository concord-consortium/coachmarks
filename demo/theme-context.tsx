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
    // CODAP's close-tile icon: the theme's hover rule recolors the path with a fill attribute.
    return {
      arrow: { strokeWidth: 1 },
      closeIcon: (
        <svg
          className="coachmarks-popover-close-icon"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
        >
          <g fill="none">
            <path d="M0 0h24v24H0z" />
            <path
              d="M12 2c1.383 0 2.683.263 3.9.788a10.099 10.099 0 0 1 3.175 2.137c.9.9 1.613 1.958 2.137 3.175A9.738 9.738 0 0 1 22 12a9.738 9.738 0 0 1-.788 3.9 10.099 10.099 0 0 1-2.137 3.175c-.9.9-1.958 1.613-3.175 2.137A9.738 9.738 0 0 1 12 22a9.738 9.738 0 0 1-3.9-.788 10.099 10.099 0 0 1-3.175-2.137c-.9-.9-1.612-1.958-2.137-3.175A9.738 9.738 0 0 1 2 12c0-1.383.263-2.683.788-3.9a10.099 10.099 0 0 1 2.137-3.175c.9-.9 1.958-1.612 3.175-2.137A9.738 9.738 0 0 1 12 2zm0 2c-2.233 0-4.125.775-5.675 2.325C4.775 7.875 4 9.767 4 12c0 2.233.775 4.125 2.325 5.675C7.875 19.225 9.767 20 12 20c2.233 0 4.125-.775 5.675-2.325C19.225 16.125 20 14.233 20 12c0-2.233-.775-4.125-2.325-5.675C16.125 4.775 14.233 4 12 4zm3.6 3L17 8.4 13.4 12l3.6 3.6-1.4 1.4-3.6-3.6L8.4 17 7 15.6l3.6-3.6L7 8.4 8.4 7l3.6 3.6L15.6 7z"
              fill="#006C8E"
            />
          </g>
        </svg>
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
