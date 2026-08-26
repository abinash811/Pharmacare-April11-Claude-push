// jest-dom adds custom matchers like toBeInTheDocument, toHaveClass, etc.
import '@testing-library/jest-dom';

// jsdom doesn't provide these Node globals, but react-router v7 needs them
// at import time — without this, any test that imports react-router-dom
// (even transitively, via a shared component) fails with
// "TextEncoder is not defined" before a single test body runs.
import { TextEncoder, TextDecoder } from 'util';
Object.assign(globalThis, { TextEncoder, TextDecoder });

// jsdom doesn't implement ResizeObserver, but Radix's Popover/Command
// (used by SuggestField, and anything built on cmdk) calls it on mount —
// without this, any test rendering one of those fails with
// "ResizeObserver is not defined" before a single assertion runs.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
Object.assign(globalThis, { ResizeObserver: ResizeObserverStub });
