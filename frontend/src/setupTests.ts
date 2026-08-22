// jest-dom adds custom matchers like toBeInTheDocument, toHaveClass, etc.
import '@testing-library/jest-dom';

// jsdom doesn't provide these Node globals, but react-router v7 needs them
// at import time — without this, any test that imports react-router-dom
// (even transitively, via a shared component) fails with
// "TextEncoder is not defined" before a single test body runs.
import { TextEncoder, TextDecoder } from 'util';
Object.assign(globalThis, { TextEncoder, TextDecoder });
