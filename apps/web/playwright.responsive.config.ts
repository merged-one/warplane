import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: /.*\.responsive\.spec\.ts/,
  outputDir: "test-results/playwright",
  timeout: 30_000,
  use: {
    baseURL: "http://127.0.0.1:4173",
    headless: true,
  },
  webServer: {
    command: "pnpm exec vite preview --host 127.0.0.1 --port 4173",
    cwd: ".",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
  },
});
