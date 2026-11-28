import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { parseArgs } from 'node:util'

const usage = `node scripts/verify-t7-h5-browser.mjs --evidence-dir <dir>
  [--cdp http://127.0.0.1:9315] [--h5 http://127.0.0.1:4185]
  [--api http://127.0.0.1:8015/api/v1]

Requires CODESTRIKE_STUDENT_USERNAME, CODESTRIKE_STUDENT_PASSWORD,
CODESTRIKE_CAPTAIN_USERNAME, CODESTRIKE_CAPTAIN_PASSWORD,
CODESTRIKE_ADMIN_USERNAME and CODESTRIKE_ADMIN_PASSWORD in the environment.`

const timeout = 25000

async function until(description, probe) {
  const end = Date.now() + timeout
  do {
    const result = await probe()
    if (result) return result
    await sleep(150)
  } while (Date.now() < end)
  throw new Error('Timed out waiting for ' + description)
}

function readConfig() {
  const { values } = parseArgs({
    options: {
      cdp: { type: 'string' },
      h5: { type: 'string' },
      api: { type: 'string' },
      'evidence-dir': { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
  })
  if (values.help) {
    console.log(usage)
    return null
  }
  if (!values['evidence-dir']) throw new Error('--evidence-dir is required')
  const account = (prefix) => {
    const username = process.env[`CODESTRIKE_${prefix}_USERNAME`]
    const password = process.env[`CODESTRIKE_${prefix}_PASSWORD`]
    if (!username || !password) throw new Error(`Set CODESTRIKE_${prefix}_USERNAME and PASSWORD`)
    return { username, password }
  }
  return {
    cdp: (values.cdp ?? 'http://127.0.0.1:9315').replace(/\/$/, ''),
    h5: (values.h5 ?? 'http://127.0.0.1:4185').replace(/\/$/, ''),
    api: (values.api ?? 'http://127.0.0.1:8015/api/v1').replace(/\/$/, ''),
    evidence: resolve(values['evidence-dir']),
    student: account('STUDENT'),
    captain: account('CAPTAIN'),
    admin: account('ADMIN'),
  }
}

async function apiJson(base, path, { method = 'GET', token, body } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const text = await response.text()
  const data = text ? JSON.parse(text) : null
  if (!response.ok) throw new Error(`${method} ${path} -> ${response.status}: ${text}`)
  return data
}

async function connect(cdpUrl, directory) {
  const version = await (await fetch(`${cdpUrl}/json/version`)).json()
  const ws = new WebSocket(version.webSocketDebuggerUrl)
  await new Promise((done, fail) => {
    ws.addEventListener('open', done, { once: true })
    ws.addEventListener('error', () => fail(new Error('CDP connection failed')), { once: true })
  })
  let seq = 0
  const pending = new Map()
  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data)
    const entry = pending.get(msg.id)
    if (!entry) return
    pending.delete(msg.id)
    clearTimeout(entry.timer)
    if (msg.error) entry.fail(new Error(`CDP error (${entry.method}): ${msg.error.message}`))
    else entry.done(msg.result)
  })
  function send(method, params = {}, sessionId) {
    return new Promise((done, fail) => {
      const id = ++seq
      const timer = setTimeout(() => {
        pending.delete(id)
        fail(new Error(`CDP timeout: ${method}`))
      }, timeout)
      pending.set(id, { method, done, fail, timer })
      ws.send(JSON.stringify({ id, method, params, sessionId }))
    })
  }
  const { browserContextId } = await send('Target.createBrowserContext', { disposeOnDetach: true })
  const { targetId } = await send('Target.createTarget', { url: 'about:blank', browserContextId })
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true })
  const cmd = (method, params) => send(method, params, sessionId)
  await cmd('Page.enable')
  await cmd('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true,
  })

  function dom(spec, action) {
    const norm = (s) => s.replace(/\s+/g, ' ').trim()
    const visible = (el) => el.checkVisibility() && el.getClientRects().length > 0
    const label = (el) => norm(el.innerText ?? el.textContent ?? '')
    const matches = (root, loc) =>
      [...root.querySelectorAll(loc.css)].filter(
        (el) =>
          visible(el) &&
          (loc.text === undefined || label(el) === loc.text) &&
          (loc.contains === undefined || label(el).includes(loc.contains)),
      )
    const activePage = [...document.querySelectorAll('uni-page')].filter(visible).at(-1) ?? document
    const modal = [...document.querySelectorAll('uni-modal, .uni-modal')].filter(visible).at(-1)
    const baseRoot = spec.global ? document : modal ?? activePage
    const roots = spec.scope ? matches(baseRoot, spec.scope) : [baseRoot]
    if (roots.length !== 1) return false
    const els = matches(roots[0], spec)
    if (action === 'absent') return els.length === 0
    if (els.length !== 1) return false
    const el = els[0]
    if (action === 'present') return true
    if (action === 'text') return label(el)
    if (action === 'value') return el.value
    el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' })
    if (action === 'focus') {
      el.focus()
      if (typeof el.select === 'function') el.select()
      return document.activeElement === el
    }
    const r = el.getBoundingClientRect()
    const x = r.left + r.width / 2
    const y = r.top + r.height / 2
    const hit = document.elementFromPoint(x, y)
    return hit && (el.contains(hit) || hit.contains(el)) ? { x, y } : false
  }

  const evalFn = async (fn, ...args) => {
    const res = await cmd('Runtime.evaluate', {
      expression: `(${fn.toString()})(...${JSON.stringify(args)})`,
      returnByValue: true,
      awaitPromise: true,
    })
    if (res.exceptionDetails) {
      throw new Error(res.exceptionDetails.exception?.description ?? res.exceptionDetails.text)
    }
    return res.result.value
  }
  const wait = (spec, action = 'present') =>
    until(`${action} ${spec.css} ${spec.text ?? spec.contains ?? ''}`, () => evalFn(dom, spec, action))
  const click = async (spec) => {
    const pt = await wait(spec, 'point')
    await cmd('Input.dispatchMouseEvent', { type: 'mousePressed', ...pt, button: 'left', clickCount: 1 })
    await cmd('Input.dispatchMouseEvent', { type: 'mouseReleased', ...pt, button: 'left', clickCount: 1 })
  }
  const fill = async (spec, value) => {
    await wait(spec, 'focus')
    await cmd('Input.insertText', { text: value })
    await until(`input value ${value}`, async () => (await evalFn(dom, spec, 'value')) === value)
  }
  const goto = async (url) => {
    await cmd('Page.navigate', { url })
    await sleep(300)
  }
  const reload = async () => {
    const before = await evalFn(() => performance.timeOrigin)
    await cmd('Page.reload', { ignoreCache: true })
    await until('reload complete', () =>
      evalFn((old) => performance.timeOrigin !== old && document.readyState === 'complete', before),
    )
  }
  const shot = async (name) => {
    await evalFn(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(true)))))
    const { data } = await cmd('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
    await writeFile(join(directory, `${name}.png`), Buffer.from(data, 'base64'))
    console.log(`Saved ${name}.png`)
  }
  return { wait, click, fill, goto, reload, shot, evalFn, close: () => ws.close() }
}

