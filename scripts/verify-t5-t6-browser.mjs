import { randomUUID } from 'node:crypto'
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { parseArgs } from 'node:util'

const usage = `node scripts/verify-t5-t6-browser.mjs --evidence-dir <directory>
  [--cdp http://127.0.0.1:9315] [--h5 http://127.0.0.1:4185]
  [--admin http://127.0.0.1:4186] [--png <file.png>]

Use Node 22+ and the parent's local Chrome with remote debugging enabled.
Set CODESTRIKE_STUDENT_USERNAME, CODESTRIKE_STUDENT_PASSWORD,
CODESTRIKE_ADMIN_USERNAME and CODESTRIKE_ADMIN_PASSWORD in the process environment.
URLs may also be set via CODESTRIKE_CDP_URL, CODESTRIKE_H5_URL and CODESTRIKE_ADMIN_URL.
Use the seeded, isolated database. Each run creates a uniquely named competition.
Screenshots go in a fresh run directory under --evidence-dir.`

const fixture = 'iVBORw0KGgoAAAANSUhEUgAAAFAAAABACAIAAAACpWdhAAAAgElEQVR42u3PQQ2AMBQFwarAB8EKeEBLNSCEEEzhgFbCO/5kkhWw05b1iNr6E7XfV9T3nlHpfwMGBgYGBgYGBgYGBgYGHuDqgPQfGBgYGBgYGBgYGBgYGHiCqwPSf2BgYGBgYGBgYGBgYGDgCa4OSP+BgYGBgYGBgYGBgYGBgUc/CeYRtAQ6InUAAAAASUVORK5CYII='
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

function settings() {
  const strings = ['cdp', 'h5', 'admin', 'png', 'evidence-dir']
  const options = Object.fromEntries(strings.map(name => [name, { type: 'string' }]))
  const { values } = parseArgs({ options: { ...options, help: { type: 'boolean', short: 'h' } } })
  if (values.help) {
    console.log(usage)
    return
  }
  if (!values['evidence-dir']) throw new Error('--evidence-dir is required. See --help.')
  function url(name, port) {
    const value = values[name] ?? process.env['CODESTRIKE_' + name.toUpperCase() + '_URL']
    const result = new URL(value ?? 'http://127.0.0.1:' + port)
    if (!['http:', 'https:'].includes(result.protocol) || result.username || result.password || result.search || result.hash) {
      throw new Error('Expected an HTTP base URL for --' + name)
    }
    if (name === 'cdp' && !['127.0.0.1', 'localhost', '[::1]'].includes(result.hostname)) {
      throw new Error('--cdp must refer to local Chrome')
    }
    return result.href.replace(/\/$/, '')
  }
  function account(role) {
    const prefix = 'CODESTRIKE_' + role + '_'
    const username = process.env[prefix + 'USERNAME']
    const password = process.env[prefix + 'PASSWORD']
    if (!username || !password) throw new Error('Set ' + prefix + 'USERNAME and ' + prefix + 'PASSWORD')
    return { username, password }
  }
  return {
    cdp: url('cdp', 9315), h5: url('h5', 4185), admin: url('admin', 4186),
    evidence: resolve(values['evidence-dir']), png: values.png,
    studentAccount: account('STUDENT'), adminAccount: account('ADMIN'),
  }
}

// Browser-level CDP lets the author, anonymous reader and administrator each
// use fresh cookies and storage. Closing this connection disposes only our tabs.
async function connect(endpoint) {
  let address
  try {
    const version = await fetch(endpoint + '/json/version', { signal: AbortSignal.timeout(5000) })
    address = (await version.json()).webSocketDebuggerUrl
    if (!address) throw new Error()
  } catch {
    throw new Error('Local Chrome did not provide a browser debugger at ' + endpoint)
  }
  const socket = new WebSocket(address)
  await new Promise((done, fail) => {
    socket.addEventListener('open', done, { once: true })
    socket.addEventListener('error', () => fail(new Error('Chrome debugger connection failed')), { once: true })
  })
  let id = 0
  const requests = new Map()
  const choosers = new Map()
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data)
    if (message.method === 'Page.fileChooserOpened') {
      choosers.set(message.sessionId, message.params.backendNodeId)
    }
    const request = requests.get(message.id)
    if (!request) return
    requests.delete(message.id)
    clearTimeout(request.timer)
    // Do not log raw protocol errors, parameters, page text or HTTP traffic.
    if (message.error) request.fail(new Error('Chrome command failed: ' + request.method))
    else request.done(message.result)
  })
  socket.addEventListener('close', () => {
    for (const request of requests.values()) {
      clearTimeout(request.timer)
      request.fail(new Error('Chrome disconnected'))
    }
    requests.clear()
  })
  function send(method, params = {}, sessionId) {
    return new Promise((done, fail) => {
      const requestId = ++id
      const timer = setTimeout(() => {
        requests.delete(requestId)
        fail(new Error('Chrome command timed out: ' + method))
      }, timeout)
      requests.set(requestId, { method, done, fail, timer })
      socket.send(JSON.stringify({ id: requestId, method, params, sessionId }))
    })
  }
  return {
    async page(mobile, directory) {
      const { browserContextId } = await send('Target.createBrowserContext', { disposeOnDetach: true })
      const { targetId } = await send('Target.createTarget', { url: 'about:blank', browserContextId })
      const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true })
      const command = (method, params) => send(method, params, sessionId)
      await command('Page.enable')
      const [width, height] = mobile ? [412, 915] : [1440, 1000]
      await command('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile })
      return new Page(command, () => choosers.get(sessionId), directory)
    },
    close: () => socket.close(),
  }
}

