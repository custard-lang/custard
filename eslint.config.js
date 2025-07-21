import * as os from "node:os";
import * as path from "node:path";

import globals from "globals";

import parser from "@typescript-eslint/parser";
import tseslint from 'typescript-eslint';
import love from 'eslint-config-love'
import promise from "eslint-plugin-promise";
import noIgnoreReturnedUnion from "eslint-plugin-no-ignore-returned-union";

const baseDirectory = dirOfImportMetaUrl(import.meta.url)

export default tseslint.config(
  {
    ignores: [
      "**/*.d.ts",
      "**/*.js",
      "**/node_modules/",
      "**/*.mjs",
    ],
  },
  promise.configs['flat/recommended'],
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
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
  },
  {
    ...love,
    files: ["**/*.ts"],
    plugins: {
      "@typescript-eslint": tseslint.plugin,
      promise,
      "eslint-plugin-no-ignore-returned-union": noIgnoreReturnedUnion,
    },
    rules: {
      "import/no-unresolved": "off",
      "eslint-plugin-no-ignore-returned-union/no-ignore-returned-union": "error",
      "no-console": "error",
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
      "@typescript-eslint/explicit-function-return-type": ["error", {
        allowConciseArrowFunctionExpressionsStartingWithVoid: true,
        allowDirectConstAssertionInArrowFunctions: true,
        allowExpressions: false,
        allowFunctionsWithoutTypeParameters: false,
        allowHigherOrderFunctions: false,
        allowIIFEs: true,
        allowTypedFunctionExpressions: true,
      }],
      "@typescript-eslint/consistent-indexed-object-style": ["error", "index-signature"],
      "@typescript-eslint/strict-boolean-expressions": ["error", {
        allowNullableBoolean: true,
        allowNullableString: true,
        allowNullableObject: true,
      }],
      "@typescript-eslint/restrict-template-expressions": ["error", {
        allowBoolean: true,
        allowNumber: true,
      }],
      "@typescript-eslint/array-type": ["error", {
        default: "array-simple",
        readonly: "array-simple",
      }],
      "@typescript-eslint/return-await": "error",
      "@typescript-eslint/no-unnecessary-condition": ["error", {
        allowConstantLoopConditions: true,
        checkTypePredicates: false,
      }],
    },
  },
  {
    files: ["*.test.[jt]s"],
    rules: {
      "@typescript-eslint/no-null-assertion": "off",
      "eslint-plugin-no-ignore-returned-union/no-ignore-returned-union": "off",
    },
  },
);

function fileOfImportMetaUrl(importMetaUrl) {
  return dropLeadingSlashOnWindows(new URL(importMetaUrl).pathname);
}

function dirOfImportMetaUrl(importMetaUrl) {
  return path.dirname(fileOfImportMetaUrl(importMetaUrl));
}

function dropLeadingSlashOnWindows(pathname) {
  return os.platform() === "win32" ? pathname.slice(1) : pathname;
}
