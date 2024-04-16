/// <reference types="vitest" />

// Configure Vitest (https://vitest.dev/config/)

import { defineConfig } from "vite";

export default defineConfig({
  test: {
    include: ["test/*.test.ts"],
    coverage: {
      reporter: ["text", "json", "html"],
    },
    // testTimeout: 100,
  },
});