// This function runs inside the tab. Only rendered DOM, form controls and
// user gestures are used. The optional scope ties actions to this run's row.
function dom(spec, action) {
  const norm = s => s.replace(/\s+/g, ' ').trim()
  const visible = el => el.checkVisibility() && el.getClientRects().length > 0
  const label = el => norm(el.innerText ?? el.textContent ?? '')
  function matches(root, locator) {
    return [...root.querySelectorAll(locator.css)].filter(el => visible(el)
      && (locator.text === undefined || label(el) === locator.text)
      && (locator.contains === undefined || label(el).includes(locator.contains)))
  }
  const page = [...document.querySelectorAll('uni-page')].filter(visible).at(-1) ?? document
  const roots = spec.scope ? matches(page, spec.scope) : [page]
  if (roots.length !== 1) return false
  const elements = matches(roots[0], spec)
  if (action === 'absent') return elements.length === 0
  if (elements.length !== 1) return false
  const el = elements[0]
  if (action === 'text') return label(el)
  if (action === 'present') return true
  if (action === 'image') return el.complete && el.naturalWidth > 0 && el.naturalHeight > 0
  if (action === 'value') return el.value
  el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' })
  if (action === 'scroll') return true
  if (el.disabled || el.getAttribute('aria-disabled') === 'true') return false
  if (action === 'focus') {
    el.focus()
    el.select()
    return document.activeElement === el
  }
  const rect = el.getBoundingClientRect()
  const x = rect.left + rect.width / 2
  const y = rect.top + rect.height / 2
  const hit = document.elementFromPoint(x, y)
  return hit && el.contains(hit) ? { x, y } : false
}

const button = (text, scope) => ({ css: 'button,uni-button', text, scope })
const selector = css => ({ css })
const scoped = (css, scope) => ({ css, scope })
const containing = (css, contains) => ({ css, contains })

class Page {
  constructor(command, chooser, directory) {
    this.command = command
    this.chooser = chooser
    this.directory = directory
  }
  async evaluate(fn, ...args) {
    const expression = '(' + fn.toString() + ')(...' + JSON.stringify(args) + ')'
    const result = await this.command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (result.exceptionDetails) throw new Error('Could not read the rendered control')
    return result.result.value
  }
  read(target, action) { return this.evaluate(dom, target, action) }
  wait(target, action = 'present') {
    return until([action, target.css, target.text ?? target.contains].filter(Boolean).join(' '), () => this.read(target, action))
  }
  async click(target) {
    const point = await this.wait(target, 'point')
    const details = { ...point, button: 'left', clickCount: 1 }
    await this.command('Input.dispatchMouseEvent', { type: 'mousePressed', ...details })
    await this.command('Input.dispatchMouseEvent', { type: 'mouseReleased', ...details })
  }
  async fill(target, value) {
    await this.wait(target, 'focus')
    await this.command('Input.insertText', { text: value })
    await until('field to accept input ' + target.css, async () => await this.read(target, 'value') === value)
  }
  async goto(url) {
    const result = await this.command('Page.navigate', { url })
    if (result.errorText) throw new Error('App navigation failed')
    await until('app navigation', () => this.evaluate(expected => location.origin + location.pathname === expected, new URL(url).origin + new URL(url).pathname))
  }
  async reload() {
    const before = await this.evaluate(() => performance.timeOrigin)
    await this.command('Page.reload', { ignoreCache: true })
    await until('a new document after reload', () => this.evaluate(old =>
      performance.timeOrigin !== old && document.readyState === 'complete', before))
  }
  async upload(target, path) {
    await this.command('Page.setInterceptFileChooserDialog', { enabled: true })
    try {
      await this.click(target)
      const backendNodeId = await until('the application image picker', this.chooser)
      await this.command('DOM.setFileInputFiles', { files: [path], backendNodeId })
    } finally {
      await this.command('Page.setInterceptFileChooserDialog', { enabled: false })
    }
  }
  async shot(name, focus) {
    if (focus) await this.wait(focus, 'scroll')
    await this.command('Page.bringToFront')
    await this.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(() => done(true)))))
    const { data } = await this.command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
    await writeFile(join(this.directory, name + '.png'), Buffer.from(data, 'base64'), { flag: 'wx' })
    console.log('Saved ' + name + '.png')
  }
}

