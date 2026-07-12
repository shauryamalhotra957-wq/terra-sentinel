import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: process.env.GITHUB_REPOSITORY?.endsWith('/terra-sentinel') ? '/terra-sentinel/' : '/',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
    coverage: {
      reporter: ['text', 'html'],
      thresholds: {
        branches: 70,
        functions: 75,
        lines: 78,
        statements: 78,
      },
    },
  },
})
