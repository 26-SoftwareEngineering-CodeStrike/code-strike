const [webSocketUrl, baseUrl] = process.argv.slice(2)
if (!webSocketUrl || !baseUrl) throw new Error('Usage: node scripts/verify-h5-flow.mjs <ws-url> <base-url>')

const socket = new WebSocket(webSocketUrl)
const pending = new Map()
let requestId = 0
socket.addEventListener('message', (event) => {
  const payload = JSON.parse(String(event.data)); if (!payload.id) return
  const request = pending.get(payload.id); if (!request) return
  pending.delete(payload.id); payload.error ? request.reject(new Error(payload.error.message)) : request.resolve(payload.result)
})
await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }) })
function send(method, params = {}) { requestId += 1; return new Promise((resolve, reject) => { pending.set(requestId, { resolve, reject }); socket.send(JSON.stringify({ id: requestId, method, params })) }) }
async function evaluate(expression) { const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text); return result.result.value }
const pause = (milliseconds = 500) => new Promise((resolve) => setTimeout(resolve, milliseconds))
async function hardNavigate(hashPath) { await send('Page.navigate', { url: `${baseUrl}/#${hashPath}` }); await pause(350); await send('Page.reload', { ignoreCache: true }); await pause(1800) }
async function waitFor(expression, timeout = 3500) { const started = Date.now(); while (Date.now() - started < timeout) { if (await evaluate(expression)) return true; await pause(200) } return false }
async function clickText(selector, text) { return evaluate(`(() => { const node = Array.from(document.querySelectorAll(${JSON.stringify(selector)})).find((item) => item.textContent.trim().includes(${JSON.stringify(text)})); if (!node) return false; node.click(); return true })()`)}
function check(condition, label) { if (!condition) throw new Error(`FAILED: ${label}`); console.log(`PASS: ${label}`) }

await send('Page.enable'); await send('Runtime.enable'); await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 900, screenWidth: 390, screenHeight: 900, deviceScaleFactor: 1, mobile: true }); await send('Page.reload', { ignoreCache: true }); await pause(900)

await hardNavigate('/pages/competition/detail?id=competition-demo-1&tab=Recruitment')
check((await evaluate("document.querySelectorAll('.recruitment').length")) === 4, 'public list excludes Delisted recruitment')
check(!(await evaluate("document.body.innerText.includes('Team Delta')")), 'public list does not display Delisted team')

await hardNavigate('/pages/recruitment/detail?id=team-delta')
check(await waitFor("document.body.innerText.includes('Recruitment unavailable')"), 'direct public Delisted lookup is denied')
check(!(await evaluate("document.body.innerText.includes('Team Delta Studio')")), 'direct public lookup receives no draft value')

await hardNavigate('/pages/prototype/recruitment-review?id=team-delta&actor=admin-reviewer')
check(await waitFor("document.body.innerText.includes('Design review denied')"), 'URL actor parameter does not grant design-review access')
check(!(await evaluate("document.body.innerText.includes('Team Delta Studio')")), 'denied review does not render draft value')

await hardNavigate('/pages/applications/history')
check(await clickText('.persona__button', 'Student Alex'), 'student persona can be explicitly selected')
await pause(700)
check(await evaluate("['pending','approved','rejected','withdrawn','invalidated'].every((status) => document.querySelector('.status--' + status))"), 'UI-13 renders all five distinct owner history states')
check(await evaluate("document.body.innerText.includes('Historical approval · membership ended')"), 'historical Approved is not shown as current membership')

await evaluate("document.querySelector('.browse-link').click()")
await pause(1400)
const actionReady = await waitFor("document.querySelector('.primary') !== null")
if (!actionReady) console.log(await evaluate("location.hash + '\\n' + document.body.innerText.slice(0, 600)"))
check(actionReady, 'UI-09 action renders after navigation')
await evaluate("document.querySelector('.primary').click()")
await pause(350)
check(await evaluate("document.body.innerText.includes('A Pending application already exists for this team.')"), 'cross-page state preserves existing Pending application')

await hardNavigate('/pages/captain/review')
check(await clickText('.persona__button', 'Team Alpha captain'), 'current captain persona can be explicitly selected')
await pause(700)
check((await evaluate("document.querySelectorAll('.applicant-card').length")) >= 3, 'UI-14 shows only current team Pending queue')
check(await evaluate("document.body.innerText.includes('Noah Wu') && document.querySelector('.name--not-matched') !== null"), 'non-matched applicant name is highlighted')
check(!(await evaluate("/EMAIL|WECHAT|QQ|MAJOR|ACADEMIC YEAR/.test(document.body.innerText.toUpperCase())")), 'Pending review UI contains no forbidden private-field labels')

await hardNavigate('/pages/prototype/recruitment-review?id=team-delta')
check(await waitFor("document.body.innerText.includes('Design review denied')"), 'captain of another team cannot inspect Delisted revision')
await clickText('.persona__button', 'Team Delta captain'); await pause(700)
check(await evaluate("document.body.innerText.includes('Team Delta Studio')"), 'scoped current captain can inspect isolated revision comparison')

await evaluate("document.querySelector('.public-check').click()"); await pause(1500)
check(await waitFor("document.body.innerText.includes('Recruitment unavailable')"), 'public endpoint remains denied even after privileged persona selection')

for (const width of [320, 390, 430, 680]) {
  await send('Emulation.setDeviceMetricsOverride', { width, height: 900, screenWidth: width, screenHeight: 900, deviceScaleFactor: 1, mobile: true })
  await hardNavigate('/pages/applications/history')
  await clickText('.persona__button', 'Student Alex'); await pause(650)
  await evaluate("window.scrollTo(0, document.documentElement.scrollHeight)"); await pause(300)
  const clearsNavigation = await evaluate(`(() => {
    const control = document.querySelector('.captain-link')?.getBoundingClientRect()
    const nav = document.querySelector('.nav')?.getBoundingClientRect()
    return Boolean(control && nav && control.bottom <= nav.top)
  })()`)
  check(clearsNavigation, `fixed navigation clears critical controls at ${width}px`)
}

socket.close()
