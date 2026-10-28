const [webSocketUrl, baseUrl, evidenceDirectory] = process.argv.slice(2)
if (!webSocketUrl || !baseUrl || !evidenceDirectory) throw new Error('Usage: node scripts/verify-h5-design-d1.mjs <ws-url> <base-url> <evidence-directory>')

const socket = new WebSocket(webSocketUrl)
const pending = new Map()
let requestId = 0
socket.addEventListener('message', (event) => { const payload = JSON.parse(String(event.data)); if (!payload.id) return; const request = pending.get(payload.id); if (!request) return; pending.delete(payload.id); payload.error ? request.reject(new Error(payload.error.message)) : request.resolve(payload.result) })
await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }) })
function send(method, params = {}) { requestId += 1; return new Promise((resolve, reject) => { pending.set(requestId, { resolve, reject }); socket.send(JSON.stringify({ id: requestId, method, params })) }) }
async function evaluate(expression) { const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text); return result.result.value }
const pause = (milliseconds = 500) => new Promise((resolve) => setTimeout(resolve, milliseconds))
async function navigate(path) { await send('Page.navigate', { url: `${baseUrl}/#${path}` }); await pause(350); await send('Page.reload', { ignoreCache: true }); await pause(1500) }
async function clickText(selector, value) { return evaluate(`(() => { const item = Array.from(document.querySelectorAll(${JSON.stringify(selector)})).find((node) => node.textContent.trim().includes(${JSON.stringify(value)})); if (!item) return false; item.click(); return true })()`) }
async function waitFor(expression, timeout = 3500) { const started = Date.now(); while (Date.now() - started < timeout) { if (await evaluate(expression)) return true; await pause(180) } return false }
function check(condition, label) { if (!condition) throw new Error(`FAILED: ${label}`); console.log(`PASS: ${label}`) }
async function screenshot(name) { const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false, fromSurface: true }); const bytes = Uint8Array.from(atob(shot.data), (character) => character.charCodeAt(0)); await import('node:fs/promises').then((fs) => fs.writeFile(`${evidenceDirectory}/${name}`, bytes)) }

const pages = [
  { id: 'ui04', path: '/pages/index/index', key: '.search-box', alignment: '.hero,.search-box,.competition-grid .card:first-child', last: '.competition-grid .card:last-child' },
  { id: 'ui05', path: '/pages/competition/detail?id=competition-demo-1', key: '.tabs', alignment: '.identity,.tabs,.next-card', last: '.recruitment:last-child' },
  { id: 'ui09', path: '/pages/recruitment/detail?id=team-alpha', key: '.details-panel', alignment: '.hero,.apply-panel,.details-panel', last: '.details-panel', actor: 'Student Alex', cta: '.primary' },
  { id: 'ui11', path: '/pages/teams/index', key: '.section-head', alignment: '.intro,.team-card,.history-card,.global-actions', last: '.global-actions', actor: 'Team Alpha captain', cta: '.global-actions' },
  { id: 'ui16', path: '/pages/planner/index', key: '.toolbar', alignment: '.planner-head,.toolbar,.timeline,.add-grid', last: '.add-grid', actor: 'Student Alex', cta: '.add-grid' },
]

async function openLabAndSelect(actor) {
  check(await evaluate(`(() => { const trigger = document.querySelector('.header__demo'); if (!trigger) return false; trigger.click(); return true })()`), 'Prototype Lab has a consistent explicit header entry')
  check(await waitFor(`(() => { const panel = document.querySelector('.persona-overlay'); return Boolean(panel && getComputedStyle(panel).display !== 'none') })()`), 'Prototype Lab opens as a separate surface')
  check(await evaluate(`document.querySelector('.persona--sheet')?.innerText.includes('not authentication')`), 'Prototype Lab states that actor switching is not authentication')
  if (actor) check(await clickText('.persona__button', actor), `${actor} remains explicitly selectable`)
  await pause(300)
  check(await evaluate(`(() => { const close = document.querySelector('.persona__close'); if (!close) return false; close.click(); return true })()`), 'Prototype Lab has an explicit close control')
  check(await waitFor(`(() => { const panel = document.querySelector('.persona-overlay'); return !panel || getComputedStyle(panel).display === 'none' })()`), 'Prototype Lab closes without covering product content')
}

