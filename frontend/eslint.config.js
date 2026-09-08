// ESLint v9 flat config
// Used by `npm run lint`; NOT used during webpack build (DISABLE_ESLINT_PLUGIN=true in .env.local)
const js            = require('@eslint/js');
const globals       = require('globals');
const reactPlugin   = require('eslint-plugin-react');
const reactHooks    = require('eslint-plugin-react-hooks');
const jsxA11y       = require('eslint-plugin-jsx-a11y');
const tsParser      = require('@typescript-eslint/parser');
const tsPlugin      = require('@typescript-eslint/eslint-plugin');

module.exports = [
  // Base JS rules
  js.configs.recommended,

  {
    files: ['src/**/*.{js,jsx,ts,tsx}'],

    plugins: {
      react:        reactPlugin,
      'react-hooks': reactHooks,
      'jsx-a11y':   jsxA11y,
    },

    languageOptions: {
      // @typescript-eslint/parser handles .ts/.tsx AND plain .js/.jsx (it's a
      // superset of the default parser), so one parser covers all four extensions.
      // Without this, .ts/.tsx files failed to parse at all (e.g. "Unexpected
      // token interface") and were silently skipped by lint.
      parser: tsParser,
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
      // set-state-in-effect ships as 'error' in the plugin's recommended
      // set (React Compiler-era rules, added when eslint-plugin-react-hooks
      // was bumped to v7). It's a real anti-pattern worth fixing (7 known
      // instances as of August 2026, see docs/11_TESTING.md), but downgraded
      // to warn for the same reason exhaustive-deps is above — surface it,
      // don't let a pre-existing, unaudited backlog block every unrelated CI run.
      'react-hooks/set-state-in-effect': 'warn',
      // Same story as set-state-in-effect just above — both ship 'error' in
      // the v7 recommended set, both are real, unaudited findings (12
      // instances combined as of August 2026), neither is "the app is
      // broken right now."
      'react-hooks/immutability': 'warn',
      'react-hooks/static-components': 'warn',

      // jsx-a11y — installed since the project's start but never actually
      // wired into a config until now (found Sep 2026 auditing why 9 real
      // keyboard-access bugs shipped with the dependency sitting unused).
      // Real AST-based checks, not grep — catches exactly the class of bug
      // design-guard.sh's Rule 11 tried and failed to catch reliably
      // (a clickable <div>/<tr> with no keyboard handler), with none of
      // that rule's false positives on container elements. Starts at
      // 'warn' pending a full-repo baseline pass, same precedent as the
      // react-hooks rules above.
      ...jsxA11y.configs.recommended.rules,
      'jsx-a11y/click-events-have-key-events': 'warn',
      'jsx-a11y/no-static-element-interactions': 'warn',
      'jsx-a11y/no-noninteractive-element-interactions': 'warn',
      // Real, pre-existing gap: 88 <label> elements across 8 files (Settings,
      // Suppliers, Team, Users) aren't linked to their input via htmlFor/id
      // or nesting. Same precedent as react-hooks above — surface it via
      // `npm run lint` output, don't let an unaudited backlog block CI.
      // Logged in docs/15_ROADMAP.md RULE MISSES LOG; fix the 88 instances
      // in a dedicated pass, then flip this back to 'error'.
      'jsx-a11y/label-has-associated-control': 'warn',
      // Real, pre-existing pattern: 3 modal/panel inputs use autoFocus so
      // typing starts immediately on open (PatientCombobox, PatientSearchModal,
      // BarcodeScannerModal). Intentional UX, but a real accessibility trade-off
      // (unexpected focus jump for screen-reader users) that was never reviewed
      // against that lens. Same precedent as above — warn, don't block, revisit
      // deliberately rather than silently keep or silently strip autoFocus.
      'jsx-a11y/no-autofocus': 'warn',

      // React
      'react/jsx-uses-react':   'off',   // not needed with React 17+ JSX transform
      'react/react-in-jsx-scope': 'off',
      // Without this, no-unused-vars can't see that <AppButton /> "uses" the
      // AppButton import — every JSX-only import was flagged as unused.
      'react/jsx-uses-vars': 'error',

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

  // src/lib/axios.{js,ts} is the canonical wrapper the "no raw axios import"
  // rule above tells everyone else to use instead — it has to import the
  // real `axios` package itself to build that wrapper. The rule's selector
  // matches any file importing default from 'axios', with no exception for
  // its own canonical implementation; this is that exception.
  {
    files: ['src/lib/axios.{js,ts}'],
    rules: { 'no-restricted-syntax': 'off' },
  },

  // PrintReceipt.jsx renders literal thermal/A4 print output — borders and
  // text need exact black/white values for print fidelity, not brand
  // tokens meant for on-screen UI. The hardcoded-hex rules above exist to
  // stop screen-UI color drift; they don't apply to what a physical
  // receipt printer renders.
  {
    files: ['src/pages/BillingWorkspace/components/PrintReceipt.jsx'],
    rules: { 'no-restricted-syntax': 'off' },
  },

  // Shadcn/UI primitives (src/components/ui/**) are thin wrappers that spread
  // `{...props}` onto a native element (e.g. AlertTitle -> <h5 {...props} />,
  // PaginationLink -> <a {...props} />) — real content always arrives from
  // the call site via that spread, but jsx-a11y's static AST check can't see
  // through it and flags the wrapper itself as empty. Confirmed false
  // positive on both files it fired on (alert.jsx, pagination.jsx); disabling
  // for the whole folder since every primitive here follows the same pattern.
  {
    files: ['src/components/ui/**/*.{js,jsx,ts,tsx}'],
    rules: {
      'jsx-a11y/heading-has-content': 'off',
      'jsx-a11y/anchor-has-content': 'off',
    },
  },

  // TypeScript files: the core no-unused-vars rule doesn't understand TS-only
  // syntax (interface properties, type-only imports) and misreads them as
  // unused variables (e.g. flagging `value: string;` inside an interface).
  // Swap in the TS-aware version, same options, for .ts/.tsx only.
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { varsIgnorePattern: '^_', argsIgnorePattern: '^_' }],
    },
  },

  // Test files also need Jest's globals (describe/it/expect/beforeEach/…),
  // which aren't part of globals.browser — without this every test file
  // failed lint with "'describe' is not defined" etc.
  {
    files: ['src/**/*.test.{js,jsx,ts,tsx}', 'src/setupTests.js'],
    languageOptions: {
      globals: { ...globals.jest },
    },
    // jsx-a11y checks real accessibility of shipped UI. Test files render
    // throwaway mock markup to exercise component logic (e.g. a fake
    // interactive row with role="button" that isn't meant to be a real,
    // fully-accessible element) — those aren't UI regressions.
    rules: {
      'jsx-a11y/interactive-supports-focus': 'off',
    },
  },

  // Ignore build output and config files
  {
    ignores: ['build/**', 'node_modules/**', 'public/**', '*.config.js'],
  },
];
