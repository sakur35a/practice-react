import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'
import { api } from '../api/client'
import type { Diary } from '../types/diary'

const CLOSE_ANIMATION_MS = 220

export default function DiaryDetailModal() {
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [diary, setDiary] = useState<Diary | null>((location.state as Diary | null) ?? null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [closing, setClosing] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    dialog.showModal()
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
      if (dialog.open) dialog.close()
    }
  }, [])

  useEffect(() => {
    if (!id) return
    const controller = new AbortController()

    void api.get(`diary/${id}`, { signal: controller.signal }).json<Diary>()
      .then(setDiary)
      .catch((requestError: unknown) => {
        if ((requestError as { name?: string }).name !== 'AbortError') {
          setError('이 기록을 찾지 못했어요. 삭제되었거나 잠시 연결이 불안정할 수 있어요.')
        }
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
    setError('')
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

        {diary ? (
          <div className="sheet-body">
            <h2 id="sheet-title">{diary.title}</h2>
            <div className="detail-rule" />
            <p className="detail-content">{diary.content}</p>
            <footer className="detail-meta"><span>ARCHIVE ID</span><code>{diary.id}</code></footer>
          </div>
        ) : error ? (
          <div className="sheet-body sheet-state">
            <span aria-hidden="true">…</span>
            <h2 id="sheet-title">기록을 열 수 없어요.</h2>
            <p>{error}</p>
            <div className="inline-actions">
              <button className="button button-quiet" type="button" onClick={close}>닫기</button>
              <button className="button button-secondary" type="button" onClick={retry}>다시 시도</button>
            </div>
          </div>
        ) : (
          <div className="sheet-body detail-loading" aria-label="기록을 불러오는 중">
            <h2 id="sheet-title" className="sr-only">기록을 불러오는 중</h2>
            <div className="skeleton-line title" />
            <div className="skeleton-line" /><div className="skeleton-line" /><div className="skeleton-line medium" />
          </div>
        )}
      </article>
    </dialog>
  )
}
