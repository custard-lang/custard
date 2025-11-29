// Configure Vitest (https://vitest.dev/config/)

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/*.test.ts"],
    coverage: {
      reporter: ["text", "json", "html"],
    },
    // testTimeout: 100,
  },
});