const postCard = text => containing('.cm-post-link', text)
const emptyFeed = { css: '.state__title', text: 'No published posts yet' }
const h5Field = label => scoped('textarea, input', containing('.cm-label', label))

async function signInStudent(page, base, account) {
  await page.goto(base + '/#/pages/auth/login')
  await page.fill(selector('.form-card input:not([type=password])'), account.username)
  await page.fill(selector('.form-card input[type=password]'), account.password)
  await page.click(button('Sign in'))
  await page.wait(button('Sign out'))
}

async function discussion(page, base, title) {
  await page.goto(base + '/#/pages/index/index')
  await page.click(containing('uni-button.card', title))
  await page.wait({ css: '.identity__title', text: title })
  await page.click(button('Discussion'))
}

async function refreshDiscussion(page) {
  await page.reload()
  await page.click(button('Discussion'))
  await page.wait(button('Sign in to write a post'))
}

async function expectImage(page, encoded) {
  // uni-image renders a CSS background in H5. Check both the displayed
  // source and its decodability in the browser, including after a public reload.
  await until('the uploaded PNG on the rendered post', () => page.evaluate(async data => {
    const expected = 'data:image/png;base64,' + data
    const current = [...document.querySelectorAll('uni-page')].filter(p => p.checkVisibility()).at(-1) ?? document
    const pictures = [...current.querySelectorAll('.cm-preview')].filter(el => el.checkVisibility())
    for (const picture of pictures) {
      const nodes = [picture, ...picture.querySelectorAll('*')]
      if (!nodes.some(el => el.currentSrc === expected || getComputedStyle(el).backgroundImage.includes(expected))) continue
      const image = new Image()
      image.src = expected
      await image.decode()
      return image.naturalWidth > 0 && picture.clientWidth > 0 && picture.clientHeight > 0
    }
    return false
  }, encoded))
}

async function signInAdmin(page, base, account) {
  await page.goto(base + '/')
  await page.fill(selector('input[autocomplete="username"]'), account.username)
  await page.fill(selector('input[autocomplete="current-password"]'), account.password)
  await page.click(button('Sign in'))
  await page.wait(button('Refresh dashboard'))
}

async function metric(page, title) {
  const value = await page.wait(scoped('strong', containing('article.metric-card', title)), 'text')
  if (!/^\d+$/.test(value)) throw new Error('Expected a numeric dashboard count for ' + title)
  return Number(value)
}

async function dashboard(page) {
  await page.click(containing('.side-menu .el-menu-item', 'Dashboard'))
  await page.wait(button('Refresh dashboard'))
}

async function startPost(page, original, png, encoded) {
  await page.click(button('Write a post'))
  await page.fill(h5Field('Post text'), original)
  await page.upload(button('Add images'), png)
  await page.wait(button('Remove image 1'))
  await expectImage(page, encoded)
  await page.shot('03-h5-post-with-png', selector('.cm-image-button'))
  await page.click(button('Submit for review'))
}

