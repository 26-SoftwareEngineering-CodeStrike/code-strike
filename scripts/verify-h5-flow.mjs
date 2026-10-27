const [webSocketUrl, baseUrl] = process.argv.slice(2)

if (!webSocketUrl || !baseUrl) {
  throw new Error('Usage: node scripts/verify-h5-flow.mjs <ws-url> <base-url>')
}

const socket = new WebSocket(webSocketUrl)
const pending = new Map()
let requestId = 0

socket.addEventListener('message', (event) => {
  const payload = JSON.parse(String(event.data))
  if (!payload.id) return
  const request = pending.get(payload.id)
  if (!request) return
  pending.delete(payload.id)
  if (payload.error) request.reject(new Error(payload.error.message))
  else request.resolve(payload.result)
})

await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true })
  socket.addEventListener('error', reject, { once: true })
})

function send(method, params = {}) {
  requestId += 1
  const id = requestId
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    socket.send(JSON.stringify({ id, method, params }))
  })
}

async function evaluate(expression) {
  const result = await send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  })
  if (result.exceptionDetails) {
    throw new Error(
      result.exceptionDetails.exception?.description || result.exceptionDetails.text,
    )
  }
  return result.result.value
}

async function pause(milliseconds = 500) {
  await new Promise((resolve) => setTimeout(resolve, milliseconds))
}

async function navigate(hashPath) {
  await send('Page.navigate', { url: `${baseUrl}/#${hashPath}` })
  await pause(1200)
}

function check(condition, label) {
  if (!condition) throw new Error(`FAILED: ${label}`)
  console.log(`PASS: ${label}`)
}

await send('Page.enable')
await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride', {
  width: 390,
  height: 900,
  screenWidth: 390,
  screenHeight: 900,
  deviceScaleFactor: 1,
  mobile: true,
})

await navigate('/pages/index/index')
check(await evaluate("document.body.innerText.includes('Explore competitions')"), 'UI-04 renders')
check((await evaluate("document.querySelectorAll('.card').length")) === 2, 'published competition cards render')

await evaluate("document.querySelector('.card').click()")
await pause(900)
check(await evaluate("location.hash.includes('/pages/competition/detail')"), 'Hub card navigates to UI-05')
check(await evaluate("document.querySelector('.info-card') !== null"), 'UI-05 overview renders')

await evaluate("Array.from(document.querySelectorAll('.tabs__item')).find((item) => item.textContent.trim() === 'Recruitment').click()")
await pause(250)
check((await evaluate("document.querySelectorAll('.recruitment').length")) === 4, 'public recruitment list excludes delisted fixture')
check(await evaluate("document.body.innerText.includes('PROTOTYPE-ONLY MODERATION PREVIEW')"), 'delisted state is isolated in prototype preview')

await evaluate("document.querySelector('.recruitment').click()")
await pause(900)
check(await evaluate("location.hash.includes('/pages/recruitment/detail')"), 'Recruitment card navigates to UI-09')
check(await evaluate("document.body.innerText.includes('Team Alpha')"), 'UI-09 open matched scenario renders')

await evaluate("Array.from(document.querySelectorAll('.scenario-chip')).find((item) => item.textContent.includes('Not matched')).click()")
await pause(700)
check(await evaluate("document.body.innerText.includes('Team Beta') && document.body.innerText.includes('NOT MATCHED')"), 'not-matched scenario renders without blocking apply')

await evaluate("Array.from(document.querySelector('.persona-switcher__actions').children).find((item) => item.textContent.includes('Complete student')).click()")
await evaluate("document.querySelector('.apply-button').click()")
await pause(250)
check(await evaluate("document.body.innerText.includes('Application Pending')"), 'complete-student apply returns mock Pending feedback')

await evaluate("Array.from(document.querySelectorAll('.scenario-chip')).find((item) => item.textContent.trim() === 'Full').click()")
await pause(700)
check(await evaluate("document.body.innerText.includes('This team is full.')"), 'full scenario shows exact business feedback')

await navigate('/pages/index/index')
await evaluate("document.querySelector('.prototype-panel__button').click()")
await pause(700)
check(await evaluate("document.body.innerText.includes('Competition feed unavailable')"), 'mock load failure state renders')

await navigate('/pages/index/index')
const searchInputFocused = await evaluate(`(() => {
  const input = document.querySelector('.search-box__input input') || document.querySelector('input')
  if (!input) return false
  input.focus()
  return true
})()`)
check(searchInputFocused, 'search input is reachable')
await send('Input.insertText', { text: 'No such competition' })
await pause(250)
check(
  await evaluate("document.querySelectorAll('.card').length === 0 && document.querySelector('.state') !== null"),
  'empty search state renders',
)

socket.close()
