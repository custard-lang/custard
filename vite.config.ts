// Configure Vitest (https://vitest.dev/config/)

import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
    },
    server: {
      deps: {
        external: [
          // To prevent vitest converting `import.meta.resolve` to `__vite_ssr_import_meta_`
          /\/pkgs\/processor\//,
        ],
      },
    },
    exclude: [...configDefaults.exclude, "dist"],
    // testTimeout: 100,
  },
});
