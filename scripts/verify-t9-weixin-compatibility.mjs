#!/usr/bin/env node
/**
 * Reports the HTTP methods the student client can send, and compares them
 * with the methods the WeChat mini program network API documents.
 *
 * The check is a static reading of the source. It cannot prove what the
 * simulator does with a method that is outside the documented set, so a
 * method outside the set is reported as a finding for a manual test on the
 * device, never as a failure.
 *
 * Usage:
 *   node scripts/verify-t9-weixin-compatibility.mjs
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const SOURCE_DIRS = [
  join(ROOT, 'apps/student-app/src'),
  join(ROOT, 'packages/api-contracts/src'),
]

/**
 * The methods the WeChat mini program documents for `wx.request`. This list
 * comes from the uni-app type definition of `uni.request`, which mirrors the
 * platform: the union omits PATCH.
 */
const DOCUMENTED_METHODS = new Set([
  'OPTIONS',
  'GET',
  'HEAD',
  'POST',
  'PUT',
  'DELETE',
  'TRACE',
  'CONNECT',
])

/** The methods the shared transport contract allows at all. */
const CONTRACT_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])

function sourceFiles(directory) {
  const found = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const child = join(directory, entry.name)
    if (entry.isDirectory()) found.push(...sourceFiles(child))
    else if (/\.(ts|vue|mjs)$/.test(entry.name)) found.push(child)
  }
  return found
}

/** Finds `method: 'X'` occurrences and the line they sit on. */
function methodsIn(file) {
  const lines = readFileSync(file, 'utf8').split('\n')
  const found = []
  lines.forEach((line, index) => {
    const match = line.match(/method\s*:\s*'([A-Z]+)'/)
    if (match) found.push({ method: match[1], line: index + 1, text: line.trim() })
  })
  return found
}

const usages = []
for (const directory of SOURCE_DIRS) {
  for (const file of sourceFiles(directory)) {
    for (const usage of methodsIn(file)) {
      usages.push({ file: relative(ROOT, file), ...usage })
    }
  }
}

const used = [...new Set(usages.map((usage) => usage.method))].sort()
const outsideDocumented = used.filter((method) => !DOCUMENTED_METHODS.has(method))
const outsideContract = used.filter((method) => !CONTRACT_METHODS.has(method))

console.log('WeChat mini program HTTP method audit')
console.log('='.repeat(60))
console.log(`source scanned : ${SOURCE_DIRS.map((dir) => relative(ROOT, dir)).join(', ')}`)
console.log(`methods used   : ${used.join(', ')}`)
console.log(`documented set : ${[...DOCUMENTED_METHODS].join(', ')}`)
console.log('')

for (const usage of usages) {
  const mark = DOCUMENTED_METHODS.has(usage.method) ? 'ok     ' : 'FINDING'
  console.log(`${mark} ${usage.method.padEnd(7)} ${usage.file}:${usage.line}  ${usage.text}`)
}

console.log('')
if (outsideContract.length > 0) {
  console.log(`RESULT: FAIL — ${outsideContract.join(', ')} is not part of the shared transport contract`)
  process.exit(1)
}

if (outsideDocumented.length > 0) {
  console.log(`RESULT: FINDING — ${outsideDocumented.join(', ')} is outside the documented mini program method set.`)
  console.log('The runtime behaviour of that method on the simulator or a device is NOT VERIFIED')
  console.log('by this check and has to be tested manually in the WeChat Developer Tools.')
  console.log('')
  console.log('The backend already answers the same route with a documented method:')
  console.log('  PATCH /profiles/me -> partial update, only the fields that were sent')
  console.log('  PUT   /profiles/me -> full replace, every field falls back to its empty default')
  console.log('A switch to PUT therefore also needs the client to send the whole profile,')
  console.log('otherwise the fields that are left out are cleared.')
  process.exit(0)
}

console.log('RESULT: PASS — every method the client uses is in the documented set')
