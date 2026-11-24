const [webSocketUrl, baseUrl, evidenceDirectory, apiBaseUrl] = process.argv.slice(2)
if (!webSocketUrl || !baseUrl || !evidenceDirectory || !apiBaseUrl) {
  throw new Error('Usage: node scripts/verify-t4-h5-teams.mjs <ws-url> <h5-base-url> <evidence-directory> <api-base-url>')
}

const socket = new WebSocket(webSocketUrl)
const pending = new Map()
const apiCalls = new Map()

/** The request bodies are recorded, but a credential never is. */
function redact(body) {
  return body.replace(/"password":"[^"]*"/g, '"password":"<redacted>"')
}
let requestId = 0
socket.addEventListener('message', (event) => {
  const payload = JSON.parse(String(event.data))
  if (payload.method === 'Network.responseReceived' && payload.params.response.url.includes('/api/v1/')) {
    const known = apiCalls.get(payload.params.requestId) ?? {}
    apiCalls.set(payload.params.requestId, { ...known, status: payload.params.response.status })
  }
  if (payload.method === 'Network.requestWillBeSent' && payload.params.request.url.includes('/api/v1/')) {
    apiCalls.set(payload.params.requestId, {
      method: payload.params.request.method,
      url: payload.params.request.url,
      body: payload.params.request.postData,
    })
  }
  if (payload.method === 'Network.loadingFinished' && apiCalls.has(payload.params.requestId)) {
    const call = apiCalls.get(payload.params.requestId)
    console.log(`API ${call.status ?? ''} ${call.method} ${call.url.replace(apiBaseUrl, '')}${call.body ? ` body=${redact(call.body)}` : ''}`)
    apiCalls.delete(payload.params.requestId)
  }
  if (!payload.id) return
  const request = pending.get(payload.id)
  if (!request) return
  pending.delete(payload.id)
  payload.error ? request.reject(new Error(`${request.method}: ${payload.error.message}`)) : request.resolve(payload.result)
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
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text)
  return result.result.value
}
const pause = (milliseconds = 400) => new Promise((resolve) => setTimeout(resolve, milliseconds))

/**
 * The rendered text, with the line breaks the layout inserts removed. A badge
 * that wraps would otherwise split a phrase across two lines.
 */
const text = async () => {
  lastText = (await evaluate('document.body.innerText')).replace(/\s+/g, ' ')
  return lastText
}

/** Waits until the page shows the expected phrase, so a slow load is not a failure. */
async function waitForText(needle, timeoutMs = 25000) {
  const deadline = Date.now() + timeoutMs
  let current = ''
  while (Date.now() < deadline) {
    current = await text()
    if (current.includes(needle)) return current
    await pause(400)
  }
  return current
}

async function navigate(path) {
  await send('Page.navigate', { url: `${baseUrl}/?build=${Date.now()}#${path}` })
  // The page is ready once its body has content; waiting for a fixed phrase
  // would stall on the screens that do not carry one.
  const deadline = Date.now() + 25000
  while (Date.now() < deadline) {
    const rendered = await evaluate('document.body ? document.body.textContent.trim().length : 0')
    if (rendered > 40) return
    await pause(400)
  }
}

async function clickText(selector, value) {
  return evaluate(`(() => {
    const item = Array.from(document.querySelectorAll(${JSON.stringify(selector)})).find((node) => node.textContent.trim().includes(${JSON.stringify(value)}))
    if (!item) return false
    item.click()
    return true
  })()`)
}

/**
 * Writes into a uni-app field. The native setter is used on purpose: a
 * framework that tracks the previous value ignores a plain assignment, and
 * the field would be reset on the next render.
 */
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
 * Types into a field the way a person would: the field is focused and the
 * text is inserted by the browser, so the framework receives a real input
 * event with the input type it expects.
 */
