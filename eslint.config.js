import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/dist-node/**',
      '**/node_modules/**',
      '**/.wrangler/**',
      '**/coverage/**',
      'test/e2e/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Loading data on mount with a loading flag is idiomatic; this rule
      // (react-hooks v7) objects to the synchronous setState in that pattern.
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // Node scripts (tooling + integration harness): declare Node globals.
    files: ['**/*.mjs'],
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
        Buffer: 'readonly',
        fetch: 'readonly',
      },
    },
  },
);
