import { isHTTPError } from 'ky'

// 백엔드의 오류 계약(RFC 9457 problem details + RFC 9110 상태 코드)을 읽는 얇은 층이다.
// 계약 원문: 백엔드 저장소 deploy/README.md "오류 계약".
//
// 원칙
// - 분기는 `type`과 `errors[].code`로 한다. `title`, `detail`, `errors[].detail`은 서버가 고정해 둔 영어 문구라서
//   사용자에게 보이지도, 분기에 쓰지도 않는다.
// - 상태 코드(`status`)만으로 뜻이 다 전해지는 about:blank 오류(404, 503 …)에서만 상태로 분기한다.
// - 이 층은 "읽다가 실패하면 null"이다. 본문이 문서가 아니거나(HTML 오류 페이지, 빈 본문), 형식이 틀렸거나, 네트워크
//   오류이거나, 취소(abort)이면 null을 돌려주고, 부르는 쪽은 일반 오류 경로로 처리한다.

// 이 URI들은 식별자일 뿐 주소가 아니다(RFC 9457 3.1.1). 열어 보거나 가져오지 않는다.
// 서버가 개발 환경에서도 같은 값을 보내므로 환경과 무관하게 고정이다.
const PROBLEM_TYPE_BASE = 'https://api.ssobbs13.pp.ua/problems/'

export const ProblemType = {
  Blank: 'about:blank',
  ValidationError: `${PROBLEM_TYPE_BASE}validation-error`,
  MalformedRequest: `${PROBLEM_TYPE_BASE}malformed-request`,
  DuplicateId: `${PROBLEM_TYPE_BASE}duplicate-id`,
} as const

// 서버가 알려 주는 `errors[].code`. 서버가 코드를 더해도 화면이 깨지지 않도록 `string`도 받는다(아래 ProblemFieldError).
export const KNOWN_ERROR_CODES = [
  'required', 'too-long', 'not-uuid-v7', 'nul-character',
  'too-small', 'too-large', 'invalid-value', 'invalid-format', 'invalid',
] as const

export interface ProblemFieldError {
  // 알 수 없는 값일 수 있다. 모르는 코드는 "그 필드가 틀렸다"까지만 뜻한다.
  code: string
  // 영어 서버 문구. 화면에 쓰지 않는다(디버깅 로그용).
  detail?: string
  // 요청 본문 안의 위치(RFC 6901 JSON Pointer). 예: "/title". 본문 전체를 가리키면 "".
  pointer?: string
  // 쿼리나 경로 입력의 이름. 예: "size", "cursorId", "id".
  parameter?: string
}

export interface Problem {
  // 없으면 about:blank. 읽을 때는 problemType()을 쓴다.
  type?: string
  title?: string
  // 응답의 HTTP 상태. 본문의 `status`는 중간 장치가 바꿨을 때를 위한 참고값이라(RFC 9457 3.2) 쓰지 않는다.
  status: number
  detail?: string
  instance?: string
  // 본문에 없으면 빈 배열
  errors: ProblemFieldError[]
}

export function problemType(problem: Problem): string {
  return problem.type ?? ProblemType.Blank
}

// 상태 코드만으로 뜻이 다 전해지는 오류인지(about:blank)와 그 상태인지
export function isBlankProblem(problem: Problem, status: number): boolean {
  return problemType(problem) === ProblemType.Blank && problem.status === status
}

const PROBLEM_MEDIA_TYPE = 'application/problem+json'

function isProblemMediaType(contentType: string | null): boolean {
  if (!contentType) return false
  return contentType.split(';', 1)[0]!.trim().toLowerCase() === PROBLEM_MEDIA_TYPE
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function parseFieldError(value: unknown): ProblemFieldError | null {
  if (!isRecord(value) || typeof value.code !== 'string' || value.code === '') return null
  const error: ProblemFieldError = { code: value.code }
  const detail = optionalString(value.detail)
  const pointer = optionalString(value.pointer)
  const parameter = optionalString(value.parameter)
  if (detail !== undefined) error.detail = detail
  if (pointer !== undefined) error.pointer = pointer
  if (parameter !== undefined) error.parameter = parameter
  return error
}

// 이미 해석된 JSON 본문을 Problem으로 바꾼다. 문서로 볼 수 없으면 null.
// `type`이 문자열이 아니면 분기할 수 없는 문서라서 null이다. `errors`는 항목 단위로 걸러 낸다(모양이 틀린 항목만 버린다).
export function parseProblem(data: unknown, status: number): Problem | null {
  if (!Number.isInteger(status) || status < 400 || status > 599) return null
  if (!isRecord(data)) return null
  if (data.type !== undefined && typeof data.type !== 'string') return null

  const problem: Problem = {
    status,
    errors: Array.isArray(data.errors)
      ? data.errors.map(parseFieldError).filter((error) => error !== null)
      : [],
  }
  const type = optionalString(data.type)
  const title = optionalString(data.title)
  const detail = optionalString(data.detail)
  const instance = optionalString(data.instance)
  if (type !== undefined) problem.type = type
  if (title !== undefined) problem.title = title
  if (detail !== undefined) problem.detail = detail
  if (instance !== undefined) problem.instance = instance
  return problem
}

// ky가 던진 값에서 problem 문서를 꺼낸다. ky는 오류 본문을 이미 읽어 `error.data`에 넣어 둔다
// (`+json` 계열 Content-Type이면 JSON으로 해석한다). 그래서 `response.json()`은 부르지 않는다(이미 소비됐다).
// problem 문서가 아니면 null: HTTPError가 아닌 것(네트워크 오류, 타임아웃, 취소), Content-Type이 problem+json이 아닌 응답
// (Cloudflare의 HTML 오류 페이지, 다른 JSON), 본문이 비었거나 해석에 실패한 응답.
export function toProblem(error: unknown): Problem | null {
  if (!isHTTPError(error)) return null
  const { response, data } = error
  if (!isProblemMediaType(response.headers.get('content-type'))) return null
  return parseProblem(data, response.status)
}

// 데이터베이스를 쓸 수 없어 서버가 잠시 일을 못 하는 상태(503). problem 문서가 있으면 about:blank 503만 인정하고
// (모르는 type의 503은 일반 오류 경로로 둔다), 문서가 없는 503(Cloudflare 등 중간 장치)은 상태가 전부라서 그대로 인정한다.
export function isServiceUnavailable(error: unknown): boolean {
  const problem = toProblem(error)
  if (problem) return isBlankProblem(problem, 503)
  return isHTTPError(error) && error.response.status === 503
}

// fetch를 취소했을 때(AbortController) 나오는 오류. 오류로 보여 주지 않는다.
export function isAbortError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { name?: unknown }).name === 'AbortError'
}