const btn = (text, scope) => ({ css: 'button,uni-button', text, scope })
const containsBtn = (contains, scope) => ({ css: 'button,uni-button', contains, scope })

async function seedNotifications(config) {
  const adminToken = (await apiJson(config.api, '/auth/login', { method: 'POST', body: config.admin })).accessToken
  const captainToken = (await apiJson(config.api, '/auth/login', { method: 'POST', body: config.captain })).accessToken
  const studentToken = (await apiJson(config.api, '/auth/login', { method: 'POST', body: config.student })).accessToken
  const skills = await apiJson(config.api, '/skills')

  const comp = await apiJson(config.api, '/competitions', {
    method: 'POST',
    token: adminToken,
    body: {
      title: `T7 Live Sprint Cup ${Date.now()}`,
      category: 'Software',
      description: 'Live T7 notifications and planner verification.',
      registrationDeadline: '2028-12-01T12:00:00Z',
      eligibilityRules: 'Enrolled students',
      maxTeamSize: 4,
      officialSourceUrl: 'https://example.org/t7-live',
      coverImage: null,
      published: true,
    },
  })

  // Team recruitment + admission approval -> ApplicationApproved for student
  const team = await apiJson(config.api, '/teams', {
    method: 'POST',
    token: captainToken,
    body: {
      competitionId: comp.id,
      name: 'Alpha Planners',
      summary: 'Building reliable campus tools.',
      capacity: 3,
      skillIds: [skills[0].id],
      submitRecruitment: true,
    },
  })
  await apiJson(config.api, `/moderation/recruitments/${team.revision.id}/decision`, {
    method: 'POST',
    token: adminToken,
    body: { decision: 'Approved' },
  })
  const app = await apiJson(config.api, `/teams/${team.id}/applications`, {
    method: 'POST',
    token: studentToken,
  })
  await apiJson(config.api, `/applications/${app.id}/decision`, {
    method: 'POST',
    token: captainToken,
    body: { decision: 'Approved' },
  })

  // Post approval -> ModerationApprove for student
  const post = await apiJson(config.api, `/competitions/${comp.id}/posts`, {
    method: 'POST',
    token: studentToken,
    body: { text: 'T7 live notification test post', links: [], images: [] },
  })
  await apiJson(config.api, `/moderation/${post.revisionId}`, {
    method: 'POST',
    token: adminToken,
    body: { action: 'Approve' },
  })
}

