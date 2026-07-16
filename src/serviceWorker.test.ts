import { describe, expect, it } from 'vitest'
import { serviceWorkerScriptUrl } from './serviceWorker'

describe('serviceWorkerScriptUrl', () => {
  it('keeps the worker inside a GitHub Pages project scope', () => {
    expect(serviceWorkerScriptUrl('/terra-sentinel/')).toBe('/terra-sentinel/sw.js')
  })

  it('normalizes base URLs that omit the trailing slash', () => {
    expect(serviceWorkerScriptUrl('/preview')).toBe('/preview/sw.js')
  })
})
