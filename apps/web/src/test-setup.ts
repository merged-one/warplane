import "@testing-library/jest-dom/vitest";

function getWidth() {
  return typeof window.innerWidth === "number" ? window.innerWidth : 1024;
}

function matchMedia(query: string): MediaQueryList {
  const maxWidth = /max-width:\s*(\d+)px/.exec(query);
  const minWidth = /min-width:\s*(\d+)px/.exec(query);
  const width = getWidth();

  const matches =
    (maxWidth ? width <= Number(maxWidth[1]) : true) &&
    (minWidth ? width >= Number(minWidth[1]) : true);

  return {
    matches,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => true,
  };
}

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: matchMedia,
});
