const [webSocketUrl, baseUrl, evidenceDirectory] = process.argv.slice(2)
if (!webSocketUrl || !baseUrl || !evidenceDirectory) throw new Error('Usage: node scripts/verify-t3-h5-auth.mjs <ws-url> <base-url> <evidence-directory>')

const socket = new WebSocket(webSocketUrl)
const pending = new Map()
let requestId = 0
socket.addEventListener('message', (event) => { const payload = JSON.parse(String(event.data)); if (!payload.id) return; const request = pending.get(payload.id); if (!request) return; pending.delete(payload.id); payload.error ? request.reject(new Error(payload.error.message)) : request.resolve(payload.result) })
await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }) })
function send(method, params = {}) { requestId += 1; return new Promise((resolve, reject) => { pending.set(requestId, { resolve, reject }); socket.send(JSON.stringify({ id: requestId, method, params })) }) }
async function evaluate(expression) { const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text); return result.result.value }
const pause = (milliseconds = 500) => new Promise((resolve) => setTimeout(resolve, milliseconds))
async function navigate(path) { await send('Page.navigate', { url: `${baseUrl}/#${path}` }); await send('Page.reload', { ignoreCache: true }); await pause(1800) }
async function clickText(selector, value) { return evaluate(`(() => { const item = Array.from(document.querySelectorAll(${JSON.stringify(selector)})).find((node) => node.textContent.trim().includes(${JSON.stringify(value)})); if (!item) return false; item.click(); return true })()`) }
async function setInput(placeholder, value) { return evaluate(`(() => { const host = Array.from(document.querySelectorAll('uni-input, uni-textarea')).find((node) => { const label = node.querySelector('.uni-input-placeholder, .uni-textarea-placeholder'); return label && label.textContent.includes(${JSON.stringify(placeholder)}) }); if (!host) return false; const field = host.querySelector('input, textarea'); if (!field) return false; field.value = ${JSON.stringify(value)}; field.dispatchEvent(new Event('input', { bubbles: true })); field.dispatchEvent(new Event('change', { bubbles: true })); return true })()`) }
function check(condition, label) { if (!condition) throw new Error(`FAILED: ${label}`); console.log(`PASS: ${label}`) }
async function screenshot(name) { const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }); const bytes = Uint8Array.from(atob(shot.data), (character) => character.charCodeAt(0)); await import('node:fs/promises').then((fs) => fs.writeFile(`${evidenceDirectory}/${name}`, bytes)) }
const text = () => evaluate('document.body.innerText')

await send('Page.enable'); await send('Runtime.enable')
await send('Network.enable'); await send('Network.setCacheDisabled', { cacheDisabled: true })
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 900, screenWidth: 390, screenHeight: 900, deviceScaleFactor: 1, mobile: true })

const username = `t3ui_${Date.now().toString(36)}`
const password = `T3-ui-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`
console.log(`=== T3 H5 ACCOUNT FLOW (${username}) ===`)

await navigate('/pages/auth/login')
check((await text()).includes('Welcome back'), 'the sign-in page renders')
check(await evaluate('document.documentElement.scrollWidth <= 390'), 'the sign-in page has no horizontal overflow at 390px')
await screenshot('t3-01-login.png')

await navigate('/pages/auth/register')
check((await text()).includes('Join CodeStrike'), 'the registration page renders')
await screenshot('t3-02-register.png')

check(await setInput('e.g. orbit_captain', username), 'the username field accepts the account name')
check(await setInput('At least 10 characters', password), 'the password field accepts the password')
check(await setInput('Repeat your password', password), 'the confirmation field accepts the password')
await pause(300)
check(await clickText('uni-button, button', 'Create account'), 'the registration button is pressed')
await pause(2500)

const afterRegister = await text()
check(afterRegister.includes(username), 'the account is created and the profile page shows the username')
check(afterRegister.includes('Profile is not complete yet'), 'a fresh profile is reported as incomplete')
await screenshot('t3-03-profile-empty.png')

check(await setInput('Your real name', 'Alex Chen'), 'the name field accepts a value')
check(await setInput('Your college or school', 'School of Computer Science'), 'the college field accepts a value')
check(await setInput('Your major', 'Software Engineering'), 'the major field accepts a value')
check(await setInput('e.g. 2026', '2026'), 'the academic year field accepts a value')
check(await setInput('Optional for your cohort', 'Female'), 'the sex field accepts a value')
check(await setInput('A short introduction a captain can read.', 'Built two course projects and led a campus navigation prototype.'), 'the brief CV field accepts a value')
check(await setInput('Needed with a QQ ID for contact', 'alex_wechat_demo'), 'the WeChat field accepts a value')
await pause(300)

check(await clickText('.skills uni-button, .skills button', 'Python'), 'a skill tag is selected')
await pause(300)
await screenshot('t3-04-profile-filled.png')

check(await clickText('uni-button, button', 'Save profile'), 'the save button is pressed')
await pause(2500)
const afterSave = await text()
check(afterSave.includes('Profile saved'), 'the save is confirmed on screen')
check(afterSave.includes('Profile is complete'), 'the profile is reported as complete after saving')
await screenshot('t3-05-profile-saved.png')

await navigate('/pages/profile/index')
const afterReload = await text()
check(afterReload.includes(username), 'the session survives a reload of the profile page')
check(afterReload.includes('Profile is complete'), 'the profile is still complete after the reload')
await screenshot('t3-06-profile-after-reload.png')

check(await clickText('uni-button, button', 'Sign out'), 'the sign-out button is pressed')
await pause(2000)
check((await text()).includes('Welcome back'), 'signing out returns to the sign-in page')
await screenshot('t3-07-signed-out.png')

console.log('--- T3 H5 ACCOUNT FLOW COMPLETE ---')
process.exit(0)
