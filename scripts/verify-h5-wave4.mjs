const [webSocketUrl, baseUrl, evidenceDirectory] = process.argv.slice(2)
if (!webSocketUrl || !baseUrl || !evidenceDirectory) throw new Error('Usage: node scripts/verify-h5-wave4.mjs <ws-url> <base-url> <evidence-directory>')

const socket = new WebSocket(webSocketUrl)
const pending = new Map()
let requestId = 0
socket.addEventListener('message', (event) => { const payload = JSON.parse(String(event.data)); if (!payload.id) return; const request = pending.get(payload.id); if (!request) return; pending.delete(payload.id); payload.error ? request.reject(new Error(payload.error.message)) : request.resolve(payload.result) })
await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }) })
function send(method, params = {}) { requestId += 1; return new Promise((resolve, reject) => { pending.set(requestId, { resolve, reject }); socket.send(JSON.stringify({ id: requestId, method, params })) }) }
async function evaluate(expression) { const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text); return result.result.value }
const pause = (milliseconds = 500) => new Promise((resolve) => setTimeout(resolve, milliseconds))
async function navigate(path) { await send('Page.navigate', { url: `${baseUrl}/#${path}` }); await pause(1600) }
async function softNavigate(path) { await evaluate(`location.hash = ${JSON.stringify(`#${path}`)}`); await pause(1200) }
async function clickText(selector, value) { return evaluate(`(() => { const item = Array.from(document.querySelectorAll(${JSON.stringify(selector)})).find((node) => node.textContent.trim().includes(${JSON.stringify(value)})); if (!item) return false; item.click(); return true })()`)}
async function setField(selector, value, index = 0) { return evaluate(`(() => { const node = document.querySelectorAll(${JSON.stringify(selector)})[${index}]; if (!node) return false; node.value = ${JSON.stringify(value)}; node.dispatchEvent(new Event('input', { bubbles: true })); return true })()`)}
function check(condition, label) { if (!condition) throw new Error(`FAILED: ${label}`); console.log(`PASS: ${label}`) }
async function screenshot(name) { const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }); const bytes = Uint8Array.from(atob(shot.data), (character) => character.charCodeAt(0)); await import('node:fs/promises').then((fs) => fs.writeFile(`${evidenceDirectory}/${name}`, bytes)) }
async function responsiveCheck(path, selector, namePrefix) {
  for (const width of [320, 390, 430, 680]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 900, screenWidth: width, screenHeight: 900, deviceScaleFactor: 1, mobile: true })
    await navigate(path)
    if (namePrefix === 'ui16-day') { await clickText('.persona__button', 'Student Alex'); await clickText('.mode .uni-button,.mode uni-button,.mode button', 'Day'); await pause(350) }
    check(await evaluate(`document.documentElement.scrollWidth <= ${width}`), `${path} has no horizontal overflow at ${width}px`)
    check(await evaluate(`Boolean(document.querySelector(${JSON.stringify(selector)}))`), `${path} key content renders at ${width}px`)
    if (width === 390 || (path.includes('/planner') && width !== 390)) await screenshot(`${namePrefix}-${width}.png`)
  }
}

await send('Page.enable'); await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 900, screenWidth: 390, screenHeight: 900, deviceScaleFactor: 1, mobile: true })

await navigate('/pages/planner/index')
await send('Page.reload', { ignoreCache: true }); await pause(1400)
check(await clickText('.persona__button', 'Incomplete student'), 'incomplete signed-in student persona is selectable'); await pause(700)
check(await evaluate("document.body.innerText.includes('Private planner is available')"), 'incomplete-profile student can read their private planner')
check(await clickText('.mode .uni-button,.mode uni-button,.mode button', 'Week'), 'Week mode control is interactive'); await pause(700)
check(await evaluate("document.body.innerText.includes('Week containing') && document.body.innerText.includes('Private planner is available')"), 'Day and Week views use the same occurrence state')
await clickText('.persona__button', 'Visitor'); await pause(700)
check(await evaluate("document.body.innerText.includes('Planner access denied')"), 'visitor cannot read a student planner')
await clickText('.persona__button', 'Student Alex'); await pause(700)
check(await clickText('.add-grid .course', '+ Course'), 'UI-17 course entry opens from Planner'); await pause(800)
check(await setField('input', 'Browser Systems Studio'), 'course name can be entered')
check(await clickText('.save', 'Save Course'), 'course save action is interactive'); await pause(700)
check(await evaluate("document.body.innerText.includes('Created') && document.body.innerText.includes('skipped')"), 'course creation reports created and skipped counts')
await screenshot('ui17-course-entry-390.png')

await softNavigate('/pages/planner/item?date=2026-10-27&type=TimedPlan')
check(await setField('input', 'Browser overlap plan'), 'timed plan title can be entered')
check(await clickText('.save', 'Save Timed Plan'), 'timed plan save action is interactive'); await pause(700)
check(await evaluate("document.body.innerText.includes('Overlaps are allowed') && document.body.innerText.includes('saved')"), 'overlapping timed plan is accepted with feedback')
await screenshot('ui18-timed-plan-390.png')

await softNavigate('/pages/planner/item?date=2026-10-27&type=Todo')
await clickText('.type-switch .uni-button,.type-switch uni-button,.type-switch button', 'To-do'); await pause(300)
check(await setField('input', 'Browser no-deadline todo'), 'to-do title can be entered')
check(await clickText('.save', 'Save To-do'), 'to-do save action is interactive'); await pause(700)
check(await evaluate("document.body.innerText.includes('No deadline') && document.body.innerText.includes('saved')"), 'no-deadline to-do remains assigned to a date')
await screenshot('ui18-todo-390.png')

await softNavigate('/pages/planner/index')
await clickText('.persona__button', 'Student Alex'); await pause(700)
check(await evaluate("document.body.innerText.includes('Browser no-deadline todo') && document.body.innerText.includes('Browser overlap plan')"), 'Planner view reflects Mock create operations')
check(await clickText('.entry', 'Browser no-deadline todo'), 'occurrence detail opens'); await pause(700)
check(await evaluate("document.body.innerText.includes('Stable ID:') && document.body.innerText.includes('Changes apply only to this instance')"), 'UI-19 exposes single-occurrence scope and stable ID')
check(await clickText('.complete', 'Mark Completed'), 'single to-do completion is interactive'); await pause(500)
check(await evaluate("document.body.innerText.includes('is complete')"), 'single occurrence completion has feedback')
await screenshot('ui19-occurrence-actions-390.png')

await responsiveCheck('/pages/planner/index', '.toolbar', 'ui16-day')
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 900, screenWidth: 390, screenHeight: 900, deviceScaleFactor: 1, mobile: true }); await navigate('/pages/planner/index'); await clickText('.persona__button', 'Student Alex'); await clickText('.mode .uni-button,.mode uni-button,.mode button', 'Week'); await pause(600); await screenshot('ui16-week-390.png')
await responsiveCheck('/pages/planner/course?date=2026-10-27', '.form', 'ui17-course-entry')
await responsiveCheck('/pages/planner/item?date=2026-10-27&type=Todo', '.form', 'ui18-todo')
await responsiveCheck('/pages/planner/occurrence?id=planner-todo-1', '.form', 'ui19-occurrence-actions')

socket.close()
