import assert from 'node:assert/strict'
import { test } from 'node:test'
import { HTTPError, type NormalizedOptions } from 'ky'
import {
  fieldErrors,
  isAbortError,
  isBlankProblem,
  isServiceUnavailable,
  parseRetryAfter,
  problemType,
  ProblemType,
  retryAfterSeconds,
  toProblem,
} from './problem.ts'

// ky가 던지는 HTTPError와 같은 모양을 만든다: response(헤더, 상태)와 이미 해석된 본문(data)
function httpError(status: number, body: unknown, headers: Record<string, string> = {}, raw = false): HTTPError {
  const text = raw ? String(body) : JSON.stringify(body)
  const response = new Response(text, { status, headers })
  const error = new HTTPError(response, new Request('http://localhost/diary'), {} as NormalizedOptions)
  // ky는 JSON 계열 Content-Type이면 해석한 값을, 그 밖이면 글자를 data에 넣는다
  const contentType = headers['content-type'] ?? ''
  error.data = /json/i.test(contentType) ? (raw ? undefined : body) : text
  return error
}

const PROBLEM_JSON = { 'content-type': 'application/problem+json' }

test('validation-error 422: type, errors(pointer, code)를 읽는다', () => {
  const error = httpError(422, {
    type: ProblemType.ValidationError, title: 'Validation failed', status: 422, detail: 'x', instance: '/diary',
    errors: [{ code: 'too-long', detail: 'must be at most 255 characters', pointer: '/title' }],
  }, PROBLEM_JSON)
  const problem = toProblem(error)
  assert.ok(problem)
  assert.equal(problemType(problem), ProblemType.ValidationError)
  assert.equal(problem.status, 422)
  assert.deepEqual(problem.errors, [{ code: 'too-long', detail: 'must be at most 255 characters', pointer: '/title' }])
})

test('validation-error 400: 쿼리 입력은 parameter로 온다', () => {
  const problem = toProblem(httpError(400, {
    type: ProblemType.ValidationError, status: 400,
    errors: [{ code: 'too-large', detail: 'must be at most 100', parameter: 'size' }],
  }, PROBLEM_JSON))
  assert.equal(problem?.errors[0]?.parameter, 'size')
  assert.equal(problem?.errors[0]?.pointer, undefined)
})

test('malformed-request 400: 경로 id', () => {
  const problem = toProblem(httpError(400, {
    type: ProblemType.MalformedRequest, status: 400,
    errors: [{ code: 'invalid-format', detail: 'has an invalid format', parameter: 'id' }],
  }, PROBLEM_JSON))
  assert.equal(problemType(problem!), ProblemType.MalformedRequest)
  assert.equal(problem?.errors[0]?.parameter, 'id')
})

test('duplicate-id 409', () => {
  const problem = toProblem(httpError(409, { type: ProblemType.DuplicateId, status: 409, title: 'Duplicate diary id' }, PROBLEM_JSON))
  assert.equal(problemType(problem!), ProblemType.DuplicateId)
  assert.deepEqual(problem?.errors, [])
})

test('type이 없으면 about:blank다 (404, 503)', () => {
  const notFound = toProblem(httpError(404, { title: 'Not Found', status: 404, detail: 'x' }, PROBLEM_JSON))
  assert.ok(notFound)
  assert.equal(notFound.type, undefined)
  assert.equal(problemType(notFound), 'about:blank')
  assert.ok(isBlankProblem(notFound, 404))
  assert.ok(!isBlankProblem(notFound, 503))

  const unavailable = httpError(503, { title: 'Service Unavailable', status: 503 }, { ...PROBLEM_JSON, 'retry-after': '5' })
  assert.ok(isServiceUnavailable(unavailable))
})

test('명시한 about:blank도 같다', () => {
  const problem = toProblem(httpError(500, { type: 'about:blank', status: 500 }, PROBLEM_JSON))
  assert.ok(problem && isBlankProblem(problem, 500))
})

test('모르는 type은 그대로 돌려주되 about:blank로 오해하지 않는다', () => {
  const problem = toProblem(httpError(503, { type: 'https://example.test/problems/new', status: 503 }, PROBLEM_JSON))
  assert.ok(problem)
  assert.equal(problemType(problem), 'https://example.test/problems/new')
  assert.ok(!isBlankProblem(problem, 503))
  assert.ok(!isServiceUnavailable(httpError(503, { type: 'https://example.test/problems/new' }, PROBLEM_JSON)))
})

