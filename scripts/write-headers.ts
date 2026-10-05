import { readFileSync, writeFileSync } from 'node:fs'
import { inlineScriptHashes, renderHeaders } from './csp.ts'

const html = readFileSync('dist/index.html', 'utf8')
const template = readFileSync('config/headers.template', 'utf8')
const headers = renderHeaders(template, inlineScriptHashes(html))
writeFileSync('dist/_headers', headers)
