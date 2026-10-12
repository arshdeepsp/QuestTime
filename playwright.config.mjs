import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests",
  timeout: 60000,
  fullyParallel: true,
  /* A test that fails only because the machine is busy (a full parallel run on a laptop) passes on the retry and is
     reported as "flaky" instead of failing the run; a real failure fails both tries. */
  retries: 1,
  reporter: [["list"]],
  use: { browserName: "chromium", timezoneId: "America/Toronto", serviceWorkers: "block" },
  webServer: { command: "node tests/serve.mjs", url: "http://127.0.0.1:4173/index.html", reuseExistingServer: true }
});
