// craco.config.js
const path = require("path");
require("dotenv").config();

// Environment variable overrides
const config = {
  disableHotReload: process.env.DISABLE_HOT_RELOAD === "true",
  enableVisualEdits: process.env.REACT_APP_ENABLE_VISUAL_EDITS === "true",
  enableHealthCheck: process.env.ENABLE_HEALTH_CHECK === "true",
};

// Conditionally load visual editing modules only if enabled
let babelMetadataPlugin;
let setupDevServer;

if (config.enableVisualEdits) {
  babelMetadataPlugin = require("./plugins/visual-edits/babel-metadata-plugin");
  setupDevServer = require("./plugins/visual-edits/dev-server-setup");
}

// Conditionally load health check modules only if enabled
let WebpackHealthPlugin;
let setupHealthEndpoints;
let healthPluginInstance;

if (config.enableHealthCheck) {
  WebpackHealthPlugin = require("./plugins/health-check/webpack-health-plugin");
  setupHealthEndpoints = require("./plugins/health-check/health-endpoints");
  healthPluginInstance = new WebpackHealthPlugin();
}

const webpackConfig = {
  webpack: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
    configure: (webpackConfig) => {

      // The dev-server's live ESLint overlay checks the whole app, not just
      // changed lines — with the repo's pre-existing lint debt (see
      // scripts/eslint_changed_lines.py and docs/20_CODE_QUALITY.md), that
      // means an unrelated pre-existing warning anywhere blocks the entire
      // page behind a full-screen overlay. Real enforcement already happens
      // at the pre-commit hook and in CI (changed-lines only); this plugin
      // only duplicates that check, badly. Remove it unconditionally so a
      // fresh clone or container never needs a local .env.local to work.
      webpackConfig.plugins = webpackConfig.plugins.filter(plugin => {
        return plugin.constructor.name !== 'ESLintWebpackPlugin';
      });

      // Disable hot reload completely if environment variable is set
      if (config.disableHotReload) {
        // Remove hot reload related plugins
        webpackConfig.plugins = webpackConfig.plugins.filter(plugin => {
          return !(plugin.constructor.name === 'HotModuleReplacementPlugin');
        });

        // Disable watch mode
        webpackConfig.watch = false;
        webpackConfig.watchOptions = {
          ignored: /.*/, // Ignore all files
        };
      } else {
        // Add ignored patterns to reduce watched directories
        webpackConfig.watchOptions = {
          ...webpackConfig.watchOptions,
          ignored: [
            '**/node_modules/**',
            '**/.git/**',
            '**/build/**',
            '**/dist/**',
            '**/coverage/**',
            '**/public/**',
          ],
        };
      }

      // Add health check plugin to webpack if enabled
      if (config.enableHealthCheck && healthPluginInstance) {
        webpackConfig.plugins.push(healthPluginInstance);
      }

      return webpackConfig;
    },
  },
};

// Only add babel plugin if visual editing is enabled
if (config.enableVisualEdits) {
  webpackConfig.babel = {
    plugins: [babelMetadataPlugin],
  };
}

// Proxy /api to the backend from the dev server itself (not the browser
// directly) — remote/hosted dev environments often only forward the
// frontend's port to the browser, not the backend's, so a browser-side
// call straight to REACT_APP_BACKEND_URL fails with "could not reach the
// server" there even though the backend is fine. Routing through the same
// origin the browser already has access to works in every environment.
const backendTarget = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
webpackConfig.devServer = (devServerConfig) => {
  devServerConfig.proxy = [
    {
      context: ['/api'],
      target: backendTarget,
      // logged, not silently swallowed into a bare 500 — a proxy-layer
      // failure (as opposed to the backend itself erroring) should say so.
      onError: (err, req, res) => {
        console.error('[proxy] /api request failed:', req.method, req.url, err.message);
        if (!res.headersSent) {
          res.writeHead(502, { 'Content-Type': 'application/json' });
        }
        res.end(JSON.stringify({ detail: `Proxy error reaching backend: ${err.message}` }));
      },
    },
  ];

  // Apply visual edits dev server setup if enabled
  if (config.enableVisualEdits && setupDevServer) {
    devServerConfig = setupDevServer(devServerConfig);
  }

  // Add health check endpoints if enabled
  if (config.enableHealthCheck && setupHealthEndpoints && healthPluginInstance) {
    const originalSetupMiddlewares = devServerConfig.setupMiddlewares;

    devServerConfig.setupMiddlewares = (middlewares, devServer) => {
      // Call original setup if exists
      if (originalSetupMiddlewares) {
        middlewares = originalSetupMiddlewares(middlewares, devServer);
      }

      // Setup health endpoints
      setupHealthEndpoints(devServer, healthPluginInstance);

      return middlewares;
    };
  }

  return devServerConfig;
};

module.exports = webpackConfig;