test('모르는 code도 읽힌다 (화면이 깨지지 않는다)', () => {
  const problem = toProblem(httpError(422, {
    type: ProblemType.ValidationError,
    errors: [{ code: 'something-new', pointer: '/title' }, { code: 'invalid', pointer: '/content' }],
  }, PROBLEM_JSON))
  assert.deepEqual(problem?.errors.map((error) => error.code), ['something-new', 'invalid'])
  const { byField, unmapped } = fieldErrors(problem!, ['title', 'content'] as const)
  assert.deepEqual(byField, { title: ['something-new'], content: ['invalid'] })
  assert.deepEqual(unmapped, [])
})

test('errors의 모양이 틀린 항목만 버린다', () => {
  const problem = toProblem(httpError(422, {
    type: ProblemType.ValidationError,
    errors: [null, 'x', { detail: 'code 없음' }, { code: 1 }, { code: '' }, { code: 'required', pointer: 7 }, { code: 'too-long', pointer: '/title' }],
  }, PROBLEM_JSON))
  assert.deepEqual(problem?.errors, [{ code: 'required' }, { code: 'too-long', pointer: '/title' }])
})

test('errors가 배열이 아니면 빈 배열이다', () => {
  assert.deepEqual(toProblem(httpError(422, { type: ProblemType.ValidationError, errors: { code: 'x' } }, PROBLEM_JSON))?.errors, [])
})

test('type이 문자열이 아니면 문서로 보지 않는다', () => {
  assert.equal(toProblem(httpError(400, { type: 7, status: 400 }, PROBLEM_JSON)), null)
  assert.equal(toProblem(httpError(400, { type: null }, PROBLEM_JSON)), null)
})

test('본문의 status가 달라도 응답의 HTTP 상태를 쓴다 (RFC 9457 3.2)', () => {
  assert.equal(toProblem(httpError(404, { status: 200, title: 'x' }, PROBLEM_JSON))?.status, 404)
})

test('problem이 아닌 JSON(Content-Type이 application/json)은 null이다', () => {
  assert.equal(toProblem(httpError(500, { error: 'boom', status: 500 }, { 'content-type': 'application/json' })), null)
})

test('Content-Type이 없으면 null이다', () => {
  assert.equal(toProblem(httpError(500, { status: 500, title: 'x' })), null)
})

test('Content-Type의 대소문자와 매개변수는 무시한다', () => {
  const error = httpError(404, { title: 'Not Found' }, { 'content-type': 'Application/Problem+JSON; charset=UTF-8' })
  assert.equal(toProblem(error)?.status, 404)
})

test('Cloudflare의 HTML 오류 페이지는 null이다', () => {
  const html = '<!DOCTYPE html><html><body>Error 502 Bad gateway</body></html>'
  assert.equal(toProblem(httpError(502, html, { 'content-type': 'text/html; charset=UTF-8' }, true)), null)
  assert.equal(isServiceUnavailable(httpError(502, html, { 'content-type': 'text/html' }, true)), false)
})

test('문서 없는 503(중간 장치)은 상태가 전부라서 사용 불가로 본다', () => {
  assert.ok(isServiceUnavailable(httpError(503, '<html>', { 'content-type': 'text/html' }, true)))
})

test('problem+json인데 본문이 비었거나 해석에 실패했다(data가 undefined)면 null이다', () => {
  const error = new HTTPError(new Response('', { status: 500, headers: PROBLEM_JSON }), new Request('http://localhost/'), {} as NormalizedOptions)
  assert.equal(toProblem(error), null)
})

test('problem+json인데 본문이 객체가 아니면 null이다 (배열, 문자열, null, 숫자)', () => {
  for (const body of [[1], 'text', null, 3]) {
    assert.equal(toProblem(httpError(500, body, PROBLEM_JSON)), null, JSON.stringify(body))
  }
})

test('네트워크 오류, 타임아웃, 취소, 이상한 값은 null이다', () => {
  assert.equal(toProblem(new TypeError('Failed to fetch')), null)
  const network = Object.assign(new Error('Request failed due to a network error'), { name: 'NetworkError' })
  assert.equal(toProblem(network), null)
  assert.equal(toProblem(Object.assign(new Error('timeout'), { name: 'TimeoutError' })), null)
  const abort = new DOMException('The operation was aborted.', 'AbortError')
  assert.equal(toProblem(abort), null)
  assert.ok(isAbortError(abort))
  assert.ok(!isAbortError(network))
  for (const value of [undefined, null, 'x', 42, {}, []]) assert.equal(toProblem(value), null)
  assert.equal(isServiceUnavailable(network), false)
  assert.equal(isAbortError(null), false)
})

