import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'
import { inlineScriptHashes, renderHeaders } from './csp.ts'

test('hashes classic inline scripts', () => {
  const body = 'console.log(1)'
  const html = `<script>${body}</script>`
  const expected = `'sha256-${createHash('sha256').update(body, 'utf8').digest('base64')}'`
  expect(inlineScriptHashes(html)).toEqual([expected])
})

test('ignores module and src scripts', () => {
  expect(inlineScriptHashes('<script type="module" src="/a.js"></script>')).toEqual([])
  expect(inlineScriptHashes('<script src="x.js"></script>')).toEqual([])
  expect(inlineScriptHashes('<script type="module">x</script>')).toEqual([])
})

test('whitespace is significant', () => {
  const a = inlineScriptHashes('<script>a</script>')[0]
  const b = inlineScriptHashes('<script>a </script>')[0]
  expect(a).not.toBe(b)
})

test('renderHeaders', () => {
  expect(renderHeaders('x {{SCRIPT_HASHES}} y', ["'sha256-a'", "'sha256-b'"])).toBe(
    "x 'sha256-a' 'sha256-b' y",
  )
  expect(renderHeaders('x {{SCRIPT_HASHES}} y', [])).toBe('x  y')
  expect(renderHeaders('x {{SCRIPT_HASHES}} y', []).includes('{{')).toBe(false)
})

test('template placeholder', () => {
  const template = readFileSync('config/headers.template', 'utf8')
  expect(template.split('{{SCRIPT_HASHES}}')).toHaveLength(2)
})
