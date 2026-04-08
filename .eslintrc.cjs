/* eslint-env node */
module.exports = {
  root: true,
  env: { browser: true, es2022: true, node: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: [
    'dist',
    'coverage',
    'playwright-report',
    'test-results',
    'node_modules',
    // tsc -b emits .d.ts siblings for root config files (vite/vitest/playwright).
    // They're build artifacts, not source.
    '*.config.d.ts',
    'playwright.config.d.ts',
  ],
  parser: '@typescript-eslint/parser',
  plugins: ['react-refresh', '@typescript-eslint'],
  rules: {
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    '@typescript-eslint/consistent-type-imports': ['warn', { prefer: 'type-imports' }],
  },
  overrides: [
    {
      // Vitest unit + component tests use RTL.
      files: ['src/**/*.test.{ts,tsx}', 'tests/setup.ts', 'tests/msw/**/*.{ts,tsx}'],
      plugins: ['testing-library'],
      extends: ['plugin:testing-library/react'],
    },
    {
      // Playwright E2E specs use their own `@playwright/test` API, not RTL.
      files: ['tests/e2e/**/*.{ts,tsx}'],
      rules: {
        'testing-library/prefer-screen-queries': 'off',
      },
    },
  ],
};
