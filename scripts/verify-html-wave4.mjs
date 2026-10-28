import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const [webSocketUrl, directoryArg] = process.argv.slice(2)
if (!webSocketUrl) throw new Error('Usage: node scripts/verify-html-wave4.mjs <ws-url> [html-directory]')

const defaultDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '../prototype/html/wave4-pilot')
const directory = directoryArg || defaultDirectory
const socket = new WebSocket(webSocketUrl)
const pending = new Map()
const browserErrors = []
let requestId = 0

socket.addEventListener('message', (event) => {
  const payload = JSON.parse(String(event.data))
  if (payload.method === 'Runtime.exceptionThrown') {
    browserErrors.push(payload.params.exceptionDetails.exception?.description || payload.params.exceptionDetails.text)
  }
  if (payload.method === 'Runtime.consoleAPICalled' && payload.params.type === 'error') {
    browserErrors.push(payload.params.args.map((item) => item.value || item.description || '').join(' '))
  }
  if (payload.method === 'Log.entryAdded' && payload.params.entry.level === 'error') {
    browserErrors.push(payload.params.entry.text)
  }
  if (!payload.id) return
  const request = pending.get(payload.id)
  if (!request) return
  pending.delete(payload.id)
  payload.error ? request.reject(new Error(payload.error.message)) : request.resolve(payload.result)
})
await new Promise((resolveOpen, reject) => {
  socket.addEventListener('open', resolveOpen, { once: true })
  socket.addEventListener('error', reject, { once: true })
})

function send(method, params = {}) {
  requestId += 1
  return new Promise((resolveRequest, reject) => {
    pending.set(requestId, { resolve: resolveRequest, reject })
    socket.send(JSON.stringify({ id: requestId, method, params }))
  })
}
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text)
  return result.result.value
}
const pause = (milliseconds) => new Promise((resolvePause) => setTimeout(resolvePause, milliseconds))
function urlFor(file) {
  if (/^(?:file|https?):/i.test(directory)) return directory.replace(/\/$/, '') + '/' + file
  return pathToFileURL(resolve(directory, file)).href
}
async function waitForReady() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (await evaluate("document.readyState === 'complete' && document.body.dataset.activeScreen")) return
    await pause(100)
  }
  throw new Error('Timed out waiting for local HTML')
}
async function open(file, width = 390, height = 900) {
  browserErrors.length = 0
  await send('Emulation.setDeviceMetricsOverride', { width, height, screenWidth: width, screenHeight: height, deviceScaleFactor: 1, mobile: true })
  await send('Page.navigate', { url: urlFor(file) })
  await waitForReady()
  await pause(80)
}
function check(condition, label) {
  if (!condition) throw new Error('FAILED: ' + label)
  console.log('PASS: ' + label)
}
async function activeIs(name) {
  return evaluate("document.body.dataset.activeScreen === " + JSON.stringify(name) + " && document.querySelectorAll('.screen:not([hidden])').length === 1 && !document.querySelector('[data-screen=" + JSON.stringify(name) + "]').hidden")
}
async function click(selector) {
  await evaluate("(() => { const node=document.querySelector(" + JSON.stringify(selector) + "); if(!node) throw new Error('Missing control: " + selector.replace(/'/g, "\'") + "'); node.click() })()")
  await pause(60)
}
async function checkBottomClearance(selector, label) {
  await evaluate('window.scrollTo(0, document.scrollingElement.scrollHeight)')
  await pause(80)
  check(await evaluate("(() => { const target=document.querySelector(" + JSON.stringify(selector) + "); const wrap=document.querySelector('.bottom-wrap'); if(!target||!wrap)return false; return target.getBoundingClientRect().bottom <= wrap.getBoundingClientRect().top + 1 })()"), label)
}
async function ensureUi05() {
  const active = await evaluate('document.body.dataset.activeScreen')
  if (active === 'ui04') await click('[data-screen="ui04"] [data-action="open-competition"]')
  if (active === 'ui09') await click('[data-screen="ui09"] [data-action="recruitment-back"]')
}
async function ensureUi04() {
  const active = await evaluate('document.body.dataset.activeScreen')
  if (active === 'ui09') await click('[data-screen="ui09"] [data-action="recruitment-back"]')
  if (await evaluate("document.body.dataset.activeScreen === 'ui05'")) await click('[data-screen="ui05"] [data-action="detail-back"]')
}

await send('Page.enable')
await send('Runtime.enable')
await send('Log.enable')