async function typeInto(placeholder, value) {
  const focused = await evaluate(`(() => {
    const host = Array.from(document.querySelectorAll('uni-input, uni-textarea')).find((node) => {
      const label = node.querySelector('.uni-input-placeholder, .uni-textarea-placeholder')
      return label && label.textContent.includes(${JSON.stringify(placeholder)})
    })
    if (!host) return false
    const field = host.querySelector('input, textarea')
    if (!field) return false
    field.focus()
    return true
  })()`)
  if (!focused) return false
  await send('Input.insertText', { text: value })
  await pause(400)
  // A textarea reports its value on change, so the field is closed first.
  await evaluate(`(() => {
    const host = Array.from(document.querySelectorAll('uni-input, uni-textarea')).find((node) => {
      const label = node.querySelector('.uni-input-placeholder, .uni-textarea-placeholder')
      return label && label.textContent.includes(${JSON.stringify(placeholder)})
    })
    const field = host && host.querySelector('input, textarea')
    if (!field) return false
    field.dispatchEvent(new Event('change', { bubbles: true }))
    field.blur()
    return true
  })()`)
  await pause(400)
  return true
}

/** Reads a field back, to prove the framework kept the value. */
async function readInput(placeholder) {
  return evaluate(`(() => {
    const host = Array.from(document.querySelectorAll('uni-input, uni-textarea')).find((node) => {
      const label = node.querySelector('.uni-input-placeholder, .uni-textarea-placeholder')
      return label && label.textContent.includes(${JSON.stringify(placeholder)})
    })
    if (!host) return null
    const field = host.querySelector('input, textarea')
    return field ? field.value : null
  })()`)
}

let lastText = ''
/** Confirms the modal the platform opens before a captain decision. */
async function confirmModal() {
  return evaluate(`(() => {
    const modal = document.querySelector('uni-modal')
    if (!modal) return false
    const buttons = Array.from(modal.querySelectorAll('uni-button, .uni-modal__btn'))
    const confirm = buttons.find((button) => ['确定', 'OK'].includes(button.textContent.trim()))
    if (!confirm) return false
    confirm.click()
    return true
  })()`)
}

function check(condition, label) {
  if (!condition) {
    throw new Error(`FAILED: ${label}
page text: ${lastText.slice(-600)}`)
  }
  console.log(`PASS: ${label}`)
}

async function screenshot(name) {
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
  const bytes = Uint8Array.from(atob(shot.data), (character) => character.charCodeAt(0))
  await import('node:fs/promises').then((fs) => fs.writeFile(`${evidenceDirectory}/${name}`, bytes))
}

/* ------------------------------------------------------------------ */
/* API side setup: the accounts and the competition the browser uses.  */
/* ------------------------------------------------------------------ */

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

const stamp = Date.now().toString(36)
const captain = { username: `t4ui_captain_${stamp}`, password: `T4-ui-captain-${stamp}-${Math.random().toString(36).slice(2)}` }
const applicant = { username: `t4ui_applicant_${stamp}`, password: `T4-ui-applicant-${stamp}-${Math.random().toString(36).slice(2)}` }
const adminUsername = process.env.CODESTRIKE_ADMIN_USERNAME ?? ''
const adminPassword = process.env.CODESTRIKE_ADMIN_PASSWORD ?? ''
if (!adminUsername || !adminPassword) throw new Error('The administrator credentials are required to publish the recruitment.')

const adminSession = await api('/auth/login', { method: 'POST', body: { username: adminUsername, password: adminPassword } })
const adminToken = adminSession.accessToken

const competition = await api('/competitions', {
  method: 'POST',
  token: adminToken,
  body: {
    title: `T4 Browser Competition ${stamp}`,
    description: 'A competition created by the T4 browser evidence run.',
    category: 'Innovation',
    registrationDeadline: '2027-06-30T16:00:00Z',
    eligibilityRules: 'Open to enrolled university students.',
    maxTeamSize: 5,
    officialSourceUrl: 'https://example.edu/t4-browser',
    coverImage: null,
    published: true,
  },
})

const catalog = await api('/skills')
const python = catalog.find((skill) => skill.name === 'Python')
const java = catalog.find((skill) => skill.name === 'Java')

