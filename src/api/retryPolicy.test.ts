import assert from 'node:assert/strict'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { after, before, test } from 'node:test'
import ky, { type KyInstance } from 'ky'
import { isAbortError, isServiceUnavailable, problemType, ProblemType, retryAfterSeconds, toProblem } from './problem.ts'
import { MAX_AUTO_RETRY_WAIT_MS, retryPolicy } from './retryPolicy.ts'

// 실제 ky(2.x)와 실제 HTTP 서버로 확인한다: ky가 problem+json 본문을 error.data에 넣는지,
// 재시도 정책(GET만, 한 번만, Retry-After 상한)이 의도대로 작동하는지.

const hits = new Map<string, number>()
let server: Server
let api: KyInstance

function problem(response: ServerResponse, status: number, body: object, headers: Record<string, string> = {}) {
  response.writeHead(status, { 'content-type': 'application/problem+json', ...headers })
  response.end(JSON.stringify({ status, ...body }))
}

function handle(request: IncomingMessage, response: ServerResponse) {
  const key = `${request.method} ${request.url}`
  hits.set(key, (hits.get(key) ?? 0) + 1)
  switch (request.url) {
    case '/unavailable-5':
      return problem(response, 503, { title: 'Service Unavailable' }, { 'retry-after': '5' })
    case '/unavailable-1':
      return problem(response, 503, { title: 'Service Unavailable' }, { 'retry-after': '1' })
    case '/unavailable-huge':
      return problem(response, 503, { title: 'Service Unavailable' }, { 'retry-after': '3600' })
    case '/unavailable-then-ok':
      if (hits.get(key) === 1) return problem(response, 503, { title: 'Service Unavailable' }, { 'retry-after': '1' })
      response.writeHead(200, { 'content-type': 'application/json' })
      return response.end('{"ok":true}')
    case '/invalid':
      return problem(response, 422, {
        type: ProblemType.ValidationError,
        errors: [{ code: 'too-long', detail: 'must be at most 255 characters', pointer: '/title' }],
      })
    case '/server-fault':
      return problem(response, 500, { title: 'Internal Server Error' })
    case '/not-found':
      return problem(response, 404, { title: 'Not Found' })
    case '/bad-gateway':
      response.writeHead(502, { 'content-type': 'text/html; charset=UTF-8' })
      return response.end('<!DOCTYPE html><html><body>Bad gateway</body></html>')
    default:
      response.writeHead(404).end()
  }
}

before(async () => {
  server = createServer(handle)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo
  api = ky.create({ baseUrl: `http://127.0.0.1:${port}/`, retry: retryPolicy })
})

after(() => {
  server.close()
  server.closeAllConnections()
})

async function failureOf(run: () => Promise<unknown>): Promise<unknown> {
  try {
    await run()
  } catch (error) {
    return error
  }
  throw new Error('요청이 실패해야 한다')
}

test('ky는 problem+json 본문을 error.data에 넣어 두고 toProblem이 읽는다', async () => {
  const error = await failureOf(() => api.get('invalid').json())
  const parsed = toProblem(error)
  assert.ok(parsed)
  assert.equal(parsed.status, 422)
  assert.equal(problemType(parsed), ProblemType.ValidationError)
  assert.deepEqual(parsed.errors, [{ code: 'too-long', detail: 'must be at most 255 characters', pointer: '/title' }])
  assert.equal(hits.get('GET /invalid'), 1, '4xx는 다시 묻지 않는다')
})

test('404와 500은 다시 묻지 않는다', async () => {
  const notFound = toProblem(await failureOf(() => api.get('not-found').json()))
  assert.equal(notFound?.status, 404)
  assert.equal(notFound?.type, undefined)
  assert.equal(hits.get('GET /not-found'), 1)

  await failureOf(() => api.get('server-fault').json())
  assert.equal(hits.get('GET /server-fault'), 1)
})

test('GET 503(Retry-After 1)은 약 1초 뒤 한 번만 다시 묻고, 성공하면 성공이다', async () => {
  const started = Date.now()
  const body = await api.get('unavailable-then-ok').json<{ ok: boolean }>()
  const elapsed = Date.now() - started
  assert.equal(body.ok, true)
  assert.equal(hits.get('GET /unavailable-then-ok'), 2)
  assert.ok(elapsed >= 900 && elapsed < 3000, `경과 ${elapsed}ms`)
})

test('GET 503이 계속되면 한 번만 다시 묻고(총 2번) 사용 불가 오류를 던진다', async () => {
  const started = Date.now()
  const error = await failureOf(() => api.get('unavailable-1').json())
  const elapsed = Date.now() - started
  assert.equal(hits.get('GET /unavailable-1'), 2)
  assert.ok(isServiceUnavailable(error))
  assert.equal(retryAfterSeconds(error), 1)
  assert.ok(elapsed >= 900 && elapsed < 3000, `경과 ${elapsed}ms`)
})

test('Retry-After가 터무니없이 커도 자동 대기는 상한(5초)이다', async () => {
  const started = Date.now()
  const error = await failureOf(() => api.get('unavailable-huge').json())
  const elapsed = Date.now() - started
  assert.equal(hits.get('GET /unavailable-huge'), 2)
  assert.ok(elapsed >= MAX_AUTO_RETRY_WAIT_MS - 200 && elapsed < MAX_AUTO_RETRY_WAIT_MS + 2000, `경과 ${elapsed}ms`)
  // 화면의 카운트다운은 별도 상한(30초)을 쓴다
  assert.equal(retryAfterSeconds(error), 30)
})

test('문서 없는 502(HTML)도 GET은 한 번 다시 묻고, 오류는 problem이 아니다', async () => {
  const error = await failureOf(() => api.get('bad-gateway').json())
  assert.equal(hits.get('GET /bad-gateway'), 2)
  assert.equal(toProblem(error), null)
})

test('POST는 503이어도 다시 보내지 않는다', async () => {
  const error = await failureOf(() => api.post('unavailable-5', { json: { title: 't', content: 'c' } }).json())
  assert.equal(hits.get('POST /unavailable-5'), 1)
  assert.ok(isServiceUnavailable(error))
  assert.equal(retryAfterSeconds(error), 5)
})

test('취소는 problem이 아니고 AbortError다', async () => {
  const controller = new AbortController()
  const pending = failureOf(() => api.get('unavailable-5', { signal: controller.signal }).json())
  setTimeout(() => controller.abort(), 200)
  const error = await pending
  assert.ok(isAbortError(error), String((error as Error)?.name))
  assert.equal(toProblem(error), null)
})

test('연결할 수 없는 서버(네트워크 오류)는 problem이 아니고 한 번만 다시 시도한다', async () => {
  const probe = createServer()
  await new Promise<void>((resolve) => probe.listen(0, '127.0.0.1', resolve))
  const { port } = probe.address() as AddressInfo
  await new Promise<void>((resolve) => probe.close(() => resolve()))

  const started = Date.now()
  const error = await failureOf(() => ky.create({ baseUrl: `http://127.0.0.1:${port}/`, retry: retryPolicy }).get('diary').json())
  const elapsed = Date.now() - started
  assert.equal(toProblem(error), null)
  assert.equal(isServiceUnavailable(error), false)
  assert.equal(retryAfterSeconds(error), 5)
  assert.ok(elapsed >= 900 && elapsed < 4000, `경과 ${elapsed}ms`)
})
