import { defineConfig } from "vitepress";

export default defineConfig({
  title: "Warplane",
  description: "Interchain Control Plane for Avalanche L1s",
  themeConfig: {
    nav: [{ text: "Home", link: "/" }],
    sidebar: [
      {
        text: "Getting Started",
        items: [{ text: "Introduction", link: "/" }],
      },
    ],
  },
});