async function createStudent(account, name, skillIds) {
  await api('/auth/register', { method: 'POST', body: { username: account.username, password: account.password } })
  const session = await api('/auth/login', { method: 'POST', body: { username: account.username, password: account.password } })
  await api('/profiles/me', {
    method: 'PATCH',
    token: session.accessToken,
    body: {
      name,
      college: 'School of Computer Science',
      major: 'Software Engineering',
      academicYear: '2026',
      sex: 'Female',
      briefCv: 'Built two course projects and led a campus navigation prototype.',
      wechatId: `${name.toLowerCase().replace(/\s+/g, '_')}_wechat`,
      qqId: '',
      mbti: 'INFJ',
      hobbies: 'Cycling, photography',
      skillIds,
    },
  })
  return session.accessToken
}

const captainToken = await createStudent(captain, 'Captain A', [python.id])
const applicantToken = await createStudent(applicant, 'Applicant B', [python.id])

console.log(`=== T4 H5 TEAM FLOW (${competition.title}) ===`)

/* ------------------------------------------------------------------ */
/* Browser flow.                                                        */
/* ------------------------------------------------------------------ */

await send('Page.enable')
await send('Runtime.enable')
await send('Network.enable')
await send('Network.setCacheDisabled', { cacheDisabled: true })
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 900, screenWidth: 390, screenHeight: 900, deviceScaleFactor: 1, mobile: true })

async function signInThroughThePage(account) {
  await navigate('/pages/auth/login')
  check(await setInput('e.g. orbit_captain', account.username), 'the username field accepts the account name')
  check(await setInput('Your password', account.password), 'the password field accepts the password')
  await pause(300)
  check(await clickText('uni-button.primary', 'Sign in'), 'the sign-in button is pressed')
  const signedIn = await waitForText(account.username)
  check(signedIn.includes(account.username), `the session is established for ${account.username}`)
}

await navigate('/pages/index/index')
const list = await waitForText(competition.title)
check(list.includes(competition.title), 'the published competition appears in the competition list')
check(list.includes('Search by competition name'), 'the competition search field is rendered')
// The search narrows the list to the competition of this run.
check(await typeInto('Search by competition name', competition.title), 'the search field accepts the competition name')
await pause(800)
const searched = await text()
check(searched.includes(competition.title), 'the search keeps the matching competition')
check(!searched.includes('T4 Open Competition'), 'the search removes the other competitions')
await screenshot('A5_T4_01_Competition_List.png')

check(await clickText('uni-button.card', competition.title), 'the competition card is opened')
const detail = await waitForText('Eligibility')
check(detail.includes('Eligibility'), 'the competition detail page is rendered')
check(detail.includes(competition.title), 'the competition detail shows the real competition')
check(detail.includes('Registration open'), 'the competition detail reports the real registration state')
await screenshot('A5_T4_02_Competition_Detail.png')

await signInThroughThePage(captain)

await navigate('/pages/teams/create')
// The form loads the competition list and the skill catalogue first; the
// limit line proves the form finished its initialisation.
const createPage = await waitForText('Competition limit: 5')
check(createPage.includes('Create team'), 'the team creation form renders')
check(createPage.includes(competition.title), 'the competition picker shows the published competition')
check(createPage.includes(python.name), 'the skill catalogue of the server is offered')
check(await typeInto('e.g. Signal Forge', 'Signal Forge'), 'the team name field accepts a value')
check(await typeInto('Describe your competition focus', 'A campus navigation concept built in the browser evidence run.'), 'the team summary field accepts a value')
await pause(800)
// The form starts with one tag selected, so a second one is added and the
// selection is read back from the rendered chips.
check(
  await evaluate(`(() => {
    const toggle = document.querySelector('uni-switch')
    if (!toggle) return false
    toggle.querySelector('.uni-switch-input')?.click()
    return true
  })()`),
  'the recruitment submission switch is turned on',
)
await pause(400)
check(await clickText('.skills uni-button', java.name), 'a second required skill tag is selected')
await pause(600)
const selectedTags = await evaluate(`(() => Array.from(document.querySelectorAll('.skills .active')).map((node) => node.textContent.trim()))()`)
check(selectedTags.includes(python.name) && selectedTags.includes(java.name), 'both required skill tags are selected')
check((await readInput('e.g. Signal Forge')) === 'Signal Forge', 'the framework kept the team name')
check((await readInput('Describe your competition focus'))?.length > 10, 'the framework kept the team summary')
await screenshot('A5_T4_03_Team_Created.png')
check(await clickText('uni-button.primary', 'Create team'), 'the create team button is pressed')
const created = await waitForText('Team created')
check(created.includes('Team created'), 'the server confirms the new team')
check(created.includes('submitted for review'), 'the first recruitment version was submitted for review')