const files = ['ui04-competition-hub.html', 'ui05-competition-detail.html', 'ui09-recruitment-detail.html']
const expectedInitial = {
  'ui04-competition-hub.html': 'ui04',
  'ui05-competition-detail.html': 'ui05',
  'ui09-recruitment-detail.html': 'ui09',
}
const viewports = [{ width: 320, height: 900 }, { width: 390, height: 900 }, { width: 402, height: 820 }, { width: 430, height: 900 }]

if (!/^(?:file|https?):/i.test(directory)) {
  for (const file of files) {
    const source = await readFile(resolve(directory, file), 'utf8')
    check(!/<iframe\b|\bfetch\s*\(|window\.open\s*\(|location\.href\s*=|postMessage\s*\(/i.test(source), file + ' contains no forbidden cross-document mechanism')
  }
}

for (const file of files) {
  for (const { width, height } of viewports) {
    const viewportLabel = width + 'x' + height
    await open(file, width, height)
    check(await activeIs(expectedInitial[file]), file + ' opens on ' + expectedInitial[file] + ' at ' + viewportLabel)
    check(await evaluate("location.protocol === 'file:' && document.querySelectorAll('.screen').length === 3"), file + ' renders three in-document views from file:// at ' + viewportLabel)
    check(await evaluate("scrollY === 0 && document.querySelector('.screen:not([hidden]) .app-header').getBoundingClientRect().top === 0"), file + ' opens at the visible page top at ' + viewportLabel)
    check(await evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1'), file + ' has no horizontal overflow at ' + viewportLabel)
    check(await evaluate("parseFloat(getComputedStyle(document.querySelector('.screen:not([hidden]) .screen-content')).paddingLeft) >= 15"), file + ' keeps the mobile content gutter at ' + viewportLabel)
    check(await evaluate("document.querySelectorAll('.bottom-nav').length === 1 && document.querySelectorAll('a[href]').length === 0 && !document.querySelector('link[rel=stylesheet],script[src],iframe,canvas,img[src]') && performance.getEntriesByType('resource').every((entry)=>!/^https?:/i.test(entry.name))"), file + ' has one navigation and no external or cross-file dependency at ' + viewportLabel)
    check(await evaluate("(() => { const wrap=document.querySelector('.bottom-wrap'); const nav=document.querySelector('.bottom-nav'); const rect=wrap.getBoundingClientRect(); return getComputedStyle(wrap).position === 'fixed' && getComputedStyle(wrap).backgroundColor === 'rgb(245, 247, 250)' && rect.left === 0 && rect.right === innerWidth && Math.abs(rect.bottom-innerHeight) <= 1 && getComputedStyle(nav).pointerEvents === 'auto' })()"), file + ' keeps the opaque fixed navigation at ' + viewportLabel)
    check(await evaluate("[...document.querySelectorAll('.nav-item')].every((item)=>item.getBoundingClientRect().height >= 52)"), file + ' keeps labelled navigation targets at ' + viewportLabel)
    check(await evaluate("getComputedStyle(document.body).overflowY !== 'hidden' && document.scrollingElement.scrollHeight > innerHeight"), file + ' retains vertical document scrolling at ' + viewportLabel)
    await evaluate('window.scrollTo(0, 120)')
    await pause(40)
    check(await evaluate('scrollY > 0'), file + ' can scroll normally at ' + viewportLabel)
    await ensureUi05()
    check(await evaluate(`[...document.querySelectorAll('[data-screen="ui05"] [data-tab]')].length === 4 && [...document.querySelectorAll('[data-screen="ui05"] [data-tab]')].every((tab)=>tab.scrollWidth <= tab.clientWidth + 1 && tab.getBoundingClientRect().height >= 44)`), file + ' shows four complete tabs at ' + viewportLabel)
    if (width === 402) {
      await click('[data-screen="ui05"] [data-tab="recruitment"]')
      await checkBottomClearance('[data-screen="ui05"] .recruit-card:last-of-type', file + ' UI-05 final card clears navigation at 402x820')
      await click('[data-screen="ui05"] [data-action="open-team"]')
      await checkBottomClearance('[data-screen="ui09"] .team-advisory', file + ' UI-09 final action clears navigation at 402x820')
      await ensureUi04()
      await checkBottomClearance('[data-screen="ui04"] .hub-card:last-of-type', file + ' UI-04 final card clears navigation at 402x820')
    }
    check(browserErrors.length === 0, file + ' has no browser console or runtime errors at ' + viewportLabel)
  }
}

for (const file of files) {
  await open(file, 402, 820)
  const originalUrl = await evaluate('location.href')
  check(await activeIs(expectedInitial[file]), file + ' starts on its declared initial view')

  if (expectedInitial[file] === 'ui05') {
    check(await evaluate(`document.querySelector('[data-screen="ui05"] [data-tab="overview"]').classList.contains('active')`), file + ' starts UI-05 on Overview')
    await click('[data-screen="ui05"] [data-action="detail-back"]')
    check(await activeIs('ui04'), file + ' initial UI-05 can return to UI-04')
  } else if (expectedInitial[file] === 'ui09') {
    await click('[data-screen="ui09"] [data-action="recruitment-back"]')
    check(await activeIs('ui05'), file + ' initial UI-09 returns to UI-05')
    check(await evaluate(`document.querySelector('[data-screen="ui05"] [data-tab="recruitment"]').classList.contains('active')`), file + ' initial UI-09 return restores Recruitment')
    await click('[data-screen="ui05"] [data-action="detail-back"]')
    check(await activeIs('ui04'), file + ' returned UI-05 can continue back to UI-04')
  }

  await ensureUi04()
  await evaluate("document.getElementById('hubQuery').value='no such competition';document.getElementById('hubQuery').dispatchEvent(new Event('input',{bubbles:true}))")
  check(await evaluate("getComputedStyle(document.getElementById('hubEmpty')).display === 'block' && document.getElementById('hubCount').textContent === '0'"), file + ' UI-04 search exposes an empty state')
  await click('#hubClearSearch')
  check(await evaluate(`document.querySelectorAll('[data-screen="ui04"] .hub-card:not([hidden])').length === 2`), file + ' UI-04 search restores competition cards')

  await click('[data-screen="ui04"] [data-action="open-competition"]')
  check(await activeIs('ui05'), file + ' UI-04 competition card opens UI-05')
  check(await evaluate('scrollY === 0'), file + ' UI-05 transition restores top scroll')
  check(await evaluate(`document.querySelector('[data-screen="ui05"] [data-tab="overview"]').classList.contains('active')`), file + ' competition card opens Overview')

  for (const tab of ['overview', 'discussion', 'resources', 'recruitment']) {
    await click('[data-screen="ui05"] [data-tab="' + tab + '"]')
    check(await evaluate(`document.querySelector('[data-screen="ui05"] [data-tab-panel="${tab}"]').classList.contains('active') && !document.querySelector('[data-screen="ui05"] [data-tab-panel="${tab}"]').hidden`), file + ' switches to ' + tab + ' tab')
  }
  check(await evaluate(`document.querySelectorAll('[data-screen="ui05"] .recruit-card').length === 4 && !document.querySelector('[data-screen="ui05"]').innerText.includes('Team Delta')`), file + ' Recruitment shows public teams without Delisted content')

  await click('[data-screen="ui05"] [data-tab="overview"]')
  await click('[data-screen="ui05"] [data-action="find-team"]')
  check(await evaluate(`document.querySelector('[data-screen="ui05"] [data-tab="recruitment"]').classList.contains('active')`), file + ' Find a team opens Recruitment')

  await click('[data-screen="ui05"] [data-action="open-team"]')
  check(await activeIs('ui09'), file + ' Team Alpha opens UI-09')
  check(await evaluate('scrollY === 0'), file + ' UI-09 transition restores top scroll')
  await click('[data-screen="ui09"] [data-action="apply"]')
  check(await evaluate("document.getElementById('teamFeedback').classList.contains('visible') && document.getElementById('teamFeedback').textContent.includes('Pending')"), file + ' UI-09 apply shows example Pending feedback')

  await click('[data-screen="ui09"] [data-action="recruitment-back"]')
  check(await activeIs('ui05'), file + ' UI-09 returns to UI-05')
  check(await evaluate(`document.querySelector('[data-screen="ui05"] [data-tab="recruitment"]').classList.contains('active')`), file + ' UI-09 return restores Recruitment tab')
  await click('[data-screen="ui05"] [data-action="open-team"]')
  await click('[data-screen="ui09"] [data-action="recruitment-back"]')
  check(await activeIs('ui05'), file + ' repeated Team Alpha round trip remains functional')
  await click('[data-screen="ui05"] [data-action="detail-back"]')
  check(await activeIs('ui04'), file + ' UI-05 back returns to UI-04')
  check(await evaluate('location.href === ' + JSON.stringify(originalUrl)), file + ' complete flow never changes the document URL')
  check(await evaluate("document.querySelectorAll('.screen:not([hidden])').length === 1 && document.querySelectorAll('.bottom-nav').length === 1"), file + ' complete flow keeps one view and one bottom navigation')
  check(browserErrors.length === 0, file + ' complete interaction flow has no console or runtime errors')
}

socket.close()
