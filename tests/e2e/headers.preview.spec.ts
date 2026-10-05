import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { inlineScriptHashes } from '../../scripts/csp.ts'

test('built headers include script hash and isolation', () => {
  const headers = readFileSync('dist/_headers', 'utf8')
  expect(headers).not.toContain('{{')
  expect(headers).toContain('Cross-Origin-Opener-Policy: same-origin')
  expect(headers).toContain('Cross-Origin-Embedder-Policy: require-corp')
  const html = readFileSync('dist/index.html', 'utf8')
  const hashes = inlineScriptHashes(html)
  expect(hashes.length).toBeGreaterThan(0)
  expect(headers).toContain(hashes[0]!)
  // sanity of hash format
  expect(hashes[0]).toMatch(/^'sha256-/)
  void createHash
})
