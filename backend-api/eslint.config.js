import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
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
              group: ['**/integrations/supabase-admin*', '../integrations/supabase-admin*', '../../integrations/supabase-admin*'],
              message: 'supabase-admin.ts may only be imported in modules/admin, modules/auth, or scripts.',
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
