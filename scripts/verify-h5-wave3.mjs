const [webSocketUrl, baseUrl] = process.argv.slice(2)
if (!webSocketUrl || !baseUrl) throw new Error('Usage: node scripts/verify-h5-wave3.mjs <ws-url> <base-url>')

const socket = new WebSocket(webSocketUrl)
const pending = new Map()
let requestId = 0
socket.addEventListener('message', (event) => { const payload = JSON.parse(String(event.data)); if (!payload.id) return; const request = pending.get(payload.id); if (!request) return; pending.delete(payload.id); payload.error ? request.reject(new Error(payload.error.message)) : request.resolve(payload.result) })
await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }) })
function send(method, params = {}) { requestId += 1; return new Promise((resolve, reject) => { pending.set(requestId, { resolve, reject }); socket.send(JSON.stringify({ id: requestId, method, params })) }) }
async function evaluate(expression) { const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text); return result.result.value }
const pause = (milliseconds = 500) => new Promise((resolve) => setTimeout(resolve, milliseconds))
async function hardNavigate(path) { await send('Page.navigate', { url: `${baseUrl}/#${path}` }); await pause(350); await send('Page.reload', { ignoreCache: true }); await pause(1900) }
async function waitFor(expression, timeout = 4000) { const started = Date.now(); while (Date.now() - started < timeout) { if (await evaluate(expression)) return true; await pause(200) } return false }
async function clickText(selector, value) { return evaluate(`(() => { const item = Array.from(document.querySelectorAll(${JSON.stringify(selector)})).find((node) => node.textContent.trim().includes(${JSON.stringify(value)})); if (!item) return false; item.click(); return true })()`)}
async function setField(selector, value) { return evaluate(`(() => { const node = document.querySelector(${JSON.stringify(selector)}); if (!node) return false; node.value = ${JSON.stringify(value)}; node.dispatchEvent(new Event('input', { bubbles: true })); return true })()`)}
async function confirmModal() { await pause(250); const clicked = await evaluate(`(() => { const primary = document.querySelector('.uni-modal__btn_primary'); if (primary) { primary.click(); return true } const button = Array.from(document.querySelectorAll('.uni-modal button,.uni-modal__btn')).find((item) => /OK|Confirm/i.test(item.textContent)); if (!button) return false; button.click(); return true })()`); await pause(800); return clicked }
function check(condition, label) { if (!condition) throw new Error(`FAILED: ${label}`); console.log(`PASS: ${label}`) }

await send('Page.enable'); await send('Runtime.enable'); await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 900, screenWidth: 390, screenHeight: 900, deviceScaleFactor: 1, mobile: true })

// UI-10: validation and successful private team creation.
await hardNavigate('/pages/teams/create')
await clickText('.persona__button', 'Incomplete student'); await pause(600)
await setField('input', 'Blocked Team'); await setField('textarea', 'This submission must be rejected for an incomplete profile.')
await clickText('.primary', 'Create Team'); await pause(600)
check(await evaluate("document.body.innerText.includes('Complete the student profile')"), 'UI-10 blocks incomplete profile')
await clickText('.persona__button', 'Student Alex'); await pause(500)
await setField('input', 'Signal Forge'); await setField('textarea', 'A fictional cross-major prototype team.')
await clickText('.primary', 'Create Team'); await pause(700)
check(await evaluate("document.body.innerText.includes('Team created privately')"), 'UI-10 creates private team with explicit feedback')
check(await clickText('.view-teams', 'View My Teams'), 'UI-10 success action is reachable'); await pause(1300)
if (!(await evaluate("document.body.innerText.includes('Signal Forge')"))) console.log(await evaluate("location.hash + '\\n' + document.body.innerText.slice(0, 900)"))
check(await evaluate("document.body.innerText.includes('Signal Forge') && document.body.innerText.includes('CAPTAIN') && document.body.innerText.includes('PRIVATE')"), 'created team immediately appears with Captain Active membership')

