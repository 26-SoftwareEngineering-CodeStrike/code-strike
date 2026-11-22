import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, join, normalize, resolve } from 'node:path'

const root = resolve(process.argv[2])
const port = Number(process.argv[3] ?? 4173)

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', 'http://127.0.0.1')
  const relative = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '')
  let filePath = join(root, relative)
  try {
    const info = await stat(filePath)
    if (info.isDirectory()) filePath = join(filePath, 'index.html')
  } catch {
    filePath = join(root, 'index.html')
  }
  response.setHeader('Content-Type', TYPES[extname(filePath)] ?? 'application/octet-stream')
  createReadStream(filePath)
    .on('error', () => {
      response.statusCode = 404
      response.end('not found')
    })
    .pipe(response)
})

server.listen(port, '127.0.0.1', () => {
  console.log(`serving ${root} on http://127.0.0.1:${port}`)
})
