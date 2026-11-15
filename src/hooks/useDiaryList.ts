import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client'
import { isAbortError, isServiceUnavailable } from '../api/problem'
import type { DiaryListResponse, DiaryPreview } from '../types/diary'

// 'unavailable'은 서버가 잠시 쉬는 중(503), 'failed'는 그 밖의 모든 실패(네트워크, 서버 오류, problem이 아닌 응답)
export type LoadError = 'unavailable' | 'failed'

const toLoadError = (error: unknown): LoadError => isServiceUnavailable(error) ? 'unavailable' : 'failed'

const fetchPage = (cursorId?: string, signal?: AbortSignal) =>
  api.get('diary', { searchParams: cursorId ? { cursorId } : undefined, signal }).json<DiaryListResponse>()

// 일기 목록(첫 페이지 + "더 보기")을 불러오고 상태를 들고 있는다. 다음 페이지의 커서는 화면에 쓰이지 않아서 ref에 둔다.
export function useDiaryList() {
  const [diaries, setDiaries] = useState<DiaryPreview[]>([])
  const [hasNext, setHasNext] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<LoadError | null>(null)
  const nextCursorId = useRef<string | null>(null)

  const applyPage = (page: DiaryListResponse, append: boolean) => {
    setDiaries((current) => append ? [...current, ...page.items] : page.items)
    setHasNext(page.hasNext)
    nextCursorId.current = page.nextCursorId
  }

  const load = async (cursorId?: string) => {
    setLoading(true)
    setError(null)
    try {
      applyPage(await fetchPage(cursorId), Boolean(cursorId))
    } catch (requestError) {
      setError(toLoadError(requestError))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const controller = new AbortController()

    void fetchPage(undefined, controller.signal)
      .then((page) => applyPage(page, false))
      .catch((requestError: unknown) => {
        if (!isAbortError(requestError)) setError(toLoadError(requestError))
      })
      // 취소된 요청(StrictMode의 첫 번째 effect 등)이 로딩 표시를 끄면 아직 진행 중인 다음 요청 동안 빈 목록 안내가 깜빡인다.
      // 재시도 대기(최대 5초)가 생겨서 이제 눈에 보인다.
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })

    return () => controller.abort()
  }, [])

  const loadMore = () => {
    if (nextCursorId.current) void load(nextCursorId.current)
  }

  return { diaries, hasNext, loading, error, reload: () => void load(), loadMore }
}