async function createCompetition(page, title) {
  await page.click(button('Open catalog'))
  await page.click(button('Create competition'))
  const field = label => scoped('input,textarea', containing('.el-dialog .el-form-item', label))
  await page.fill(field('Title'), title)
  await page.fill(field('Category'), 'Design')
  await page.fill(field('Description'), 'Compare four-color prototypes for a campus design challenge.')
  await page.fill(field('Eligibility rules'), 'Open to enrolled students.')
  await page.fill(field('Official source URL'), 'https://example.org/campus-design')
  // Pick a date from the next month in the actual Element Plus calendar.
  await page.click(selector('input[placeholder="Select date and time"]'))
  await page.click(selector('.el-date-picker__header .arrow-right'))
  await page.click({ css: 'td.available .el-date-table-cell__text', text: '15' })
  await page.click(selector('.el-picker-panel__footer button.is-plain'))
  await page.click(selector('.el-dialog .el-switch__core'))
  await page.click(button('Create competition', selector('.el-dialog')))
  await page.wait(selector('.el-dialog'), 'absent')
  await page.fill(selector('input[placeholder="Search competition titles"]'), title)
  await page.click(button('Search'))
  const row = containing('tr.el-table__row', title)
  await page.wait({ css: '.el-tag', text: 'Published', scope: row })
  await page.shot('02-admin-published-competition', row)
}

async function expectPost(page, value, status) {
  const card = containing('.cm-card', value)
  await page.wait({ css: '.cm-body', text: value, scope: card })
  await page.wait({ css: '.cm-meta', contains: '· ' + status, scope: card })
}

async function interactAndComment(page, comment) {
  const inactive = [button('Like · 0'), button('Favorite · 0')]
  const active = [button('Unlike · 1'), button('Unfavorite · 1')]
  for (let i = 0; i < active.length; i++) {
    await page.click(inactive[i])
    await page.wait(active[i])
  }
  await page.reload()
  for (const control of active) await page.wait(control)
  await page.shot('09a-h5-interactions-on-reloaded', active[0])
  for (let i = 0; i < inactive.length; i++) {
    await page.click(active[i])
    await page.wait(inactive[i])
  }
  await page.reload()
  for (const control of inactive) await page.wait(control)
  await page.shot('09b-h5-interactions-off-reloaded', inactive[0])
  await page.fill(selector('#comment-composer textarea'), comment)
  await page.click(button('Submit comment'))
  await expectPost(page, comment, 'Pending')
  await page.shot('09c-h5-author-pending-comment', containing('.cm-body', comment))
}

async function submitEdit(page, edited) {
  await page.click(button('Edit post'))
  await page.fill(h5Field('Post text'), edited)
  await page.click(button('Submit for review'))
}

async function moderate(page, text, status, action, shot, effective) {
  await page.click(containing('.side-menu .el-menu-item', 'Moderation'))
  await page.wait(button('Refresh'))
  await page.click(button('Content'))
  await page.click(button(status))
  await page.click(button('Refresh'))
  const row = containing('tr.el-table__row', text)
  for (let attempt = 0; attempt < 20; attempt++) {
    const found = await until('moderation queue rows to settle', async () => {
      if (await page.read(row, 'present')) return 'row'
      const busy = await page.evaluate(() => Boolean(document.querySelector('.el-loading-mask')?.checkVisibility()))
      if (busy) return false
      return 'settled'
    })
    if (found === 'row') break
    if (!await page.read(button('Next'), 'point')) break
    await page.click(button('Next'))
  }
  await page.click(button('Inspect', row))
  const dialog = selector('.el-dialog')
  await page.wait({ css: '.revision-panel--proposed', contains: text, scope: dialog })
  if (effective) {
    await page.wait({ css: '.revision-panel--effective', contains: effective, scope: dialog })
  }
  await until('moderation post images to settle', () => page.evaluate(() => {
    const dlg = document.querySelector('.el-dialog')
    if (!dlg || !dlg.checkVisibility()) return false
    const overlay = dlg.closest('.el-overlay')
    if (overlay && getComputedStyle(overlay).opacity !== '1') return false
    if (getComputedStyle(dlg).opacity !== '1') return false
    if (dlg.innerText.includes('Loading image')) return false
    const thumbs = [...dlg.querySelectorAll('img.revision-thumb')]
    return thumbs.every(img => img.complete && img.naturalWidth > 0 && img.naturalHeight > 0)
  }))
  if (action !== 'Approve') {
    await page.fill(scoped('textarea', dialog), 'Moderation decision: ' + action)
  }
  await page.shot(shot, dialog)
  await page.click(button(action, dialog))
  await page.wait(dialog, 'absent')
}

