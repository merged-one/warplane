import { defineConfig } from "vitepress";

export default defineConfig({
  title: "Warplane",
  description: "Interchain Control Plane for Avalanche L1s",
  themeConfig: {
    nav: [
      { text: "Product", link: "/product/overview" },
      { text: "Architecture", link: "/architecture/overview" },
      { text: "Planning", link: "/planning/roadmap" },
      { text: "ADRs", link: "/decisions/" },
      { text: "API", link: "/api/" },
      { text: "CLI", link: "/cli/" },
      { text: "Runbooks", link: "/runbooks/local-dev" },
      { text: "AI", link: "/ai/" },
    ],
    sidebar: {
      "/product/": [
        {
          text: "Product",
          items: [
            { text: "Overview", link: "/product/overview" },
            { text: "Community Value", link: "/product/community-value" },
            { text: "Seeded Demo", link: "/product/seeded-demo" },
          ],
        },
      ],
      "/architecture/": [
        {
          text: "Architecture",
          items: [
            { text: "Overview", link: "/architecture/overview" },
            { text: "Trace Model", link: "/architecture/trace-model" },
            { text: "Trace Glossary", link: "/architecture/trace-glossary" },
            { text: "Domain Types", link: "/architecture/domain-types" },
          ],
        },
      ],
      "/planning/": [
        {
          text: "Planning",
          items: [
            { text: "Roadmap", link: "/planning/roadmap" },
            { text: "Status", link: "/planning/status" },
            { text: "Backlog", link: "/planning/backlog" },
            { text: "Risk Register", link: "/planning/risk-register" },
            { text: "Working Agreement", link: "/planning/working-agreement" },
          ],
        },
      ],
      "/decisions/": [
        {
          text: "Architecture Decisions",
          items: [
            { text: "Index", link: "/decisions/" },
            { text: "ADR-0001: Structured MADR", link: "/decisions/0001-use-structured-madr" },
            {
              text: "ADR-0002: Monorepo with TS + Go",
              link: "/decisions/0002-use-monorepo-with-ts-and-go",
            },
            {
              text: "ADR-0003: Fixture-First MVP",
              link: "/decisions/0003-fixture-first-day1-mvp",
            },
            {
              text: "ADR-0004: Zod Schema Source",
              link: "/decisions/0004-zod-single-schema-approach",
            },
          ],
        },
      ],
      "/api/": [
        {
          text: "API",
          items: [
            { text: "Overview", link: "/api/" },
            { text: "Endpoints", link: "/api/endpoints" },
          ],
        },
      ],
      "/cli/": [
        {
          text: "CLI",
          items: [
            { text: "Overview", link: "/cli/" },
            { text: "Commands", link: "/cli/commands" },
          ],
        },
      ],
      "/runbooks/": [
        {
          text: "Runbooks",
          items: [
            { text: "Local Development", link: "/runbooks/local-dev" },
            { text: "Troubleshooting", link: "/runbooks/troubleshooting" },
            { text: "Adding a Package", link: "/runbooks/add-package" },
          ],
        },
      ],
      "/ai/": [
        {
          text: "AI & Agents",
          items: [
            { text: "Overview", link: "/ai/" },
            { text: "AGENTS.md Guide", link: "/ai/agents-md" },
            { text: "Prompting Guide", link: "/ai/prompting-guide" },
            { text: "Repo Map", link: "/ai/repo-map" },
            { text: "MCP Server", link: "/ai/mcp-usage" },
            { text: "Repomix Packing", link: "/ai/repomix" },
            { text: "llms.txt", link: "/ai/llms-txt" },
          ],
        },
      ],
    },
    socialLinks: [{ icon: "github", link: "https://github.com/warplane" }],
    search: { provider: "local" },
  },
});
