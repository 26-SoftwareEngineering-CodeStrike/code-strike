import { writeFile } from 'node:fs/promises'

const [webSocketUrl, widthValue, heightValue, pageUrl, outputPath] = process.argv.slice(2)

if (!webSocketUrl || !widthValue || !heightValue || !pageUrl || !outputPath) {
  throw new Error(
    'Usage: node scripts/capture-h5.mjs <ws-url> <width> <height> <page-url> <output-path>',
  )
}

const width = Number(widthValue)
const height = Number(heightValue)
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

await send('Page.enable')
await send('Emulation.setDeviceMetricsOverride', {
  width,
  height,
  screenWidth: width,
  screenHeight: height,
  deviceScaleFactor: 1,
  mobile: true,
})
await send('Page.navigate', { url: pageUrl })
await new Promise((resolve) => setTimeout(resolve, 1400))

const screenshot = await send('Page.captureScreenshot', {
  format: 'png',
  captureBeyondViewport: false,
  fromSurface: true,
})

await writeFile(outputPath, Buffer.from(screenshot.data, 'base64'))
socket.close()
