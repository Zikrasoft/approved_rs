// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import astro from 'eslint-plugin-astro';
import eslintConfigPrettier from 'eslint-config-prettier';
import gitignore from 'eslint-config-flat-gitignore';
import globals from 'globals';

export default tseslint.config(
  gitignore(),
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...astro.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
      // Established codebase idiom: `try { localStorage.x } catch (e) {}` to
      // silently degrade when storage is unavailable (Safari private mode etc).
      'no-empty': ['error', { allowEmptyCatch: true }],
      // `cond && el.classList.add(...)` / `cond ? a() : b()` used as statements
      // throughout the client scripts instead of if/else — established style.
      '@typescript-eslint/no-unused-expressions': [
        'error',
        { allowShortCircuit: true, allowTernary: true },
      ],
    },
  },
  {
    // Astro's own scaffolding generates this reference; there's no import-style
    // equivalent that resolves ../.astro/types.d.ts the same way.
    files: ['**/env.d.ts'],
    rules: { '@typescript-eslint/triple-slash-reference': 'off' },
  },
  eslintConfigPrettier,
);
