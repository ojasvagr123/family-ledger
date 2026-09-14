const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  {
    ignores: ['dist*/**', '.expo/**', 'android.codex-stale/**', 'node_modules.codex-*/**'],
  },
  ...expoConfig,
  {
    rules: {
      // TypeScript and Metro resolve the @ alias; the import resolver cannot safely
      // traverse the managed Windows user directory in this execution environment.
      'import/no-unresolved': 'off',
    },
  },
]);
