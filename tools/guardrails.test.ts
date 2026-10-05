import { readFileSync } from 'node:fs'
import { ESLint } from 'eslint'
import stylelint from 'stylelint'
import { expect, test } from 'vitest'

const stylelintConfig = JSON.parse(readFileSync('.stylelintrc.json', 'utf8')) as object

async function eslintRuleIds(code: string, filePath: string): Promise<Set<string | null>> {
  const eslint = new ESLint({ cwd: process.cwd() })
  const results = await eslint.lintText(code, { filePath })
  return new Set(results.flatMap((r) => r.messages.map((m) => m.ruleId)))
}

async function stylelintRules(code: string, codeFilename: string): Promise<Set<string>> {
  const result = await stylelint.lint({
    code,
    codeFilename,
    config: stylelintConfig,
    configBasedir: process.cwd(),
  })
  return new Set(
    result.results.flatMap((r) => r.warnings.map((w) => w.rule)).filter((r): r is string => !!r),
  )
}

test('engine cannot import react', async () => {
  const ids = await eslintRuleIds(`import React from 'react'\n`, 'src/engine/a.ts')
  expect(ids.has('no-restricted-imports')).toBe(true)
})

test('engine cannot import storage', async () => {
  const ids = await eslintRuleIds(`import { x } from '../storage/db'\n`, 'src/engine/b.ts')
  expect(ids.has('no-restricted-imports')).toBe(true)
})

test('engine cannot use window', async () => {
  const ids = await eslintRuleIds(`export const c = window.innerWidth\n`, 'src/engine/c.ts')
  expect(ids.has('no-restricted-globals')).toBe(true)
})

test('ui cannot assign innerHTML', async () => {
  const ids = await eslintRuleIds(
    `export function d(el: HTMLElement, s: string) { el.innerHTML = s }\n`,
    'src/ui/d.ts',
  )
  expect(ids.has('no-restricted-syntax')).toBe(true)
})

test('ui cannot use dangerouslySetInnerHTML', async () => {
  const ids = await eslintRuleIds(
    `export function E() { return <div dangerouslySetInnerHTML={{ __html: 'x' }} /> }\n`,
    'src/ui/e.tsx',
  )
  expect(ids.has('react/no-danger')).toBe(true)
})

test('engine pure math is allowed', async () => {
  const ids = await eslintRuleIds(
    `export const ok = (a: number, b: number): number => a + b\n`,
    'src/engine/ok.ts',
  )
  expect([...ids].filter(Boolean)).toEqual([])
})

test('ui may use window', async () => {
  const ids = await eslintRuleIds(`export const w = () => window.innerWidth\n`, 'src/ui/ok.ts')
  expect([...ids].filter(Boolean)).toEqual([])
})

test('css forbids px font sizes', async () => {
  const rules = await stylelintRules(`a {\n  font-size: 12px;\n}\n`, 'src/ui/a.css')
  expect(rules.has('declaration-property-unit-disallowed-list')).toBe(true)
})

test('css forbids hex colors outside tokens', async () => {
  const rules = await stylelintRules(`a {\n  color: #fff;\n}\n`, 'src/ui/a.css')
  expect(rules.has('color-no-hex')).toBe(true)
})

test('css forbids universal selectors', async () => {
  const rules = await stylelintRules(`* {\n  margin: 0;\n}\n`, 'src/ui/a.css')
  expect(rules.has('selector-max-universal')).toBe(true)
})

test('css forbids @import', async () => {
  const rules = await stylelintRules(`@import "x.css";\n`, 'src/ui/a.css')
  expect(rules.has('at-rule-disallowed-list')).toBe(true)
})

test('css forbids outline none', async () => {
  const rules = await stylelintRules(`a {\n  outline: none;\n}\n`, 'src/ui/a.css')
  expect(rules.has('declaration-property-value-disallowed-list')).toBe(true)
})

test('tokens.css may use hex', async () => {
  const rules = await stylelintRules(`:root {\n  --ink: #fff;\n}\n`, 'src/ui/tokens.css')
  expect(rules.has('color-no-hex')).toBe(false)
})

test('css allows rem font sizes', async () => {
  const rules = await stylelintRules(`a {\n  font-size: 0.8125rem;\n}\n`, 'src/ui/a.css')
  expect(rules.has('declaration-property-unit-disallowed-list')).toBe(false)
})
