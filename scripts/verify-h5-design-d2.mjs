const [webSocketUrl, baseUrl, evidenceDirectory] = process.argv.slice(2)
if (!webSocketUrl || !baseUrl || !evidenceDirectory) throw new Error('Usage: node scripts/verify-h5-design-d2.mjs <ws-url> <base-url> <evidence-directory>')

const socket = new WebSocket(webSocketUrl)
const pending = new Map()
let requestId = 0
socket.addEventListener('message', (event) => { const payload = JSON.parse(String(event.data)); if (!payload.id) return; const request = pending.get(payload.id); if (!request) return; pending.delete(payload.id); payload.error ? request.reject(new Error(payload.error.message)) : request.resolve(payload.result) })
await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }) })
function send(method, params = {}) { requestId += 1; return new Promise((resolve, reject) => { pending.set(requestId, { resolve, reject }); socket.send(JSON.stringify({ id: requestId, method, params })) }) }
async function evaluate(expression) { const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text); return result.result.value }
const pause = (milliseconds = 500) => new Promise((resolve) => setTimeout(resolve, milliseconds))
async function navigate(path) { await send('Page.navigate', { url: `${baseUrl}/#${path}` }); await pause(350); await send('Page.reload', { ignoreCache: true }); await pause(1300) }
async function route(path) { await evaluate(`location.hash=${JSON.stringify(path)}`); await pause(900) }
async function clickText(selector, value) { return evaluate(`(() => { const item = Array.from(document.querySelectorAll(${JSON.stringify(selector)})).find((node) => node.textContent.trim().includes(${JSON.stringify(value)})); if (!item) return false; item.click(); return true })()`)}
async function waitFor(expression, timeout = 3500) { const started=Date.now(); while(Date.now()-started<timeout){ if(await evaluate(expression)) return true; await pause(180) } return false }
function check(condition, label) { if (!condition) throw new Error(`FAILED: ${label}`); console.log(`PASS: ${label}`) }
async function screenshot(name) { const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false, fromSurface: true }); const bytes = Uint8Array.from(atob(shot.data), (character) => character.charCodeAt(0)); await import('node:fs/promises').then((fs) => fs.writeFile(`${evidenceDirectory}/${name}`, bytes)) }

async function selectActor(actor) {
  check(await evaluate(`(() => { const trigger = document.querySelector('.header__demo'); if (!trigger) return false; trigger.click(); return true })()`), `Prototype Lab opens for ${actor}`)
  await pause(180)
  check(await clickText('.persona__button', actor), `${actor} is explicitly selectable`)
  await pause(450)
  check(await evaluate(`(() => { const close = document.querySelector('.persona__close'); if (!close) return false; close.click(); return true })()`), 'Prototype Lab closes explicitly')
  await pause(180)
}

async function ensureStudentActor() {
  await navigate('/pages/applications/history')
  await selectActor('Student Alex')
}

const pages = [
  { id:'ui10', path:'/pages/teams/create', key:'.form-card', last:'.primary', actor:'Student Alex', align:'.intro,.notice,.form-card' },
  { id:'ui12', path:'/pages/teams/recruitment?id=team-alpha', key:'.editor', last:'.submit', actor:'Team Alpha captain', align:'.state-card,.version-card,.editor' },
  { id:'ui15', path:'/pages/teams/operations?id=team-alpha', key:'.team-card', last:'.captain-zone .dissolve', actor:'Team Alpha captain', align:'.team-card,.privacy,.member-card,.captain-zone' },
  { id:'ui13', path:'/pages/applications/history', key:'.history', last:'.captain-link', actor:'Student Alex', align:'.intro,.application-card,.browse-link,.captain-link' },
  { id:'ui14', path:'/pages/captain/review?id=team-alpha', key:'.queue', last:'.applicant-card:last-child .actions', actor:'Team Alpha captain', align:'.privacy-note,.applicant-card' },
  { id:'ui17', path:'/pages/planner/course?date=2026-10-27', key:'.form', last:'.save', student:true, align:'.intro,.notice,.form' },
  { id:'ui18', path:'/pages/planner/item?date=2026-10-27&type=Todo', key:'.form', last:'.actions', student:true, align:'.intro,.type-switch,.notice,.form' },
  { id:'ui19', path:'/pages/planner/occurrence?id=planner-todo-1', key:'.form', last:'.delete', student:true, align:'.form' },
  { id:'review', path:'/pages/prototype/recruitment-review?id=team-delta', key:'.review', last:'.public-check', actor:'Admin reviewer', align:'.boundary,.review,.public-check' },
]

