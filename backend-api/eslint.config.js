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
    rules: {
      'no-console': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    files: ['src/**/*.ts'],
    ignores: ['src/modules/admin/**/*.ts', 'src/modules/auth/**/*.ts', 'scripts/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '**/integrations/firebase-admin*',
                '../integrations/firebase-admin*',
                '../../integrations/firebase-admin*',
              ],
              message:
                'Direct Firebase Admin auth helpers may only be imported in modules/admin, modules/auth, or scripts.',
            },
          ],
        },
      ],
    },
  },
  {
    ignores: ['dist/**', 'coverage/**'],
  },
);
