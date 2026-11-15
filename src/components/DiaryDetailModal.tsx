import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'
import { api } from '../api/client'
import { isAbortError, isBlankProblem, isServiceUnavailable, problemType, ProblemType, toProblem } from '../api/problem'
import { lockPageScroll } from '../lib/lockPageScroll'
import type { Diary } from '../types/diary'

const CLOSE_ANIMATION_MS = 220

// 'not-found'는 다시 시도해도 같다(없는 기록, 잘못된 주소). 나머지는 잠깐의 문제라서 다시 시도를 권한다.
type LoadError = 'not-found' | 'unavailable' | 'failed'

const ERROR_COPY: Record<LoadError, { symbol: string, title: string, message: string }> = {
  'not-found': {
    symbol: '?',
    title: '기록을 찾을 수 없어요.',
    message: '없는 기록이거나 주소가 잘못되었을 수 있어요. 목록에서 다시 열어 보세요.',
  },
  'unavailable': {
    symbol: '…',
    title: '기록을 열 수 없어요.',
    message: '서버가 잠시 쉬고 있어요. 조금 뒤에 다시 시도해 주세요.',
  },
  'failed': {
    symbol: '…',
    title: '기록을 열 수 없어요.',
    message: '잠시 연결이 불안정한 것 같아요. 잠시 후 다시 시도해 주세요.',
  },
}

function classifyLoadError(error: unknown): LoadError {
  const problem = toProblem(error)
  if (problem) {
    // 없는 일기(404)
    if (isBlankProblem(problem, 404)) return 'not-found'
    // 주소의 id를 UUID로 읽을 수 없다(400 malformed-request, parameter "id"). 서버가 id를 특정하지 못한 400(about:blank,
    // Tomcat이 직접 거절한 경우)도 이 요청에서 바뀌는 입력은 id뿐이라 같게 본다.
    if (problemType(problem) === ProblemType.MalformedRequest && problem.errors.some(({ parameter }) => parameter === 'id')) {
      return 'not-found'
    }
    if (isBlankProblem(problem, 400)) return 'not-found'
  }
  return isServiceUnavailable(error) ? 'unavailable' : 'failed'
}

export default function DiaryDetailModal() {
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [diary, setDiary] = useState<Diary | null>((location.state as Diary | null) ?? null)
  const [error, setError] = useState<LoadError | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [closing, setClosing] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    dialog.showModal()
    const unlockPageScroll = lockPageScroll()
    return () => {
      unlockPageScroll()
      if (dialog.open) dialog.close()
    }
  }, [])

  useEffect(() => {
    if (!id) return
    const controller = new AbortController()

    void api.get(`diary/${encodeURIComponent(id)}`, { signal: controller.signal }).json<Diary>()
      .then(setDiary)
      .catch((requestError: unknown) => {
        if (!isAbortError(requestError)) setError(classifyLoadError(requestError))
      })

    return () => controller.abort()
  }, [id, attempt])

  const close = () => {
    if (closing) return
    setClosing(true)
    window.setTimeout(() => {
      if (location.key === 'default') navigate('/', { replace: true })
      else navigate(-1)
    }, CLOSE_ANIMATION_MS)
  }

  const copyContent = async () => {
    if (!diary) return
    await navigator.clipboard.writeText(`${diary.title}\n\n${diary.content}`)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  const retry = () => {
    setError(null)
    setAttempt((current) => current + 1)
  }

  return (
    <dialog
      ref={dialogRef}
      className="sheet"
      data-closing={closing}
      aria-labelledby="sheet-title"
      onCancel={(event) => {
        event.preventDefault()
        close()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) close()
      }}
    >
      <article className="sheet-card">
        <div className="sheet-grabber" aria-hidden="true" />
        <div className="sheet-toolbar">
          <p className="eyebrow">A PAGE FROM MY ARCHIVE</p>
          <div className="sheet-actions">
            {diary && (
              <button className="icon-button" type="button" onClick={() => void copyContent()}>
                <span aria-hidden="true">{copied ? '✓' : '⧉'}</span>{copied ? '복사됨' : '내용 복사'}
              </button>
            )}
            <button className="sheet-close" type="button" aria-label="닫기" onClick={close}>✕</button>
          </div>
        </div>

        {/* 상태마다 key를 달아 다른 노드로 만든다. 같은 div가 재사용되면 뼈대의 제목 막대가 구분선으로 바뀌는 것처럼 보이고 레이아웃 이동으로 잡힌다 */}
        {diary ? (
          <div className="sheet-body" key="diary">
            <h2 id="sheet-title">{diary.title}</h2>
            <div className="detail-rule" />
            <p className="detail-content">{diary.content}</p>
            <footer className="detail-meta"><span>ARCHIVE ID</span><code>{diary.id}</code></footer>
          </div>
        ) : error ? (
          <div className="sheet-body sheet-state" key="error">
            <span aria-hidden="true">{ERROR_COPY[error].symbol}</span>
            <h2 id="sheet-title">{ERROR_COPY[error].title}</h2>
            <p>{ERROR_COPY[error].message}</p>
            <div className="inline-actions">
              <button className="button button-quiet" type="button" onClick={close}>닫기</button>
              {error !== 'not-found' && (
                <button className="button button-secondary" type="button" onClick={retry}>다시 시도</button>
              )}
            </div>
          </div>
        ) : (
          <div className="sheet-body detail-loading" key="loading" aria-label="기록을 불러오는 중">
            <h2 id="sheet-title" className="sr-only">기록을 불러오는 중</h2>
            <div className="skeleton-line title" />
            <div className="skeleton-line" /><div className="skeleton-line" /><div className="skeleton-line medium" />
          </div>
        )}
      </article>
    </dialog>
  )
}
