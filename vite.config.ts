// Configure Vitest (https://vitest.dev/config/)

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
    },
    server: {
      deps: {
        external: [
          /\/node_modules\//,
          // To prevent vitest converting `import.meta.resolve` to `__vite_ssr_import_meta_`
          /\/packages\/processor\//,
        ],
      },
    },
    // testTimeout: 100,
  },
});
