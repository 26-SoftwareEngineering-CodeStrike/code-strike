import assert from 'node:assert/strict'
import { HttpTransport } from '../packages/api-contracts/src/http/index.ts'
import { createAdminHttpTransport } from '../apps/admin-web/src/api/http-transport.ts'

const baseUrl = process.env.CODE_STRIKE_API_BASE_URL ?? 'http://127.0.0.1:8000/api/v1'
const results = []

async function check(name, run) {
  try {
    await run()
    results.push({ name, ok: true })
    console.log(`PASS: ${name}`)
  } catch (error) {
    results.push({ name, ok: false, error })
    console.log(`FAIL: ${name}`)
    console.log(`      ${error?.message ?? error}`)
  }
}

function fetchAdapter() {
  return async (request) => {
    const response = await fetch(request.url, {
      method: request.method,
      headers: request.header,
      body: request.data === undefined ? undefined : JSON.stringify(request.data),
    })
    const text = await response.text()
    let data = null
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = text
    }
    return { statusCode: response.status, data, header: Object.fromEntries(response.headers) }
  }
}

const transport = new HttpTransport({ baseUrl, adapter: fetchAdapter() })
const adminTransport = createAdminHttpTransport({ baseUrl, adapter: fetchAdapter() })

console.log(`=== T2 LIVE API CHECK: ${baseUrl} ===`)

await check('GET /health returns the HealthResponse contract', async () => {
  const health = await transport.request({ path: '/health' })
  assert.equal(health.status, 'ok')
  assert.equal(typeof health.service, 'string')
  assert.equal(health.api_version, 'v1')
})

await check('a protected route without a token is rejected locally and never reaches the server', async () => {
  await assert.rejects(
    () => transport.request({ path: '/dashboard', auth: 'required' }),
    (error) => {
      assert.equal(error.status, 401)
      assert.equal(error.code, 'UNAUTHENTICATED')
      return true
    },
  )
})

await check('a protected route without a token is answered by the backend as 401', async () => {
  await assert.rejects(
    () => transport.request({ path: '/dashboard' }),
    (error) => {
      assert.equal(error.status, 401)
      assert.equal(error.code, 'UNAUTHENTICATED')
      assert.equal(error.message, 'Sign in is required.')
      assert.equal(error.isUnauthorized, true)
      return true
    },
  )
})

await check('the admin transport maps the backend 401 onto the shared error surface', async () => {
  await assert.rejects(
    () => adminTransport.request({ path: '/dashboard' }),
    (error) => {
      assert.equal(error.status, 401)
      assert.equal(error.code, 'UNAUTHENTICATED')
      return true
    },
  )
})

await check('an unavailable database is reported as 503', async () => {
  await assert.rejects(
    () => transport.request({ path: '/competitions' }),
    (error) => {
      assert.equal(error.status, 503)
      assert.equal(error.code, 'DATABASE_UNAVAILABLE')
      assert.equal(error.isServiceUnavailable, true)
      return true
    },
  )
})

await check('an unknown route keeps the backend error code', async () => {
  await assert.rejects(
    () => transport.request({ path: '/does-not-exist' }),
    (error) => {
      assert.equal(error.status, 404)
      assert.equal(error.code, 'HTTP_ERROR')
      assert.equal(error.isNotFound, true)
      return true
    },
  )
})

await check('the served schema still matches the captured OpenAPI document', async () => {
  const served = await (await fetch(`${baseUrl}/openapi.json`)).json()
  const captured = JSON.parse(
    await (await import('node:fs/promises')).readFile(
      new URL('../docs/evidence/assignment5-alpha/sprint-new/openapi.json', import.meta.url),
      'utf8',
    ),
  )
  assert.equal(Object.keys(served.paths).length, Object.keys(captured.paths).length)
  assert.equal(
    Object.keys(served.components.schemas).length,
    Object.keys(captured.components.schemas).length,
  )
})

const failures = results.filter((result) => !result.ok).length
console.log(`--- ${results.length - failures}/${results.length} checks passed ---`)
process.exit(failures === 0 ? 0 : 1)