async function main() {
  const config = readConfig()
  if (!config) return
  await mkdir(config.evidence, { recursive: true })
  await seedNotifications(config)

  const page = await connect(config.cdp, config.evidence)
  try {
    // 1. Sign in as student
    await page.goto(`${config.h5}/#/pages/auth/login`)
    await page.fill({ css: '.form-card input:not([type=password])' }, config.student.username)
    await page.fill({ css: '.form-card input[type=password]' }, config.student.password)
    await page.click(btn('Sign in'))
    await page.wait(btn('Sign out'))

    // 2. Open Notifications via header bell icon
    await page.click({ css: 'button[aria-label="Notifications"], uni-button[aria-label="Notifications"]' })
    await page.wait({ css: '.card__title', text: 'Application approved' })
    await page.wait({ css: '.card__title', text: 'Content approved' })
    const beforeUnread = await page.wait({ css: '.unread-pill' }, 'text')
    assert.match(beforeUnread, /^3 unread$/)
    await page.shot('t7-01-notifications-inbox')

    // Mark first notification as read and confirm persistence across full reload
    const firstCard = { css: '.card', contains: 'Content approved' }
    await page.click(btn('Mark as read', firstCard))
    await page.wait({ css: '.unread-pill', text: '2 unread' })
    await page.reload()
    await page.wait({ css: '.unread-pill', text: '2 unread' })
    await page.click(containsBtn('Unread ('))
    await page.wait({ css: '.card__title', text: 'Application approved' })
    await page.wait({ css: '.card__title', text: 'Content approved' }, 'absent')
    await page.shot('t7-02-notifications-filtered')

    // 3. Open Planner
    await page.goto(`${config.h5}/#/pages/planner/index`)
    await page.wait({ css: '.planner-head__title', text: 'Your day, at a glance' })
    await page.wait({ css: '.state__title', text: 'Nothing scheduled' })

    // Add Timed Plan
    await page.click(containsBtn('Timed plan'))
    await page.fill({ css: '.form input' }, 'Architecture review')
    await page.click(btn('Save Timed Plan'))
    await page.wait({ css: '.feedback', contains: 'Created 1 timed plan' })

    // Return to Planner and add To-do
    await page.goto(`${config.h5}/#/pages/planner/index`)
    await page.wait({ css: '.entry__title', text: 'Architecture review' })
    await page.click(containsBtn('To-do'))
    await page.fill({ css: '.form input' }, 'Finish T7 integration')
    await page.fill({ css: '.form textarea' }, 'Verify MySQL persistence across reloads')
    await page.click(btn('Save To-do'))
    await page.wait({ css: '.feedback', contains: 'Created 1 to-do' })

    // Return to Planner Day view -> confirm both items
    await page.goto(`${config.h5}/#/pages/planner/index`)
    await page.wait({ css: '.entry__title', text: 'Architecture review' })
    await page.wait({ css: '.entry__title', text: 'Finish T7 integration' })
    await page.shot('t7-03-planner-day')

    // Complete To-do, reload page and confirm persistence
    const todoRow = { css: '.entry', contains: 'Finish T7 integration' }
    await page.click(btn('Complete', todoRow))
    await page.wait(btn('Undo', todoRow))
    await page.reload()
    await page.wait({ css: '.entry__title', text: 'Architecture review' })
    await page.wait(btn('Undo', todoRow))
    await page.shot('t7-04-planner-reloaded')

    // Switch to Week view
    await page.click(btn('Week'))
    await page.wait({ css: '.date', contains: 'Week containing' })
    await page.wait({ css: '.entry__title', text: 'Architecture review' })
    await page.shot('t7-05-planner-week')

    // Edit single occurrence (Timed Plan)
    await page.click({ css: '.entry', contains: 'Architecture review' })
    await page.wait({ css: '.identity', contains: 'TimedPlan' })
    await page.fill({ css: '.form input' }, 'Architecture review (updated)')
    await page.click(btn('Save This Occurrence'))
    await page.wait({ css: '.feedback', contains: 'Updated this occurrence only.' })
    await page.shot('t7-06-planner-occurrence-edit')

    // Verify updated title persists on Planner reload, then delete To-do occurrence
    await page.goto(`${config.h5}/#/pages/planner/index`)
    await page.wait({ css: '.entry__title', text: 'Architecture review (updated)' })
    await page.click({ css: '.entry', contains: 'Finish T7 integration' })
    await page.wait({ css: '.identity', contains: 'Todo' })
    await page.click(btn('Delete This Occurrence'))
    await page.click({ css: '.uni-modal__btn_primary', text: 'Delete', global: true })
    await page.wait({ css: '.entry__title', text: 'Architecture review (updated)' })
    await page.wait({ css: '.entry__title', text: 'Finish T7 integration' }, 'absent')
    await page.reload()
    await page.wait({ css: '.entry__title', text: 'Architecture review (updated)' })
    await page.wait({ css: '.entry__title', text: 'Finish T7 integration' }, 'absent')
    await page.shot('t7-07-planner-after-delete')

    // Add repeating Course (uses server SEMESTER_START_DATE + PERIOD_TIMES)
    await page.click(containsBtn('Course'))
    await page.wait({ css: '.intro__title', text: 'Add a repeating course' })
    await page.fill({ css: '.field-course-name input' }, 'Software Engineering')
    await page.fill({ css: '.field-course-room input' }, 'Room B204')
    await page.click(btn('Save Course'))
    await page.wait({ css: '.feedback', contains: 'Created 4 occurrence(s); skipped 0 duplicate' })
    await page.evalFn(() => document.querySelector('.feedback')?.scrollIntoView({ block: 'end', behavior: 'instant' }))
    await page.shot('t7-08-planner-course-created')

    console.log('PASS: T7 notifications and personal planner H5 browser journey')
  } finally {
    page.close()
  }
}

main().catch((error) => {
  console.error('FAIL:', error.message)
  process.exitCode = 1
})
