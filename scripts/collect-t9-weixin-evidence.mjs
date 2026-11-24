/**
 * Collects the WeChat mini program readiness evidence that can be produced
 * without the WeChat Developer Tools.
 *
 * The WeChat Developer Tools are not installed on this machine, so the mini
 * program itself cannot be started and no mini program screen can be captured.
 * The screens in this run come from the H5 production bundle, which is the
 * same application source and the same API, but a different rendering
 * platform. Every capture carries a banner that says so on the image itself,
 * so a picture is never mistaken for a mini program screenshot.
 *
 * Usage:
 *   node scripts/collect-t9-weixin-evidence.mjs <ws-url> <h5-base-url> <evidence-dir> <api-base-url>
 */
const [webSocketUrl, baseUrl, evidenceDirectory, apiBaseUrl] = process.argv.slice(2)
if (!webSocketUrl || !baseUrl || !evidenceDirectory || !apiBaseUrl) {
  throw new Error('Usage: node scripts/collect-t9-weixin-evidence.mjs <ws-url> <h5-base-url> <evidence-directory> <api-base-url>')
}

const socket = new WebSocket(webSocketUrl)
const pending = new Map()
const apiCalls = new Map()
let requestId = 0

socket.addEventListener('message', (event) => {
  const payload = JSON.parse(String(event.data))
  if (payload.method === 'Network.requestWillBeSent' && payload.params.request.url.includes('/api/v1/')) {
    apiCalls.set(payload.params.requestId, {
      method: payload.params.request.method,
      url: payload.params.request.url,
    })
  }
  if (payload.method === 'Network.responseReceived' && payload.params.response.url.includes('/api/v1/')) {
    const known = apiCalls.get(payload.params.requestId) ?? {}
    apiCalls.set(payload.params.requestId, { ...known, status: payload.params.response.status })
  }
  if (payload.method === 'Network.loadingFinished' && apiCalls.has(payload.params.requestId)) {
    const call = apiCalls.get(payload.params.requestId)
    console.log(`API ${call.status ?? ''} ${call.method} ${call.url.replace(apiBaseUrl, '')}`)
    apiCalls.delete(payload.params.requestId)
  }
  if (!payload.id) return
  const request = pending.get(payload.id)
  if (!request) return
  pending.delete(payload.id)
  payload.error
    ? request.reject(new Error(`${request.method}: ${payload.error.message}`))
    : request.resolve(payload.result)
})

await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true })
  socket.addEventListener('error', reject, { once: true })
})

function send(method, params = {}) {
  requestId += 1
  return new Promise((resolve, reject) => {
    pending.set(requestId, { resolve, reject, method })
    socket.send(JSON.stringify({ id: requestId, method, params }))
  })
}

async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text)
  }
  return result.result.value
}

const pause = (milliseconds = 400) => new Promise((resolve) => setTimeout(resolve, milliseconds))

async function screenshot(name) {
  // The viewport only: the competition list is long, and a capture of the
  // whole page would be unreadable as evidence.
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  const bytes = Uint8Array.from(atob(shot.data), (character) => character.charCodeAt(0))
  await import('node:fs/promises').then((fs) => fs.writeFile(`${evidenceDirectory}/${name}`, bytes))
  console.log(`captured ${name}`)
}

async function navigate(path) {
  await send('Page.navigate', { url: `${baseUrl}/?build=${Date.now()}#${path}` })
  const deadline = Date.now() + 25000
  while (Date.now() < deadline) {
    const rendered = await evaluate('document.body ? document.body.textContent.trim().length : 0')
    if (rendered > 40) return
    await pause(400)
  }
}

async function waitForText(needle, timeoutMs = 25000) {
  const deadline = Date.now() + timeoutMs
  let current = ''
  while (Date.now() < deadline) {
    current = (await evaluate('document.body.innerText')).replace(/\s+/g, ' ')
    if (current.includes(needle)) return current
    await pause(400)
  }
  return current
}

async function clickText(selector, value) {
  return evaluate(`(() => {
    const item = Array.from(document.querySelectorAll(${JSON.stringify(selector)})).find((node) => node.textContent.trim().includes(${JSON.stringify(value)}))
    if (!item) return false
    item.click()
    return true
  })()`)
}

async function setInput(placeholder, value) {
  return evaluate(`(() => {
    const host = Array.from(document.querySelectorAll('uni-input, uni-textarea')).find((node) => {
      const label = node.querySelector('.uni-input-placeholder, .uni-textarea-placeholder')
      return label && label.textContent.includes(${JSON.stringify(placeholder)})
    })
    if (!host) return false
    const field = host.querySelector('input, textarea')
    if (!field) return false
    const prototype = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
    const setter = Object.getOwnPropertyDescriptor(prototype, 'value').set
    setter.call(field, ${JSON.stringify(value)})
    field.dispatchEvent(new Event('input', { bubbles: true }))
    field.dispatchEvent(new Event('change', { bubbles: true }))
    return field.value === ${JSON.stringify(value)}
  })()`)
}

/**
 * Puts a banner on the screen that names the platform the picture was taken
 * on. A picture without it could be read as a mini program screenshot.
 */