const myTeams = await api('/me/teams', { token: captainToken })
const team = myTeams.find((item) => item.name === 'Signal Forge')
if (!team) throw new Error('FAILED: the created team is not readable from the API')
check(team.memberCount === 1, 'the captain is the first member of the new team')

const queue = await api('/moderation/recruitments', { token: adminToken })
const revision = queue.find((item) => item.teamId === team.id)
if (!revision) throw new Error('FAILED: the recruitment revision is not in the moderation queue')
await api(`/moderation/recruitments/${revision.id}/decision`, { method: 'POST', token: adminToken, body: { decision: 'Approved' } })
console.log('PASS: the administrator published the recruitment revision')

await navigate(`/pages/competition/detail?id=${competition.id}`)
check(await clickText('.tabs__item', 'Recruitment'), 'the recruitment tab is opened')
const published = await waitForText('Signal Forge')
check(published.includes('Signal Forge'), 'the published recruitment appears in the competition')
check(published.includes('Skills overlap'), 'the published recruitment reports the skill match of the viewer')
check(published.includes('1/4 members'), 'the published recruitment reports the real capacity')
await screenshot('A5_T4_04_Recruitment_Published.png')

await signInThroughThePage(applicant)
await navigate(`/pages/recruitment/detail?id=${team.id}`)
const recruitment = await waitForText('Signal Forge')
check(recruitment.includes('Signal Forge'), 'the applicant opens the published recruitment')
check(await clickText('uni-button.primary', 'Apply to join'), 'the apply button is pressed')
const applied = await waitForText('Pending')
check(applied.includes('Pending'), 'the submitted application is reported as Pending')
await screenshot('A5_T4_05_Application_Submitted.png')

await signInThroughThePage(captain)
await navigate('/pages/captain/review')
const review = await waitForText('Applicant B')
check(review.includes('Applicant B'), 'the captain sees the Pending applicant')
check(review.includes('MATCHED'), 'the captain sees the skill match of the applicant')
await screenshot('A5_T4_06_Captain_Review.png')

check(await clickText('uni-button.approve', 'Approve'), 'the approve button is pressed')
await pause(800)
check(await confirmModal(), 'the approval is confirmed in the dialog')
const approved = await waitForText('approved')
check(approved.includes('approved'), 'the captain sees the approval confirmation')
await screenshot('A5_T4_07_Application_Approved.png')

await navigate('/pages/teams/index')
const membership = await waitForText('Signal Forge')
check(membership.includes('Signal Forge'), 'the team appears in My Teams')
check(membership.includes('MEMBER') || membership.includes('CAPTAIN'), 'the membership role is shown')
check(!membership.includes('applicant_b_wechat'), 'the captain view does not leak the applicant contact')
await screenshot('A5_T4_08_Team_Membership.png')

const applicantTeams = await api('/me/teams', { token: applicantToken })
check(applicantTeams.some((item) => item.id === team.id), 'the applicant is an active member of the team')
check(applicantTeams.find((item) => item.id === team.id).memberCount === 2, 'the team counts the captain and the new member')

console.log('--- T4 H5 TEAM FLOW COMPLETE ---')
process.exit(0)
