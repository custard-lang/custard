/// <reference types="vitest" />

// Configure Vitest (https://vitest.dev/config/)

import { defineConfig } from "vite";

export default defineConfig({
  test: {
    coverage: {
      // I'd find the problem as soon as I run tests with coverage
      // if this was really a type error!
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      provider: "c8",
      reporter: ["text", "json", "html"],
    },
  },
});
