import { createHash } from 'node:crypto'

export function inlineScriptHashes(html: string): string[] {
  const hashes: string[] = []
  const re = /<script(?![^>]*\bsrc=)(?![^>]*\btype=["']module["'])[^>]*>([^]*?)<\/script>/gi
  let match: RegExpExecArray | null
  while ((match = re.exec(html)) !== null) {
    const body = match[1] ?? ''
    const hash = createHash('sha256').update(body, 'utf8').digest('base64')
    hashes.push(`'sha256-${hash}'`)
  }
  return hashes
}

export function renderHeaders(template: string, hashes: string[]): string {
  return template.replaceAll('{{SCRIPT_HASHES}}', hashes.join(' '))
}