async function runJourney({ admin, author, reader, config, competition, original, edited, comment, png, encoded }) {
  await signInAdmin(admin, config.admin, config.adminAccount)
  const before = await metric(admin, 'Competitions')
  const pending = await metric(admin, 'Moderation queue')
  await admin.shot('01-admin-dashboard-before')
  await createCompetition(admin, competition)
  await dashboard(admin)
  if (await metric(admin, 'Competitions') !== before + 1) throw new Error('Dashboard competition count did not increase by one')
  await admin.shot('02b-admin-dashboard-after-creation')

  await signInStudent(author, config.h5, config.studentAccount)
  await discussion(author, config.h5, competition)
  await startPost(author, original, png, encoded)
  await expectPost(author, original, 'Pending')
  await author.shot('04-h5-author-pending')
  await discussion(reader, config.h5, competition)
  await reader.wait(button('Sign in to write a post'))
  await reader.wait(emptyFeed)
  await reader.wait(postCard(original), 'absent')
  await reader.shot('05-h5-public-before-approval', emptyFeed)

  await admin.reload()
  if (await metric(admin, 'Moderation queue') !== pending + 1) throw new Error('Dashboard pending count did not reflect the submission')
  await admin.shot('06-admin-pending-count')
  await moderate(admin, original, 'Pending', 'Approve', '07-admin-post-review')
  await refreshDiscussion(reader)
  await reader.click(postCard(original))
  await expectPost(reader, original, 'Approved')
  await expectImage(reader, encoded)
  await reader.shot('08-h5-public-approved-image', selector('.cm-image-button'))

  await discussion(author, config.h5, competition)
  await author.click(postCard(original))
  await interactAndComment(author, comment)
  await moderate(admin, comment, 'Pending', 'Approve', '10-admin-comment-review')
  await reader.reload()
  await expectPost(reader, original, 'Approved')
  await reader.wait(containing('.cm-body', comment))
  await reader.shot('11-h5-public-comment', containing('.cm-body', comment))

  await submitEdit(author, edited)
  await expectPost(author, edited, 'Pending')
  await moderate(admin, edited, 'Pending', 'Reject', '12-admin-edit-review', original)
  await author.reload()
  await expectPost(author, edited, 'Rejected')
  await author.shot('13-h5-author-rejected')
  await reader.reload()
  await expectPost(reader, original, 'Approved')
  await reader.wait(containing('.cm-body', edited), 'absent')
  await expectImage(reader, encoded)
  await reader.shot('14-h5-original-after-rejection', containing('.cm-body', original))

  await moderate(admin, original, 'Approved', 'Remove', '15-admin-removal-review')
  await discussion(reader, config.h5, competition)
  await refreshDiscussion(reader)
  await reader.wait(emptyFeed)
  await reader.wait(postCard(original), 'absent')
  await reader.shot('16-h5-public-after-removal', emptyFeed)
  await dashboard(admin)
  if (await metric(admin, 'Moderation queue') !== pending) throw new Error('Dashboard pending count did not return to baseline')
  await admin.shot('17-admin-final-counts')
}

async function main() {
  const config = settings()
  if (!config) return
  let temporary
  let browser
  try {
    let png
    if (config.png) png = await realpath(config.png)
    else {
      temporary = await mkdtemp(join(tmpdir(), 'codestrike-t5-png-'))
      png = join(temporary, 'discussion.png')
      await writeFile(png, Buffer.from(fixture, 'base64'))
    }
    const bytes = await readFile(png)
    if (!bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')) || bytes.length > 5 * 1024 * 1024) {
      throw new Error('--png must be a PNG of at most 5 MiB')
    }
    browser = await connect(config.cdp)
    await mkdir(config.evidence, { recursive: true })
    const id = new Date().toISOString().replace(/[:.]/g, '-') + '-' + randomUUID().slice(0, 8)
    const directory = join(config.evidence, 't5-t6-' + id)
    await mkdir(directory)
    console.log('Evidence directory: ' + directory)
    const admin = await browser.page(false, directory)
    const author = await browser.page(true, directory)
    const reader = await browser.page(true, directory)
    const competition = 'Campus Design Sprint ' + id
    const original = 'Our prototype uses four color bands. Study ' + id.slice(-8) + '.'
    const edited = 'Revised proposal for a two-color prototype. Study ' + id.slice(-8) + '.'
    const comment = 'Which color band was easiest to recognize? Study ' + id.slice(-8) + '.'
    await runJourney({ admin, author, reader, config, competition, original, edited, comment, png, encoded: bytes.toString('base64') })
    console.log('PASS: T5 student/public and T6 administrator browser journeys')
  } finally {
    browser?.close()
    if (temporary) await rm(temporary, { recursive: true })
  }
}

main().catch(error => {
  console.error('FAIL: ' + error.message)
  process.exitCode = 1
})