test('fieldErrors: pointer를 필드로, 나머지는 unmapped로', () => {
  const problem = toProblem(httpError(422, {
    type: ProblemType.ValidationError,
    errors: [
      { code: 'nul-character', pointer: '/content' },
      { code: 'too-long', pointer: '/title' },
      { code: 'nul-character', pointer: '/title' },
      { code: 'too-long', pointer: '/title' },
      { code: 'not-uuid-v7', pointer: '/id' },
      { code: 'invalid-value', pointer: '' },
      { code: 'invalid-value', pointer: '/title/0' },
      { code: 'too-small', parameter: 'size' },
    ],
  }, PROBLEM_JSON))!
  const { byField, unmapped } = fieldErrors(problem, ['title', 'content'] as const)
  assert.deepEqual(byField, { content: ['nul-character'], title: ['too-long', 'nul-character'] })
  assert.deepEqual(unmapped.map((error) => error.code), ['not-uuid-v7', 'invalid-value', 'invalid-value', 'too-small'])
})

test('fieldErrors: JSON Pointer 이스케이프(~1, ~0)', () => {
  const problem = toProblem(httpError(422, { errors: [{ code: 'invalid', pointer: '/a~1b' }] }, PROBLEM_JSON))!
  assert.deepEqual(fieldErrors(problem, ['a/b'] as const).byField, { 'a/b': ['invalid'] })
})

test('Retry-After: 초', () => {
  assert.equal(parseRetryAfter('5'), 5)
  assert.equal(parseRetryAfter(' 12 '), 12)
})

test('Retry-After: 없음, 빈 값, 해석 불가, 음수, 소수는 fallback(5)이다', () => {
  for (const value of [null, undefined, '', '   ', 'soon', '5s', '-3', '1.5', 'NaN', '0x10']) {
    assert.equal(parseRetryAfter(value), 5, String(value))
  }
})

test('Retry-After: 0은 최소 1초이고 아주 큰 값은 상한(30초)이다', () => {
  assert.equal(parseRetryAfter('0'), 1)
  assert.equal(parseRetryAfter('3600'), 30)
  assert.equal(parseRetryAfter('99999999999999999999999'), 30)
  assert.equal(parseRetryAfter('3600', { max: 10 }), 10)
})

test('Retry-After: HTTP-date는 지금과의 차이(올림)다. 지난 날짜는 1초, 먼 날짜는 상한이다', () => {
  const now = Date.parse('2026-11-14T00:00:00Z')
  assert.equal(parseRetryAfter('Sat, 14 Nov 2026 00:00:07 GMT', { now }), 7)
  assert.equal(parseRetryAfter('Sat, 14 Nov 2026 00:00:06 GMT', { now: now + 500 }), 6) // 5.5초는 6초로 올린다
  assert.equal(parseRetryAfter('Fri, 13 Nov 2026 23:59:00 GMT', { now }), 1)
  assert.equal(parseRetryAfter('Sat, 21 Nov 2026 00:00:00 GMT', { now }), 30)
  assert.equal(parseRetryAfter('Sat, 99 Zzz 2026 00:00:00 GMT', { now }), 5)
})

test('retryAfterSeconds: 오류 응답의 헤더를 읽고, 응답이 없으면 fallback이다', () => {
  assert.equal(retryAfterSeconds(httpError(503, { status: 503 }, { ...PROBLEM_JSON, 'retry-after': '7' })), 7)
  assert.equal(retryAfterSeconds(httpError(503, { status: 503 }, PROBLEM_JSON)), 5)
  assert.equal(retryAfterSeconds(httpError(503, { status: 503 }, { ...PROBLEM_JSON, 'retry-after': 'garbage' })), 5)
  assert.equal(retryAfterSeconds(httpError(503, { status: 503 }, { ...PROBLEM_JSON, 'retry-after': '86400' })), 30)
  assert.equal(retryAfterSeconds(new TypeError('Failed to fetch')), 5)
  assert.equal(retryAfterSeconds(undefined, { fallback: 9 }), 9)
})
