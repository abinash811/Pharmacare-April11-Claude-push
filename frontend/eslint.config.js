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

      // ── PharmaCare design system enforcement ──────────────────────────
      // These rules prevent design regressions from being committed.
      'no-restricted-syntax': [
        'error',
        // Ban raw axios import outside lib/axios
        {
          selector: "ImportDeclaration[source.value='axios'] ImportDefaultSpecifier",
          message:  "Use `import api from '@/lib/axios'` — never import axios directly. See PHARMACARE_DESIGN_SKILL.md.",
        },
        // Ban window.confirm — use Shadcn ConfirmDialog instead
        {
          selector: "CallExpression[callee.object.name='window'][callee.property.name='confirm']",
          message:  "Use <ConfirmDialog> from '@/components/shared' — never window.confirm(). See PHARMACARE_DESIGN_SKILL.md.",
        },
        // Ban teal color classes
        {
          selector: "Literal[value=/\\bteal-[3-9]\\b/]",
          message:  "Teal colors are banned. Use Steel Blue classes (bg-brand, text-brand). See PHARMACARE_DESIGN_SKILL.md.",
        },
        // Ban dark text on blue button — the most common color accident
        // Catches: className="... bg-brand ... text-gray-900 ..."
        {
          selector: "Literal[value=/\\bbg-brand\\b.*\\btext-gray-900\\b/]",
          message:  "Dark text on brand background. Use `text-white` on `bg-brand` buttons. See PHARMACARE_DESIGN_SKILL.md.",
        },
        {
          selector: "Literal[value=/\\btext-gray-900\\b.*\\bbg-brand\\b/]",
          message:  "Dark text on brand background. Use `text-white` on `bg-brand` buttons. See PHARMACARE_DESIGN_SKILL.md.",
        },
        // Ban raw <button> for primary actions — prefer AppButton from @/components/shared
        // (warn only — catches new code without breaking existing patterns immediately)

        // ── Hardcoded hex color enforcement (design system) ───────────────
        // These three rules together eliminate all three vectors for hex creep:
        //   1. Tailwind arbitrary values:  bg-[#F8FAFB]
        //   2. Inline style props:         style={{ color: '#4682B4' }}
        //   3. SVG / Recharts attributes:  stroke="#9ca3af"
        //
        // Add tokens to tailwind.config.js or import from @/utils/chartColors.
        // Use `eslint-disable-next-line no-restricted-syntax` with a reason comment
        // for genuine third-party brand colors (e.g. Google logo).

        // 1. Tailwind arbitrary hex: bg-[#xxx], text-[#xxx], border-[#xxx] …
        {
          selector: "Literal[value=/[a-z]+-\\[#[0-9a-fA-F]{3,8}\\]/]",
          message:
            "Hardcoded hex in Tailwind class (e.g. bg-[#F8FAFB]). Add a token to tailwind.config.js and use it instead.",
        },
        // 2. Hex in style={} JSX props
        {
          selector: "JSXAttribute[name.name='style'] Literal[value=/^#[0-9a-fA-F]{3,8}$/i]",
          message:
            "Hardcoded hex color in style prop. Use a Tailwind class with a design token instead.",
        },
        // 3. Hex in SVG / Recharts JSX attributes (stroke=, fill=, stopColor=)
        {
          selector: "JSXAttribute[name.name=/^(stroke|fill|stopColor)$/] Literal[value=/^#[0-9a-fA-F]{3,8}$/i]",
          message:
            "Hardcoded hex in SVG/chart attribute. Import from '@/utils/chartColors' instead.",
        },
      ],
    },
  },

  // Ignore build output and config files
  {
    ignores: ['build/**', 'node_modules/**', 'public/**', '*.config.js'],
  },
];
