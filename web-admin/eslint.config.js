import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      'no-restricted-syntax': [
        'error',
        {
          selector: "Literal[value=/\\b(ml|mr|pl|pr|left|right)-|\\btext-(left|right)\\b/]",
          message:
            'Use RTL-safe Tailwind logical utilities (ms/me/ps/pe/start/end/text-start/text-end).',
        },
      ],
    },
  },
  {
    files: ['app/**/*.ts', 'app/**/*.tsx', 'components/**/*.ts', 'components/**/*.tsx'],
    ignores: ['app/tokens.css'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "Literal[value=/\\b(ml|mr|pl|pr|left|right)-|\\btext-(left|right)\\b/]",
          message:
            'Use RTL-safe Tailwind logical utilities (ms/me/ps/pe/start/end/text-start/text-end).',
        },
        {
          selector: "Literal[value=/#[0-9A-Fa-f]{3,8}\\b/]",
          message: 'Do not use raw hex colors outside token files (app/tokens.css).',
        },
      ],
    },
  },
  {
    ignores: ['.next/**', 'out/**', 'playwright-report/**'],
  },
);
