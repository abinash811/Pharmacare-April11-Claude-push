// Lighthouse CI config — runs in CI's "Lighthouse" job (.github/workflows/ci.yml)
// against a real production build (`npm run build` + `serve -s`), not the dev
// server, since the dev server's unminified bundle gives a misleadingly bad
// performance score.
//
// Only audits /login: it's the one page every visitor reaches with zero auth
// state, so it's the only page a static Lighthouse run can hit without a
// puppeteerScript to log in first. Auditing authenticated pages (Dashboard,
// Billing) is real follow-up work, not done here — flagged in
// docs/19_PERFORMANCE.md, not silently skipped.
//
// Thresholds below are the REAL measured baseline (see docs/19_PERFORMANCE.md
// LIGHTHOUSE CI section), not the aspirational "≥ 90 on every category" target
// already documented there — same ratchet approach this repo already uses for
// eslint's --max-warnings (docs/11_TESTING.md CI STATUS): starting the gate at
// the honest current score, not a number that fails on day one. Raise these as
// the app actually gets faster/more accessible, don't lower them to match a
// regression.
module.exports = {
  ci: {
    collect: {
      startServerCommand: 'npx serve -s build -l 4173',
      startServerReadyPattern: 'Accepting connections',
      startServerReadyTimeout: 30000,
      url: ['http://localhost:4173/login'],
      numberOfRuns: 3,
      settings: {
        chromeFlags: '--no-sandbox --headless=new',
      },
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.5 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['error', { minScore: 0.9 }],
        'categories:seo': ['error', { minScore: 0.85 }],
      },
    },
    upload: {
      target: 'filesystem',
      outputDir: './.lighthouseci',
    },
  },
};