async function addBanner(lines) {
  await evaluate(`(() => {
    const banner = document.createElement('div')
    banner.id = 'codestrike-evidence-banner'
    banner.setAttribute('style', [
      'position:fixed', 'left:0', 'right:0', 'top:0', 'z-index:99999',
      'background:#14213d', 'color:#ffffff', 'padding:8px 12px',
      'font-family:Consolas,Menlo,monospace', 'font-size:11px',
      'line-height:1.45', 'white-space:pre-wrap', 'opacity:0.95',
    ].join(';'))
    banner.textContent = ${JSON.stringify(lines.join('\n'))}
    document.body.appendChild(banner)
    return true
  })()`)
}

async function api(path, { method = 'GET', body, token } = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    const error = new Error(payload?.message ?? `request failed with ${response.status}`)
    error.status = response.status
    error.code = payload?.code
    throw error
  }
  return payload
}

// --- the account the run uses ---------------------------------------------
const stamp = Date.now().toString(36)
const student = {
  username: `t9mp_student_${stamp}`,
  password: `T9-mini-program-${stamp}-${Math.random().toString(36).slice(2)}`,
}

await api('/auth/register', { method: 'POST', body: { username: student.username, password: student.password } })
const session = await api('/auth/login', { method: 'POST', body: { username: student.username, password: student.password } })
const catalog = await api('/skills')
const python = catalog.find((skill) => skill.name === 'Python')

await api('/profiles/me', {
  method: 'PATCH',
  token: session.accessToken,
  body: {
    name: 'Mini Program Student',
    college: 'School of Computer Science',
    major: 'Software Engineering',
    academicYear: '2026',
    sex: 'Female',
    briefCv: 'Prepared the WeChat mini program build and readiness evidence.',
    wechatId: 'mini_program_student',
    qqId: '',
    mbti: 'INFJ',
    hobbies: 'Cycling, photography',
    skillIds: python ? [python.id] : [],
  },
})

console.log(`=== T9 WECHAT MINI PROGRAM READINESS (${student.username}) ===`)

await send('Page.enable')
await send('Runtime.enable')
await send('Network.enable')
await send('Network.setCacheDisabled', { cacheDisabled: true })
await send('Emulation.setDeviceMetricsOverride', {
  width: 390, height: 900, screenWidth: 390, screenHeight: 900, deviceScaleFactor: 1, mobile: true,
})

const platformNote = [
  'CodeStrike WeChat mini program readiness evidence',
  'Platform shown: H5 production bundle, API mode against the real backend.',
  'The WeChat Developer Tools are not installed on this machine, so the mini',
  'program itself was NOT started and its rendering is NOT VERIFIED.',
  'The source, the routes and the API calls are the same ones the mini',
  'program bundle carries.',
]

// --- the account screen ----------------------------------------------------
await navigate('/pages/auth/login')
await waitForText('Sign in')
await setInput('e.g. orbit_captain', student.username)
await setInput('Your password', student.password)
await pause(300)
await addBanner([...platformNote, '', 'Screen: the account sign-in form, API mode.'])
await screenshot('A5_MP_04_Account_Login.png')

await clickText('uni-button.primary', 'Sign in')
const signedIn = await waitForText(student.username)
if (!signedIn.includes(student.username)) {
  throw new Error(`the sign-in did not establish a session: the page shows "${signedIn.slice(0, 200)}"`)
}

// --- the competition home --------------------------------------------------
await navigate('/pages/index/index')
const home = await waitForText('Competition')
if (home.includes('Service unreachable')) {
  throw new Error('the competition home cannot reach the API. The origin of this page has to be listed in CORS_ORIGINS.')
}
await addBanner([...platformNote, '', 'Screen: the competition home, listing the competitions the API returns.'])
await screenshot('A5_MP_03_Competition_Home.png')

// --- the profile, read back from the API -----------------------------------
await navigate('/pages/profile/index')
const profile = await waitForText('Profile is complete')
if (!profile.includes('Profile is complete')) {
  throw new Error(`the profile did not load from the API: the page shows "${profile.slice(0, 200)}"`)
}
// The profile fields are inputs, so their values never reach the page text.
// The name is read out of the field itself.
const profileName = await evaluate(`(() => {
  const host = Array.from(document.querySelectorAll('uni-input')).find((node) => {
    const label = node.querySelector('.uni-input-placeholder')
    return label && label.textContent.includes('Your real name')
  })
  return host ? host.querySelector('input')?.value ?? '' : ''
})()`)
if (profileName !== 'Mini Program Student') {
  throw new Error(`the profile name is "${profileName}" instead of the name the API returned`)
}
await addBanner([...platformNote, '', 'Screen: the profile, read back from the API after the sign-in above.'])
await screenshot('A5_MP_05_Profile_API_Test.png')

console.log('')
console.log(`competition home shows the search field: ${home.includes('Search by competition name')}`)
console.log(`the profile shows the name from the API: ${profileName === 'Mini Program Student'}`)
console.log('')
console.log('NOTE: these three pictures are H5 captures. The mini program screens are NOT VERIFIED.')