// UI-12 and P0: revision is isolated and dynamically delists public list/detail.
await hardNavigate('/pages/teams/index')
await clickText('.persona__button', 'Team Alpha captain'); await pause(700)
check(await clickText('.manage-recruitment', 'Manage recruitment'), 'My Teams recruitment action is reachable'); await pause(1300)
if (!(await evaluate("document.body.innerText.includes('EFFECTIVE SETTINGS')"))) console.log(await evaluate("location.hash + '\\n' + document.body.innerText.slice(0, 900)"))
check(await evaluate("document.body.innerText.includes('EFFECTIVE SETTINGS') && document.body.innerText.includes('Team Alpha')"), 'UI-12 loads current Effective settings')
await setField('input', 'Team Alpha Next'); await setField('textarea', 'A pending revision that must not become public yet.')
await clickText('.submit', 'Submit for Review'); check(await confirmModal(), 'revision confirmation is interactive')
check(await evaluate("document.body.innerText.includes('DELISTED') && document.body.innerText.includes('Team Alpha Next') && document.body.innerText.includes('Team Alpha')"), 'revision stays separate and marks recruitment Delisted')
await clickText('.nav__item', 'Competitions'); await pause(1200)
await evaluate("document.querySelector('.card').click()"); await pause(1100)
await clickText('.tabs__item', 'Recruitment'); await pause(350)
check((await evaluate("document.querySelectorAll('.recruitment').length")) === 3, 'dynamic public list removes newly Delisted Team Alpha')
check(!(await evaluate("document.body.innerText.includes('Team Alpha')")), 'public list receives no Delisted effective or draft content')
await evaluate("location.hash = '#/pages/recruitment/detail?id=team-alpha'"); await pause(1500)
check(await waitFor("document.body.innerText.includes('Recruitment unavailable')"), 'dynamic public detail immediately rejects newly Delisted Team Alpha')
check(!(await evaluate("document.body.innerText.includes('Team Alpha Next')")), 'public detail receives no pending draft')

// UI-15: contact boundary, captain leave guard and immediate transfer.
await hardNavigate('/pages/teams/operations?id=team-alpha')
await clickText('.persona__button', 'Team Alpha captain'); await pause(750)
check(await evaluate("document.body.innerText.includes('CAPTAIN-ONLY CURRENT CONTACT')"), 'current captain receives separate current-member contact response')
check(!(await evaluate("document.body.innerText.toUpperCase().includes('EMAIL')")), 'team operations never exposes email')
await clickText('.blocked', 'Try to Leave as Captain'); check(await confirmModal(), 'captain leave confirmation is interactive')
check(await evaluate("document.body.innerText.includes('Captain cannot leave directly')"), 'captain direct leave is rejected')
check(await clickText('.transfer', 'Transfer Captain'), 'captain transfer action is reachable'); check(await confirmModal(), 'captain transfer confirmation is interactive')
if (!(await evaluate("document.body.innerText.includes('Captaincy transferred immediately')"))) console.log(await evaluate("document.body.innerText.slice(0, 1200)"))
check(await evaluate("document.body.innerText.includes('Captaincy transferred immediately') && document.body.innerText.includes('Leave Team')"), 'old captain immediately loses captain controls and becomes member')
check(!(await evaluate("document.body.innerText.includes('CAPTAIN-ONLY CURRENT CONTACT')")), 'former captain immediately loses contact access')
check(await clickText('.persona__button', 'Team Alpha member'), 'new captain persona remains selectable'); await pause(900)
if (!(await evaluate("document.body.innerText.includes('Captain controls')"))) console.log(await evaluate("document.body.innerText.slice(0, 1200)"))
check(await evaluate("document.body.innerText.includes('Captain controls') && document.body.innerText.includes('CAPTAIN-ONLY CURRENT CONTACT')"), 'new captain immediately gains management and contact permissions')
await clickText('.dissolve', 'Dissolve Team'); check(await confirmModal(), 'dissolution confirmation is interactive')
check(await waitFor("document.body.innerText.includes('Team access unavailable')"), 'dissolution ends active private team access')
await clickText('.state__action', 'Return to My Teams'); await pause(1200)
check(await evaluate("document.body.innerText.includes('Past teams') && document.body.innerText.includes('DISSOLVED')"), 'dissolved team remains as concise owner history')

// Ordinary member leave ends membership and does not retain private access.
await hardNavigate('/pages/teams/operations?id=team-alpha')
await clickText('.persona__button', 'Team Alpha member'); await pause(700)
await clickText('.leave', 'Leave Team'); check(await confirmModal(), 'ordinary member leave confirmation is interactive')
check(await waitFor("document.body.innerText.includes('Team access unavailable')"), 'ordinary member loses team access immediately after leaving')

