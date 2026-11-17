import parser from '@typescript-eslint/parser';
import plugin from '@typescript-eslint/eslint-plugin';
import prettier from 'eslint-plugin-prettier';

export default [
  {
    files: ['{src,apps,libs,test}/**/*.ts'],
    languageOptions: {
      parser,
      sourceType: 'module',
    },
    plugins: {
      '@typescript-eslint': plugin,
      prettier,
    },
    rules: {
      ...plugin.configs.recommended.rules,
      'prettier/prettier': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { args: 'none' }],
      '@typescript-eslint/ban-types': 'off',
      '@typescript-eslint/no-empty-interface': 'off',
    },
  },
  {
    files: ['test/**/*.ts'],
    rules: {
      // supertest v7 is esm-first: the e2e spec requires it for CJS interop
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
];
