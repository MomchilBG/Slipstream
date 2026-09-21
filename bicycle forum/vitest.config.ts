import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// Separate from vite.config.ts (rather than merged in) so the app build
// never pulls in vitest/jsdom - this file's `test` block is only read by
// the vitest CLI, and its own React plugin instance skips the Babel
// react-compiler pass vite.config.ts adds, which isn't needed to run tests.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
  },
})
