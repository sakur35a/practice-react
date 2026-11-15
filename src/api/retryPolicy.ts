import type { RetryOptions } from 'ky'

// 자동 재시도 정책. 기준: 읽기(GET)만, 한 번만, 기다리는 시간에 상한.
//
// - GET만: 쓰기(POST)는 되풀이하면 일기가 두 번 만들어질 수 있다(클라이언트가 id를 보내지 않아 서버가 중복을 가려내지 못한다).
//   저장 재시도는 사용자가 결정한다(쓰기 화면이 Retry-After 동안 저장 버튼을 쉬게 하고, 내용은 이 기기에 남아 있다).
// - 한 번만(ky 기본은 두 번): 서버 DB가 내려가면 목록은 5초 쉬었다 한 번 더 묻고 그 뒤 화면이 "잠시 쉬고 있어요"를 보여 준다.
//   기본값이면 Retry-After 5초 x 2 = 약 10초 동안 스켈레톤만 보인다.
//   그 이상은 사용자가 "다시 불러오기"로 다시 묻는다.
// - 502, 503, 504만: 배포나 터널 재시작으로 잠깐 끊기는 경우(Cloudflare가 502, 504를 낸다)와 DB 점검(503)이다.
//   500은 서버 결함이라 다시 물어도 같고(재시도가 부하만 키운다), 408, 413, 429는 이 API가 내지 않는다.
//   429를 다시 묻는 것은 속도 제한을 더 때리는 일이다. 4xx는 요청이 틀렸다는 뜻이라 되풀이해도 같다.
// - Retry-After는 따르되 최대 5초(maxRetryAfter): 서버는 5초를 보낸다. 중간 장치가 수천 초를 보내도 화면이 멈추지 않는다.
//   ky 기본은 상한이 없다(Infinity). Retry-After가 없을 때는 1초 뒤.
// - 타임아웃(ky 기본 시도당 10초)은 다시 묻지 않는다(retryOnTimeout 기본값 false): 느린 서버에 요청을 쌓지 않는다.
export const MAX_AUTO_RETRY_WAIT_MS = 5_000

export const retryPolicy: RetryOptions = {
  limit: 1,
  methods: ['get'],
  statusCodes: [502, 503, 504],
  afterStatusCodes: [503],
  maxRetryAfter: MAX_AUTO_RETRY_WAIT_MS,
  delay: () => 1_000,
  backoffLimit: MAX_AUTO_RETRY_WAIT_MS,
}
