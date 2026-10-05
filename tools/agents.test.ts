import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'

test('AGENTS.md has required sections in order', () => {
  const text = readFileSync('AGENTS.md', 'utf8')
  const headings = [
    '## Project',
    '## Commands',
    '## Pinned versions',
    '## Folder boundaries',
    '## Hard rules',
    '## Commits',
    '## Definition of done',
    '## Reading list',
  ]
  let last = -1
  for (const h of headings) {
    const idx = text.indexOf(h)
    expect(idx, h).toBeGreaterThan(last)
    last = idx
  }
  expect(text).toContain('pnpm verify')
  expect(text).toContain('docs/guidance/modern-web.md')
  expect(text).toContain('Conventional Commits')
})

test('pinned versions match package.json', () => {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as {
    dependencies: Record<string, string>
    devDependencies: Record<string, string>
  }
  const text = readFileSync('AGENTS.md', 'utf8')
  const all = { ...pkg.dependencies, ...pkg.devDependencies }
  for (const [name, version] of Object.entries(all)) {
    const re = new RegExp(
      `\\|\\s*${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\|\\s*${version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\|`,
    )
    expect(text, name).toMatch(re)
  }
})

test('cursor rule points at AGENTS.md', () => {
  const rule = readFileSync('.cursor/rules/kaban.mdc', 'utf8')
  expect(rule.startsWith('---')).toBe(true)
  expect(rule).toContain('alwaysApply: true')
  expect(rule).toContain('AGENTS.md')
})
