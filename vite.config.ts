/// <reference types="vitest" />

// Configure Vitest (https://vitest.dev/config/)

import { defineConfig } from "vite";

export default defineConfig({
  test: {
    coverage: {
      provider: "c8",
      reporter: ["text", "json", "html"],
    },
  },
});
