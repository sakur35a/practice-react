import ky from 'ky'
import { retryPolicy } from './retryPolicy'

// 재시도: GET만, 한 번만, 502/503/504만, Retry-After는 따르되 최대 5초. POST는 절대 자동 재시도하지 않는다
// (일기가 두 번 만들어질 수 있다). 이유 전체는 retryPolicy.ts에 있다. 오류 본문은 problem.ts의 toProblem()으로 읽는다.
export const api = ky.create({
  baseUrl: import.meta.env.VITE_API_BASE_URL,
  retry: retryPolicy,
})
