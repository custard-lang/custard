import * as os from "node:os";
import * as path from "node:path";

import globals from "globals";

import { FlatCompat } from "@eslint/eslintrc";

import parser from "@typescript-eslint/parser";
import typeScriptEslint from "@typescript-eslint/eslint-plugin";
import promise from "eslint-plugin-promise";
import noIgnoreReturnedUnion from "eslint-plugin-no-ignore-returned-union";

const baseDirectory = dirOfImportMetaUrl(import.meta.url)

const compat = new FlatCompat({ baseDirectory });

export default [
  {
    ignores: [
      "**/*.d.ts",
      "**/*.js",
      "**/node_modules/",
      "**/*.mjs",
    ],
  },
  ...compat.extends(
    "plugin:promise/recommended",
    "love",
  ),
  {
    files: ["*.ts"],
    languageOptions: {
      globals: {
        ...globals.builtin,
        ...globals.browser,
        ...globals.es2021,
        ...globals.node,
      },
      parser,
      parserOptions: {
        tsconfigRootDir: baseDirectory,
        project: ["./tsconfig.json"],
        sourceType: "module",
        extraFileExtensions: [],
      },
    },
    plugins: {
      "@typescript-eslint": typeScriptEslint,
      promise,
      "eslint-plugin-no-ignore-returned-union": noIgnoreReturnedUnion,
    },
    rules: {
      "import/no-unresolved": "off",
      "eslint-plugin-no-ignore-returned-union/no-ignore-returned-union": "error",
      "@typescript-eslint/no-namespace": "off",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/no-floating-promises": [
        "error",
        {
          ignoreIIFE: true,
        },
      ],
      "@typescript-eslint/no-redundant-type-constituents": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          "argsIgnorePattern": "^_",
          "varsIgnorePattern": "^_",
          "caughtErrorsIgnorePattern": "^_",
          "destructuredArrayIgnorePattern": "^_"
        },
      ],

      // Disable rules related to style, which is enforced by prettier
      "@typescript-eslint/comma-dangle": "off",
      "@typescript-eslint/comma-spacing": "off",
      "@typescript-eslint/indent": "off",
      "@typescript-eslint/keyword-spacing": "off",
      "@typescript-eslint/object-curly-spacing": "off",
      "@typescript-eslint/quotes": "off",
      "@typescript-eslint/semi": "off",
      "@typescript-eslint/space-before-function-paren": "off",
      "@typescript-eslint/space-infix-ops": "off",
      "@typescript-eslint/member-delimiter-style": "off",
    },
  },
  {
    files: ["*.test.[jt]s"],
    rules: {
      "@typescript-eslint/no-null-assertion": "off",
      "eslint-plugin-no-ignore-returned-union/no-ignore-returned-union": "off",
    },
  },
];

function fileOfImportMetaUrl(importMetaUrl) {
  return dropLeadingSlashOnWindows(new URL(importMetaUrl).pathname);
}

function dirOfImportMetaUrl(importMetaUrl) {
  return path.dirname(fileOfImportMetaUrl(importMetaUrl));
}

function dropLeadingSlashOnWindows(pathname) {
  return os.platform() === "win32" ? pathname.slice(1) : pathname;
}
