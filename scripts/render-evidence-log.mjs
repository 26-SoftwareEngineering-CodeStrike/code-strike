#!/usr/bin/env node
/**
 * Renders a captured command log into a PNG, so a build result can be read
 * as a picture in the evidence archive.
 *
 * The text is never retyped: the script reads the log file that the
 * collection run wrote and puts exactly that text on the page.
 *
 * Usage:
 *   node scripts/render-evidence-log.mjs <log-file> <output-png> [title]
 */
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const EDGE_CANDIDATES = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
]

const [logPath, outputPath, title = 'CodeStrike build result'] = process.argv.slice(2)
if (!logPath || !outputPath) {
  throw new Error('Usage: node scripts/render-evidence-log.mjs <log-file> <output-png> [title]')
}

const edge = EDGE_CANDIDATES.find((candidate) => {
  try {
    return readFileSync(candidate).length >= 0
  } catch {
    return false
  }
})
if (!edge) {
  throw new Error('Microsoft Edge was not found, so the log cannot be rendered.')
}

const log = readFileSync(resolve(logPath), 'utf8')
const escaped = log
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')

const html = `<!doctype html>
<html><head><meta charset="utf-8"><style>
  body { margin: 0; background: #0d1424; color: #dfe6f2;
         font-family: Consolas, Menlo, "Courier New", monospace; }
  header { padding: 18px 22px 12px; background: #14213d; border-bottom: 1px solid #2b3a5c; }
  h1 { margin: 0; font-size: 17px; color: #c9f43d; letter-spacing: .4px; }
  p  { margin: 6px 0 0; font-size: 12px; color: #9fb0cc; }
  pre { margin: 0; padding: 16px 22px 22px; font-size: 11.5px; line-height: 1.5; white-space: pre-wrap; }
</style></head><body>
<header><h1>${title.replace(/</g, '&lt;')}</h1>
<p>Rendered from ${logPath} — the text is the captured command output, not a transcription.</p></header>
<pre>${escaped}</pre>
</body></html>`

const directory = mkdtempSync(join(tmpdir(), 'codestrike-render-'))
const htmlPath = join(directory, 'evidence.html')
writeFileSync(htmlPath, html, 'utf8')

const result = spawnSync(
  edge,
  [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--window-size=1100,1500',
    `--screenshot=${resolve(outputPath)}`,
    `file:///${htmlPath.replace(/\\/g, '/')}`,
  ],
  { encoding: 'utf8' },
)

if (result.status !== 0) {
  console.error(result.stderr || 'the render failed')
  process.exit(1)
}
console.log(`wrote ${outputPath}`)
