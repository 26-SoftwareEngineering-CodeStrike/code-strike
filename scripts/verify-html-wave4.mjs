import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const [webSocketUrl, directoryArg] = process.argv.slice(2)
if (!webSocketUrl) throw new Error('Usage: node scripts/verify-html-wave4.mjs <ws-url> [html-directory]')

const defaultDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '../prototype/html/wave4-pilot')
const directory = directoryArg || defaultDirectory
const socket = new WebSocket(webSocketUrl)
const pending = new Map()
let requestId = 0

socket.addEventListener('message', (event) => {
  const payload = JSON.parse(String(event.data))
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
  if (/^[a-z]+:/i.test(directory)) return `${directory.replace(/\/$/, '')}/${file}`
  return pathToFileURL(resolve(directory, file)).href
}
async function waitForReady() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (await evaluate("document.readyState === 'complete'")) return
    await pause(100)
  }
  throw new Error('Timed out waiting for local HTML')
}
async function open(file, width = 390) {
  await send('Emulation.setDeviceMetricsOverride', { width, height: 900, screenWidth: width, screenHeight: 900, deviceScaleFactor: 1, mobile: true })
  await send('Page.navigate', { url: urlFor(file) })
  await waitForReady()
}
function check(condition, label) {
  if (!condition) throw new Error(`FAILED: ${label}`)
  console.log(`PASS: ${label}`)
}
async function checkBottomClearance(selector, label) {
  await evaluate('window.scrollTo(0, document.documentElement.scrollHeight)')
  await pause(100)
  check(await evaluate(`(() => { const target=document.querySelector(${JSON.stringify(selector)}); const nav=document.querySelector('.bottom-nav'); if(!target||!nav)return false; return target.getBoundingClientRect().bottom <= nav.getBoundingClientRect().top + 1 })()`), label)
}

await send('Page.enable')
await send('Runtime.enable')

const files = ['ui04-competition-hub.html', 'ui05-competition-detail.html', 'ui09-recruitment-detail.html']
for (const file of files) {
  for (const width of [320, 390, 430]) {
    await open(file, width)
    check(await evaluate("location.protocol === 'file:' && Boolean(document.querySelector('main h1'))"), `${file} renders from file:// at ${width}px`)
    check(await evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1'), `${file} has no horizontal overflow at ${width}px`)
    check(await evaluate("parseFloat(getComputedStyle(document.querySelector('.content')).paddingLeft) >= 15"), `${file} keeps the mobile content gutter at ${width}px`)
    check(await evaluate("!document.querySelector('link[rel=stylesheet],script[src],iframe,canvas,img[src]') && ![...document.querySelectorAll('a[href]')].some((node)=>/^https?:/i.test(node.href)) && performance.getEntriesByType('resource').every((entry)=>!/^https?:/i.test(entry.name))"), `${file} has no external dependency at ${width}px`)
    check(await evaluate("[...document.querySelectorAll('.nav-item')].every((item)=>item.getBoundingClientRect().height >= 52)"), `${file} keeps labelled navigation targets at ${width}px`)
  }
}

await open('ui04-competition-hub.html', 390)
await evaluate("document.querySelector('#query').value='no such competition';document.querySelector('#searchForm').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))")
check(await evaluate("getComputedStyle(document.querySelector('#empty')).display === 'block' && document.querySelector('#count').textContent === '0'"), 'UI-04 search exposes an empty state')
await evaluate("document.querySelector('#clearSearch').click()")
check(await evaluate("document.querySelectorAll('.competition-card:not([hidden])').length === 2"), 'UI-04 search restores published competitions')
await checkBottomClearance('.competition-card:last-of-type', 'UI-04 last card clears fixed navigation')

await open('ui05-competition-detail.html', 320)
check(await evaluate("[...document.querySelectorAll('[data-tab]')].length === 4 && [...document.querySelectorAll('[data-tab]')].every((tab)=>tab.scrollWidth <= tab.clientWidth + 1 && tab.getBoundingClientRect().height >= 44)"), 'UI-05 shows four complete 44px tabs at 320px')
for (const tab of ['overview', 'discussion', 'resources', 'recruitment']) {
  await evaluate(`document.querySelector('[data-tab=${tab}]').click()`)
  check(await evaluate(`document.querySelector('#${tab}').classList.contains('active')`), `UI-05 ${tab} tab is interactive`)
}
check(await evaluate("document.querySelectorAll('.recruitment-card').length === 4 && document.body.innerText.includes('Team Alpha') && !document.body.innerText.includes('Team Delta') && !document.body.innerText.includes('Delisted')"), 'UI-05 shows public recruitment and excludes Delisted content')
await checkBottomClearance('.recruitment-card:last-of-type', 'UI-05 final public recruitment clears fixed navigation')

await open('ui09-recruitment-detail.html', 390)
await evaluate("document.querySelector('#advisoryToggle').click();document.querySelector('#apply').click()")
check(await evaluate("document.querySelector('#matchLabel').textContent === 'No skill overlap' && document.querySelector('#matchGuidance').textContent.includes('still apply')"), 'UI-09 Not Matched guidance still permits an application')
check(await evaluate("document.querySelector('#feedback').classList.contains('visible') && document.querySelector('#feedback').textContent.includes('Pending')"), 'UI-09 apply action shows explicit example feedback')
check(await evaluate("document.querySelector('#apply').getBoundingClientRect().height >= 48"), 'UI-09 primary apply target is at least 48px')
await checkBottomClearance('#advisoryToggle', 'UI-09 final action clears fixed navigation')

await open('ui04-competition-hub.html', 390)
await evaluate("document.querySelector('.competition-card').click()")
await waitForReady()
check(await evaluate("location.pathname.endsWith('/ui05-competition-detail.html')"), 'Local UI-04 card navigates to UI-05')
await evaluate("document.querySelector('[data-tab=recruitment]').click();document.querySelector('.recruitment-card').click()")
await waitForReady()
check(await evaluate("location.pathname.endsWith('/ui09-recruitment-detail.html')"), 'Local Team Alpha link navigates from UI-05 to UI-09')
check(await evaluate("new URL(document.querySelector('a[aria-label*=Back]').href).pathname.endsWith('/ui05-competition-detail.html')"), 'UI-09 back link returns to UI-05')

socket.close()
