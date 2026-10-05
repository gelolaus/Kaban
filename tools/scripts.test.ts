import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'

const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as {
  scripts: Record<string, string>
  engines: { node: string }
  packageManager: string
}

test('the agreed commands exist', () => {
  for (const name of [
    'dev',
    'build',
    'typecheck',
    'lint',
    'lint:css',
    'format',
    'test',
    'test:e2e',
    'verify',
    'verify:e2e',
  ])
    expect(pkg.scripts[name], name).toBeTruthy()
})

test('verify runs typecheck, lint, css lint, format check, unit tests, and build in that order', () => {
  expect(pkg.scripts.verify).toBe(
    'pnpm typecheck && pnpm lint && pnpm lint:css && pnpm format && pnpm test && pnpm build',
  )
})

test('toolchain is pinned', () => {
  expect(pkg.packageManager).toBe('pnpm@12.9.1')
  expect(pkg.engines.node).toBe('>=24')
})
