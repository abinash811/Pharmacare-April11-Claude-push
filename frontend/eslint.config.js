// ESLint v9 flat config
// Used by `npm run lint`; NOT used during webpack build (DISABLE_ESLINT_PLUGIN=true in .env.local)
const js            = require('@eslint/js');
const globals       = require('globals');
const reactPlugin   = require('eslint-plugin-react');
const reactHooks    = require('eslint-plugin-react-hooks');

module.exports = [
  // Base JS rules
  js.configs.recommended,

  {
    files: ['src/**/*.{js,jsx,ts,tsx}'],

    plugins: {
      react:        reactPlugin,
      'react-hooks': reactHooks,
    },

    languageOptions: {
      ecmaVersion: 'latest',
      sourceType:  'module',
      globals: {
        ...globals.browser,
        ...globals.es2021,
        process: 'readonly',
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },

    settings: {
      react: { version: 'detect' },
    },

    rules: {
      // React Hooks — warn only (not error) so CI doesn't block on missing deps
      ...reactHooks.configs.recommended.rules,
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/rules-of-hooks':  'error',

      // React
      'react/jsx-uses-react':   'off',   // not needed with React 17+ JSX transform
      'react/react-in-jsx-scope': 'off',

      // General — turn off noisy rules that CRA normally ignores
      'no-unused-vars': ['warn', { varsIgnorePattern: '^_', argsIgnorePattern: '^_' }],
      'no-console':     'off',
    },
  },

  // Ignore build output and config files
  {
    ignores: ['build/**', 'node_modules/**', 'public/**', '*.config.js'],
  },
];
