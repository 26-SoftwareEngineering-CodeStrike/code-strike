const [webSocketUrl, baseUrl] = process.argv.slice(2)
if (!webSocketUrl || !baseUrl) throw new Error('Usage: node scripts/verify-html-wave4.mjs <ws-url> <base-url>')

const socket = new WebSocket(webSocketUrl)
const pending = new Map()
let requestId = 0
socket.addEventListener('message', (event) => { const payload = JSON.parse(String(event.data)); if (!payload.id) return; const request = pending.get(payload.id); if (!request) return; pending.delete(payload.id); payload.error ? request.reject(new Error(payload.error.message)) : request.resolve(payload.result) })
await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }) })
function send(method, params = {}) { requestId += 1; return new Promise((resolve, reject) => { pending.set(requestId, { resolve, reject }); socket.send(JSON.stringify({ id: requestId, method, params })) }) }
async function evaluate(expression) { const result = await send('Runtime.evaluate', { expression, returnByValue: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.text); return result.result.value }
const pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
async function open(file, width = 390) { await send('Emulation.setDeviceMetricsOverride', { width, height: 900, screenWidth: width, screenHeight: 900, deviceScaleFactor: 1, mobile: true }); await send('Page.navigate', { url: `${baseUrl}/${file}` }); await pause(650) }
function check(condition, label) { if (!condition) throw new Error(`FAILED: ${label}`); console.log(`PASS: ${label}`) }

await send('Page.enable'); await send('Runtime.enable')
for (const file of ['ui04-competition-hub.html', 'ui05-competition-detail.html', 'ui09-recruitment-detail.html']) {
  for (const width of [320, 390, 430]) {
    await open(file, width)
    check(await evaluate("document.readyState === 'complete' && Boolean(document.querySelector('h1'))"), `${file} renders at ${width}px`)
    check(await evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1'), `${file} has no horizontal overflow at ${width}px`)
    check(await evaluate("performance.getEntriesByType('resource').every((entry) => entry.name.startsWith('file:'))"), `${file} has no remote resource at ${width}px`)
  }
}

await open('ui04-competition-hub.html')
await evaluate("document.querySelector('#query').value='no such competition';document.querySelector('#searchForm').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))")
check(await evaluate("getComputedStyle(document.querySelector('#empty')).display === 'block' && document.querySelector('#count').textContent === '0'"), 'UI-04 search exposes an empty state')

await open('ui05-competition-detail.html')
await evaluate("document.querySelector('[data-tab=recruitment]').click()")
check(await evaluate("document.querySelector('#recruitment').classList.contains('active') && document.querySelectorAll('.recruitment').length === 3"), 'UI-05 recruitment tab is interactive')
check(!(await evaluate("document.body.innerText.includes('Team Delta')")), 'UI-05 excludes Delisted recruitment')

await open('ui09-recruitment-detail.html')
await evaluate("document.querySelector('[data-persona=unmatched]').click();document.querySelector('#apply').click()")
check(await evaluate("document.querySelector('#matchChip').textContent.includes('NOT MATCHED') && document.querySelector('#feedback').textContent.includes('Mock Pending')"), 'UI-09 Not Matched remains eligible with explicit Mock feedback')

socket.close()