export interface RetryAfterOptions {
  // 헤더가 없거나 읽을 수 없을 때의 초. 서버가 보내는 값(5)과 같다.
  fallback?: number
  min?: number
  // 서버나 중간 장치가 터무니없이 큰 값을 보내도 화면이 그만큼 멈추지 않게 하는 상한
  max?: number
  // 테스트에서 시계를 고정하려고 둔 값(HTTP-date 형식 계산용)
  now?: number
}

export const RETRY_AFTER_FALLBACK_SECONDS = 5
export const RETRY_AFTER_MAX_SECONDS = 30

// Retry-After 헤더 값 하나를 "기다릴 초(정수, 올림)"로 바꾼다 (RFC 9110 10.2.3: 초 또는 HTTP-date).
// 없음, 해석 불가, 음수는 fallback. 0이나 이미 지난 날짜는 min(기본 1초: 즉시 다시 누르는 연타를 막는다). 상한은 max.
export function parseRetryAfter(value: string | null | undefined, options: RetryAfterOptions = {}): number {
  const {
    fallback = RETRY_AFTER_FALLBACK_SECONDS,
    min = 1,
    max = RETRY_AFTER_MAX_SECONDS,
    now = Date.now(),
  } = options
  const clamp = (seconds: number) => Math.min(max, Math.max(min, Math.ceil(seconds)))

  const text = value?.trim()
  if (!text) return clamp(fallback)
  if (/^\d+$/.test(text)) {
    const seconds = Number(text)
    return Number.isFinite(seconds) ? clamp(seconds) : clamp(max)
  }
  // HTTP-date. 숫자가 섞인 아무 문자열이나 Date.parse가 받아 주므로 요일로 시작하는 형식만 인정한다(IMF-fixdate 등)
  if (/^[A-Za-z]{3,9},?\s/.test(text)) {
    const at = Date.parse(text)
    if (Number.isFinite(at)) return clamp((at - now) / 1000)
  }
  return clamp(fallback)
}

// 오류 응답의 Retry-After를 초로 읽는다. 응답이 없는 오류(네트워크 오류 등)는 fallback이다.
// 헤더는 서버가 Access-Control-Expose-Headers로 노출해야 브라우저 JS가 읽을 수 있다(백엔드가 한다).
export function retryAfterSeconds(error: unknown, options: RetryAfterOptions = {}): number {
  const header = isHTTPError(error) ? error.response.headers.get('retry-after') : null
  return parseRetryAfter(header, options)
}

// 검증 오류를 폼 필드별로 모은다. pointer가 "/title"처럼 최상위 필드 하나를 가리키고 그 필드가 `fields`에 있으면
// byField[필드]에 code를 쌓고, 나머지(알 수 없는 필드, 본문 전체 "", 중첩 경로, parameter 오류)는 unmapped로 돌려준다.
// 같은 code는 한 번만 담는다. 순서는 서버가 준 순서를 지킨다.
export function fieldErrors<F extends string>(
  problem: Problem,
  fields: readonly F[],
): { byField: Partial<Record<F, string[]>>, unmapped: ProblemFieldError[] } {
  const byField: Partial<Record<F, string[]>> = {}
  const unmapped: ProblemFieldError[] = []
  const known = new Set<string>(fields)

  for (const error of problem.errors) {
    const field = topLevelField(error.pointer)
    if (field === null || !known.has(field)) {
      unmapped.push(error)
      continue
    }
    const key = field as F
    const codes = byField[key] ?? (byField[key] = [])
    if (!codes.includes(error.code)) codes.push(error.code)
  }
  return { byField, unmapped }
}

// "/title" -> "title". "", "title", "/a/b"(중첩)는 null. RFC 6901의 ~1, ~0을 풀어 쓴다.
function topLevelField(pointer: string | undefined): string | null {
  if (!pointer || !pointer.startsWith('/')) return null
  const token = pointer.slice(1)
  if (token.includes('/')) return null
  return token.replaceAll('~1', '/').replaceAll('~0', '~')
}

// 개발 중 원인을 볼 수 있게 problem의 구조만 로그로 남긴다. 요청 본문(일기 내용)은 절대 넣지 않는다.
export function describeProblem(error: unknown): Record<string, unknown> {
  const problem = toProblem(error)
  if (problem) {
    return {
      status: problem.status,
      type: problemType(problem),
      instance: problem.instance,
      errors: problem.errors.map(({ code, pointer, parameter }) => ({ code, pointer, parameter })),
    }
  }
  if (isHTTPError(error)) return { status: error.response.status, problem: false }
  return { name: (error as { name?: unknown } | null)?.name ?? typeof error, problem: false }
}
