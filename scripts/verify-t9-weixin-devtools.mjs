#!/usr/bin/env node
/**
 * Reports whether the WeChat Developer Tools are installed on this machine.
 *
 * The check only reads. It never installs anything and never runs an
 * installer, because the tools are not the only way to get a WeChat mini
 * program into a build, and an installer that was fetched and run without a
 * decision from the person who owns the machine is a risk.
 */
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const INSTALL_ROOTS = [
  'C:/Program Files (x86)/Tencent',
  'C:/Program Files/Tencent',
  'C:/Program Files (x86)/微信web开发者工具',
  'C:/Program Files/微信web开发者工具',
]

const LOCAL_APP_DATA = process.env.LOCALAPPDATA ?? ''

const CANDIDATE_DIRECTORIES = [
  ...INSTALL_ROOTS.map((root) => join(root, '微信web开发者工具')),
  ...INSTALL_ROOTS.map((root) => join(root, 'wechat_devtools')),
  ...(LOCAL_APP_DATA
    ? [
        join(LOCAL_APP_DATA, '微信开发者工具'),
        join(LOCAL_APP_DATA, 'Programs/微信开发者工具'),
        join(LOCAL_APP_DATA, '微信web开发者工具'),
      ]
    : []),
]

const CLI_NAMES = ['cli.bat', 'cli.exe', '微信开发者工具.exe', 'wechatdevtools.exe']

console.log('WeChat Developer Tools availability')
console.log('='.repeat(60))

const found = []
for (const directory of CANDIDATE_DIRECTORIES) {
  if (!existsSync(directory)) continue
  found.push(directory)
  const entries = readdirSync(directory)
  for (const name of CLI_NAMES) {
    if (entries.includes(name)) console.log(`found CLI: ${join(directory, name)}`)
  }
}

console.log('')
console.log(`install directories checked: ${CANDIDATE_DIRECTORIES.length}`)
console.log(`install directories found : ${found.length}`)
for (const directory of found) console.log(`  ${directory}`)

if (found.length === 0) {
  console.log('')
  console.log('RESULT: NOT INSTALLED')
  console.log('')
  console.log('The tools are downloaded from the official page:')
  console.log('  https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html')
  console.log('')
  console.log('The project is imported with:')
  console.log('  WeChat Developer Tools -> Import project -> AppID: wxa551256ce5fab6a7')
  console.log('  -> the directory apps/student-app/dist/build/mp-weixin')
  console.log('')
  console.log('Nothing was installed by this check.')
  process.exit(0)
}

console.log('')
console.log('RESULT: INSTALLED')