await send('Page.enable')
await send('Runtime.enable')
if (process.argv.includes('--touch-only')) {
  await send('Emulation.setDeviceMetricsOverride', { width:390, height:900, screenWidth:390, screenHeight:900, deviceScaleFactor:1, mobile:true })
  await navigate('/pages/prototype/recruitment-review?id=team-delta')
  await selectActor('Admin reviewer')
  const audit = await evaluate(`Array.from(document.querySelectorAll('.uni-button,uni-button,button')).map((node)=>[node.className,Math.round(node.getBoundingClientRect().height*10)/10]).filter(([,height])=>height>0)`)
  check(audit.length>0 && audit.every(([,height])=>height>=44), `Visible actions meet the 44px touch target (${JSON.stringify(audit)})`)
  socket.close()
  process.exit(0)
}
for (const width of [320,390,430,680]) {
  await send('Emulation.setDeviceMetricsOverride', { width, height:900, screenWidth:width, screenHeight:900, deviceScaleFactor:1, mobile:true })
  for (const page of pages) {
    if (page.student) { await ensureStudentActor(); await route(page.path) }
    else await navigate(page.path)
    if (page.actor) await selectActor(page.actor)
    check(await evaluate(`document.documentElement.scrollWidth <= ${width}`), `${page.id} has no horizontal overflow at ${width}px`)
    check(await waitFor(`Boolean(document.querySelector(${JSON.stringify(page.key)}))`), `${page.id} primary content renders at ${width}px`)
    const audit = await evaluate(`(() => { const content=document.querySelector('.content'); const style=content&&getComputedStyle(content); const items=Array.from(document.querySelectorAll(${JSON.stringify(page.align)})); return { padding:style?[parseFloat(style.paddingLeft),parseFloat(style.paddingRight)]:[0,0], rects:items.map((item)=>{const rect=item.getBoundingClientRect();return [Math.round(rect.left),Math.round(rect.right)]}) } })()`)
    check(audit.padding.every((value)=>value>=15) && audit.rects.length>0 && audit.rects.every(([left,right])=>left>=14 && right<=width-14), `${page.id} keeps the D1 alignment line at ${width}px (${JSON.stringify(audit)})`)
    await evaluate('window.scrollTo(0,document.documentElement.scrollHeight)'); await pause(200)
    check(await evaluate(`(() => { const item=document.querySelector(${JSON.stringify(page.last)})?.getBoundingClientRect(); const nav=document.querySelector('.nav')?.getBoundingClientRect(); return Boolean(item && (nav ? item.bottom <= nav.top + 1 : item.bottom <= innerHeight + 1)) })()`), `${page.id} final action remains reachable at ${width}px`)
    if (width===390) { await evaluate('window.scrollTo(0,0)'); await pause(160); await screenshot(`${page.id}-390.png`) }
  }
}

const touchAudit = await evaluate(`Array.from(document.querySelectorAll('.uni-button,uni-button,button')).map((node)=>[node.className,Math.round(node.getBoundingClientRect().height*10)/10]).filter(([,height])=>height>0)`)
check(touchAudit.length>0 && touchAudit.every(([,height])=>height>=44), `Visible actions meet the 44px touch target on the final review page (${JSON.stringify(touchAudit)})`)
socket.close()
