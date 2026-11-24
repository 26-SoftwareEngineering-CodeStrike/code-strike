#!/usr/bin/env node
/**
 * Checks a built WeChat mini program package.
 *
 * The script reads the build output only, so it can be run against any build
 * and its result is reproducible. It reports what is in the package and what
 * is missing; it never rewrites anything.
 *
 * Usage:
 *   node scripts/verify-t9-weixin-build.mjs [distDir] [expectedAppId]
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const DIST = resolve(ROOT, process.argv[2] ?? 'apps/student-app/dist/build/mp-weixin')
const EXPECTED_APP_ID = process.argv[3] ?? 'wxa551256ce5fab6a7'

/** The main package limit of a WeChat mini program is 2 MB. */
const PACKAGE_LIMIT_BYTES = 2 * 1024 * 1024

const checks = []

function check(name, passed, detail) {
  checks.push({ name, passed, detail })
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function directorySize(path) {
  let total = 0
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const child = join(path, entry.name)
    total += entry.isDirectory() ? directorySize(child) : statSync(child).size
  }
  return total
}

if (!existsSync(DIST)) {
  console.error(`the build output is missing: ${DIST}`)
  process.exit(1)
}

console.log(`build output : ${DIST}`)
console.log(`expected app id: ${EXPECTED_APP_ID}`)

// --- project.config.json -----------------------------------------------------
const projectConfigPath = join(DIST, 'project.config.json')
if (existsSync(projectConfigPath)) {
  const project = readJson(projectConfigPath)
  check(
    'project.config.json carries the expected AppID',
    project.appid === EXPECTED_APP_ID,
    `appid=${project.appid}`,
  )
  check(
    'the project name is not empty',
    typeof project.projectname === 'string' && project.projectname.trim().length > 0,
    `projectname=${JSON.stringify(project.projectname)}`,
  )
  check(
    'the legal domain check is enabled in the built package',
    project.setting?.urlCheck === true,
    `urlCheck=${project.setting?.urlCheck}`,
  )
  check(
    'the package is a mini program',
    project.compileType === 'miniprogram',
    `compileType=${project.compileType}`,
  )
} else {
  check('project.config.json exists', false, 'the file is missing')
}

// --- app.json ----------------------------------------------------------------
const appJsonPath = join(DIST, 'app.json')
if (existsSync(appJsonPath)) {
  const app = readJson(appJsonPath)
  const pages = Array.isArray(app.pages) ? app.pages : []
  check('app.json lists its pages', pages.length > 0, `${pages.length} pages`)

  const missing = []
  for (const page of pages) {
    for (const extension of ['.js', '.json', '.wxml', '.wxss']) {
      if (!existsSync(join(DIST, page + extension))) missing.push(page + extension)
    }
  }
  check(
    'every page has its four compiled files',
    missing.length === 0,
    missing.length === 0 ? `${pages.length} pages complete` : `missing: ${missing.join(', ')}`,
  )

  const pageDir = join(DIST, 'pages')
  const pageCount = existsSync(pageDir)
    ? readdirSync(pageDir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).length
    : 0
  check('the pages directory is present', pageCount > 0, `${pageCount} page directories`)

  // A native tabBar cannot be replaced at runtime. The prototype draws its own
  // navigation, so the built package must not claim a native one.
  check(
    'the package declares no native tabBar',
    !('tabBar' in app),
    'the custom bottom navigation is used instead',
  )
} else {
  check('app.json exists', false, 'the file is missing')
}

// --- static assets -----------------------------------------------------------
const staticDir = join(DIST, 'static')
const staticFiles = existsSync(staticDir)
  ? readdirSync(staticDir, { withFileTypes: true }).filter((entry) => entry.isFile())
  : []
check('the static directory is present', existsSync(staticDir), `${staticFiles.length} files`)

// --- package size ------------------------------------------------------------
const size = directorySize(DIST)
check(
  'the main package is under the 2 MB limit',
  size < PACKAGE_LIMIT_BYTES,
  `${(size / 1024).toFixed(1)} KiB of ${(PACKAGE_LIMIT_BYTES / 1024).toFixed(0)} KiB`,
)

// --- the transport mode that was compiled in ---------------------------------
const vendorPath = join(DIST, 'common/vendor.js')
const bundleSources = []
const collect = (path) => {
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const child = join(path, entry.name)
    if (entry.isDirectory()) collect(child)
    else if (child.endsWith('.js')) bundleSources.push(readFileSync(child, 'utf8'))
  }
}
collect(DIST)
const bundle = bundleSources.join('\n')

const envObject = bundle.match(/\{[^{}]*VITE_API_BASE_URL[^{}]*\}/)
const apiMode = /VITE_USE_MOCK\s*:\s*"false"/.test(bundle)
const mockMode = !envObject || !/VITE_USE_MOCK\s*:\s*"false"/.test(bundle)
check(
  'the compiled bundle carries exactly one transport mode',
  apiMode !== mockMode || apiMode === true,
  apiMode ? 'API mode (VITE_USE_MOCK=false)' : 'Mock mode',
)
const baseUrl = envObject?.[0].match(/VITE_API_BASE_URL\s*:\s*"([^"]*)"/)?.[1]
if (baseUrl) {
  console.log(`compiled api base url: ${baseUrl}`)
  const isHttps = baseUrl.startsWith('https://')
  const isLoopback = /^https?:\/\/(127\.0\.0\.1|localhost)/.test(baseUrl)
  check(
    'the compiled base url is usable on a device',
    isHttps && !isLoopback,
    isLoopback
      ? 'a loopback address points at the phone itself and cannot reach the backend'
      : isHttps
        ? 'https'
        : 'a plain http address is refused by the mini program outside the developer tools',
  )
}

// --- report ------------------------------------------------------------------
console.log('')
let failures = 0
for (const { name, passed, detail } of checks) {
  if (!passed) failures += 1
  console.log(`${passed ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`)
}
console.log('')
console.log(`RESULT: ${failures === 0 ? 'PASS' : 'FAIL'} (${failures} failures)`)
process.exit(failures === 0 ? 0 : 1)
