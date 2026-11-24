#!/usr/bin/env node
/**
 * Checks that the WeChat Developer Tools can open the mini program project
 * with git management on the source tree.
 *
 * The read-only part is the default. The `--login` flag additionally asks the
 * developer tools whether an account is signed in, which starts the IDE if it
 * is not running, so it is not done unless it is asked for.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PROJECT_DIR = join(ROOT, 'apps/student-app')
const PROJECT_CONFIG = join(PROJECT_DIR, 'project.config.json')
const EXPECTED_APPID = 'wxa551256ce5fab6a7'

const checks = []
function check(name, ok, detail) {
  checks.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`)
}

console.log('WeChat Developer Tools project setup')
console.log('='.repeat(60))
console.log(`project dir : ${PROJECT_DIR}`)
console.log('')

let config = null
if (!existsSync(PROJECT_CONFIG)) {
  check('project.config.json exists in the source tree', false, PROJECT_CONFIG)
} else {
  check('project.config.json exists in the source tree', true, PROJECT_CONFIG)
  config = JSON.parse(readFileSync(PROJECT_CONFIG, 'utf8'))
  check('the AppID is the expected one', config.appid === EXPECTED_APPID, `appid=${config.appid}`)
  check('the project name is not empty', Boolean(config.projectname), `projectname="${config.projectname}"`)
  check('the package type is a mini program', config.compileType === 'miniprogram', `compileType=${config.compileType}`)
  check(
    'the legal domain check is enabled',
    config.setting?.urlCheck === true,
    `urlCheck=${config.setting?.urlCheck}`,
  )

  const miniprogramRoot = config.miniprogramRoot
  check('the mini program root is declared', Boolean(miniprogramRoot), `miniprogramRoot="${miniprogramRoot}"`)
  const rootDir = miniprogramRoot ? join(PROJECT_DIR, miniprogramRoot) : null
  check('the mini program root exists', Boolean(rootDir) && existsSync(rootDir), `${rootDir}`)
  check(
    'the mini program root holds the built package',
    Boolean(rootDir) && existsSync(join(rootDir, 'app.json')) && existsSync(join(rootDir, 'project.config.json')),
    rootDir ? `${rootDir}` : 'no root',
  )
  if (rootDir) {
    const built = JSON.parse(readFileSync(join(rootDir, 'project.config.json'), 'utf8'))
    check('the built package carries the same AppID', built.appid === EXPECTED_APPID, `appid=${built.appid}`)
  }
}

try {
  const toplevel = execFileSync('git', ['-C', PROJECT_DIR, 'rev-parse', '--show-toplevel'], {
    encoding: 'utf8',
  }).trim()
  check('the project directory is inside a git repository', true, toplevel)
  const branch = execFileSync('git', ['-C', PROJECT_DIR, 'rev-parse', '--abbrev-ref', 'HEAD'], {
    encoding: 'utf8',
  }).trim()
  check('the branch is readable from the project directory', true, branch)
} catch (error) {
  check('the project directory is inside a git repository', false, String(error.message).split('\n')[0])
}

const INSTALL_ROOTS = [
  'C:/Program Files (x86)/Tencent',
  'C:/Program Files/Tencent',
  'D:/Program Files/Apps/Tencent',
  'C:/Program Files (x86)/微信web开发者工具',
]
const CLI_NAMES = ['cli.bat', 'cli.exe']

let cli = null
for (const root of INSTALL_ROOTS) {
  if (!existsSync(root)) continue
  for (const entry of readdirSync(root)) {
    for (const name of CLI_NAMES) {
      const candidate = join(root, entry, name)
      if (existsSync(candidate)) cli = candidate
    }
  }
}
check('the developer tools command line is installed', Boolean(cli), cli ?? 'not found')

if (process.argv.includes('--login') && cli) {
  try {
    const out = execFileSync('cmd', ['/c', cli, 'islogin'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    const loggedIn = /"login"\s*:\s*true/.test(out)
    check('an account is signed in to the developer tools', loggedIn, out.trim().split('\n').pop() ?? '')
  } catch (error) {
    check('an account is signed in to the developer tools', false, String(error.message).split('\n')[0])
  }
}

const failures = checks.filter((entry) => !entry.ok).length
console.log('')
console.log(`RESULT: ${failures === 0 ? 'PASS' : 'FAIL'} (${failures} failures)`)
process.exit(failures === 0 ? 0 : 1)