// Isolated admin moderation cannot be triggered by captain URL parameters.
await hardNavigate('/pages/prototype/recruitment-review?id=team-delta&actor=admin-reviewer')
check(await waitFor("document.body.innerText.includes('Design review denied')"), 'URL parameter cannot grant Wave 3 moderation access')
await clickText('.persona__button', 'Team Delta captain'); await pause(700)
check(await evaluate("document.body.innerText.includes('Team Delta Studio') && !document.body.innerText.includes('Approve Draft')"), 'captain can inspect but cannot approve own draft')
await clickText('.persona__button', 'Admin reviewer'); await pause(700)
check(await evaluate("document.body.innerText.includes('Approve Draft') && document.body.innerText.includes('Reject Draft')"), 'explicit admin persona receives isolated moderation controls')
await clickText('.moderation .approve', 'Approve Draft'); check(await confirmModal(), 'admin approval confirmation is interactive')
check(await evaluate("document.body.innerText.includes('PUBLISHED') && !document.body.innerText.includes('DRAFT ISOLATED')"), 'approved exact draft becomes Effective Published version')
await clickText('.public-check', 'Open public detail'); await pause(1300)
check(await evaluate("document.body.innerText.includes('Team Delta Studio') && document.body.innerText.includes('Applications open') && document.querySelector('.primary') !== null"), 'approved effective version is immediately public and open for application')

// Rejected recruitment cannot be approved again until the current captain resubmits it.
await hardNavigate('/pages/teams/recruitment?id=team-alpha')
await clickText('.persona__button', 'Team Alpha captain'); await pause(700)
await setField('input', 'Rejected Browser Draft'); await setField('textarea', 'This rejected draft must require a new captain submission.')
await clickText('.submit', 'Submit for Review'); check(await confirmModal(), 'rejection-path draft submission is interactive')
await evaluate("location.hash = '#/pages/prototype/recruitment-review?id=team-alpha'"); await pause(1400)
await clickText('.persona__button', 'Admin reviewer'); await pause(700)
await clickText('.moderation .reject', 'Reject Draft'); check(await confirmModal(), 'admin rejection confirmation is interactive')
check(await evaluate("document.body.innerText.includes('REJECTED') && document.body.innerText.includes('Rejected Browser Draft')"), 'rejected draft and decision remain visible in isolated review')
check(await evaluate("!document.body.innerText.includes('Approve Draft') && document.body.innerText.includes('must resubmit')"), 'rejected revision has no direct approval action')
await clickText('.persona__button', 'Team Alpha captain'); await pause(600)
await evaluate("location.hash = '#/pages/teams/recruitment?id=team-alpha'"); await pause(1400)
await setField('input', 'Resubmitted Browser Draft'); await setField('textarea', 'A new reviewable revision submitted by the current captain.')
await clickText('.submit', 'Submit for Review'); check(await confirmModal(), 'captain resubmission after rejection is interactive')
await evaluate("location.hash = '#/pages/prototype/recruitment-review?id=team-alpha'"); await pause(1400)
await clickText('.persona__button', 'Admin reviewer'); await pause(700)
check(await evaluate("document.body.innerText.includes('Approve Draft') && document.body.innerText.includes('Resubmitted Browser Draft')"), 'resubmitted revision enters a new reviewable state')
await clickText('.moderation .approve', 'Approve Draft'); check(await confirmModal(), 'resubmitted revision approval is interactive')
check(await evaluate("document.body.innerText.includes('PUBLISHED') && document.body.innerText.includes('Resubmitted Browser Draft')"), 'resubmitted revision can be approved successfully')

// Critical bottom actions remain reachable at required responsive widths.
for (const width of [320, 390, 430, 680]) {
  await send('Emulation.setDeviceMetricsOverride', { width, height: 900, screenWidth: width, screenHeight: 900, deviceScaleFactor: 1, mobile: true })
  await hardNavigate('/pages/teams/index')
  await clickText('.persona__button', 'Team Alpha captain'); await pause(650)
  await evaluate("window.scrollTo(0, document.documentElement.scrollHeight)"); await pause(250)
  const clear = await evaluate(`(() => { const control = document.querySelector('.global-actions')?.getBoundingClientRect(); const nav = document.querySelector('.nav')?.getBoundingClientRect(); return Boolean(control && nav && control.bottom <= nav.top) })()`)
  check(clear, `Wave 3 Teams controls clear fixed navigation at ${width}px`)
}

socket.close()
