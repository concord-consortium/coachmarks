// Provide a default matchMedia stub so hooks (e.g. useReducedMotion) work in jsdom.
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => true,
    }) as unknown as MediaQueryList;
}

// Provide scrollIntoView (jsdom omits it).
if (
  typeof window !== "undefined" &&
  // biome-ignore lint/suspicious/noExplicitAny: jsdom prototype patching.
  !(HTMLElement.prototype as any).scrollIntoView
) {
  // biome-ignore lint/suspicious/noExplicitAny: jsdom prototype patching.
  (HTMLElement.prototype as any).scrollIntoView = () => {};
}