await send('Page.enable')
await send('Runtime.enable')
for (const width of [320, 390, 430, 680]) {
  await send('Emulation.setDeviceMetricsOverride', { width, height: 900, screenWidth: width, screenHeight: 900, deviceScaleFactor: 1, mobile: true })
  for (const page of pages) {
    await navigate(page.path)
    if (page.actor) { await openLabAndSelect(page.actor); await pause(450) }
    const overflowAudit = await evaluate(`(() => ({ page: [document.documentElement.clientWidth, document.documentElement.scrollWidth], offenders: Array.from(document.querySelectorAll('body *')).filter((node) => { const rect = node.getBoundingClientRect(); return rect.right > innerWidth + 1 || rect.left < -1 }).slice(0,5).map((node) => [node.tagName, node.className, Math.round(node.getBoundingClientRect().left), Math.round(node.getBoundingClientRect().right)]) }))()`)
    check(overflowAudit.page[1] <= width, `${page.id} has no horizontal overflow at ${width}px (${JSON.stringify(overflowAudit)})`)
    check(await evaluate(`Boolean(document.querySelector(${JSON.stringify(page.key)}))`), `${page.id} primary content renders at ${width}px`)
    const alignmentAudit = await evaluate(`(() => { const content = document.querySelector('.content'); const style = content && getComputedStyle(content); const items = Array.from(document.querySelectorAll(${JSON.stringify(page.alignment)})); return { padding: style ? [parseFloat(style.paddingLeft), parseFloat(style.paddingRight)] : [0,0], rects: items.map((item) => { const rect = item.getBoundingClientRect(); return [Math.round(rect.left), Math.round(rect.right)] }) } })()`)
    check(alignmentAudit.padding.every((value) => value >= 15) && alignmentAudit.rects.length > 0 && alignmentAudit.rects.every(([left, right]) => left >= 14 && right <= width - 14), `${page.id} keeps a consistent content alignment line at ${width}px (${JSON.stringify(alignmentAudit)})`)
    check(await evaluate("Boolean(document.querySelector('.nav__item--active'))"), `${page.id} has a clear active navigation item at ${width}px`)
    const navAudit = await evaluate(`(() => { const items = Array.from(document.querySelectorAll('.nav__item')); return { labels: items.map((item) => item.querySelector('.nav__label')?.textContent.trim()), icons: items.map((item) => { const rect = item.querySelector('.nav__icon')?.getBoundingClientRect(); return rect ? [rect.width, rect.height] : null }) } })()`)
    check(navAudit.labels.join('|') === 'Competitions|Teams|Planner|Me' && navAudit.icons.length === 4 && navAudit.icons.every(([iconWidth, iconHeight]) => iconWidth >= 20 && iconHeight >= 20), `${page.id} has meaningful icons and text labels at ${width}px (${JSON.stringify(navAudit)})`)
    if (page.cta) check(await evaluate(`Boolean(document.querySelector(${JSON.stringify(page.cta)}))`), `${page.id} main action is present at ${width}px`)
    if (page.id === 'ui05') {
      const tabAudit = await evaluate(`(() => Array.from(document.querySelectorAll('.tabs__item')).map((tab) => { const rect = tab.getBoundingClientRect(); return [tab.textContent.trim(), Math.round(rect.left), Math.round(rect.right), tab.clientWidth, tab.scrollWidth] }))()`)
      check(tabAudit.length === 4 && tabAudit.every(([, left, right, clientWidth, scrollWidth]) => left >= 0 && right <= width && scrollWidth <= clientWidth), `UI-05 exposes all four complete tab labels at ${width}px (${JSON.stringify(tabAudit)})`)
      check(await clickText('.tabs__item', 'Recruitment'), `UI-05 Recruitment tab is reachable at ${width}px`)
      check(await waitFor(`document.body.innerText.includes('Recruiting teams')`), `UI-05 Recruitment content is available at ${width}px`)
    }
    await evaluate('window.scrollTo(0, document.documentElement.scrollHeight)'); await pause(220)
    check(await evaluate(`(() => { const item = document.querySelector(${JSON.stringify(page.last)})?.getBoundingClientRect(); const nav = document.querySelector('.nav')?.getBoundingClientRect(); return Boolean(item && nav && item.bottom <= nav.top + 1) })()`), `${page.id} bottom content clears navigation at ${width}px`)
    if (width === 390) { await evaluate('window.scrollTo(0,0)'); await pause(180); await screenshot(`${page.id}-after-390.png`) }
  }
}

await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 900, screenWidth: 390, screenHeight: 900, deviceScaleFactor: 1, mobile: true })
await navigate('/pages/index/index')
check(await evaluate(`(() => { const input = document.querySelector('.search-box__input input') || document.querySelector('.search-box__input'); if (!input) return false; input.value = 'not-a-real-competition'; input.dispatchEvent(new Event('input', { bubbles: true })); return true })()`), 'UI-04 search can be edited')
check(await waitFor("document.body.innerText.includes('No matching competitions')"), 'UI-04 empty search state is visible')
await navigate('/pages/index/index')
check(await evaluate(`(() => { const trigger = document.querySelector('.header__demo'); if (!trigger) return false; trigger.click(); return true })()`), 'UI-04 Prototype Lab requires explicit opening')
check(await waitFor(`Boolean(document.querySelector('.prototype-sheet'))`), 'UI-04 Prototype Lab surface is visible')
check(await clickText('.prototype-sheet__action', 'Simulate failure'), 'UI-04 failure state control remains available')
check(await waitFor("document.body.innerText.includes('Competition feed unavailable')"), 'UI-04 error state is visible')

await navigate('/pages/planner/index')
await openLabAndSelect('Student Alex'); await pause(500)
check(await clickText('.mode .uni-button,.mode uni-button,.mode button', 'Week'), 'UI-16 Week mode remains interactive'); await pause(400)
check(await evaluate("document.querySelector('.mode .active')?.textContent.includes('Week')"), 'UI-16 selected mode is visually clear')
check(await evaluate(`(() => { const entry = document.querySelector('.entry:last-child')?.getBoundingClientRect(); const additions = document.querySelector('.add-grid')?.getBoundingClientRect(); const nav = document.querySelector('.nav')?.getBoundingClientRect(); return Boolean(entry && additions && nav && entry.bottom <= nav.top && additions.bottom <= nav.top) })()`), 'UI-16 last occurrence and add controls clear bottom navigation')
check((await evaluate("Math.min(...Array.from(document.querySelectorAll('.mode .uni-button,.mode uni-button,.date-row .uni-button,.date-row uni-button,.add-grid .uni-button,.add-grid uni-button,.entry__complete,.nav__item,.header__icon')).map((node) => node.getBoundingClientRect().height).filter(Boolean))")) >= 44, 'Primary navigation and planner controls meet the 44px touch target')

socket.close()
