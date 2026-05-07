let activeStylesheet: HTMLLinkElement | null = null;

export type ThemeName = "hazbot" | "codap";

export async function loadTheme(name: ThemeName) {
  if (activeStylesheet) activeStylesheet.remove();
  const url =
    name === "hazbot"
      ? (await import("../src/styles/hazbot.css?url")).default
      : (await import("../src/styles/codap.css?url")).default;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = url;
  document.head.appendChild(link);
  activeStylesheet = link;
}
