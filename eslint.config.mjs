import js from '@eslint/js';
import globals from 'globals';
export default [
  { ignores: ['src/generated/**', '.local-backup/**', 'node_modules/**', 'dist/**'] },
  js.configs.recommended,
  { files: ['**/*.js', '**/*.cjs', '**/*.mjs'], languageOptions: { globals: { ...globals.node, ...globals.browser } }, rules: {
    'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none', varsIgnorePattern: '^_' }],
    'no-empty': ['error', { allowEmptyCatch: true }],
    'no-useless-escape': 'off'
  } }
];
