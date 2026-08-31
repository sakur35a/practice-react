import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { api } from '../api/client'
import AppHeader from '../components/AppHeader'
import type { Diary } from '../types/diary'

export default function DetailPage() {
  const { id } = useParams()
  const [diary, setDiary] = useState<Diary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const loadDiary = async () => {
    if (!id) return
    setLoading(true)
    setError('')
    try {
      setDiary(await api.get(`diary/${id}`).json<Diary>())
    } catch {
      setError('이 기록을 찾지 못했어요. 삭제되었거나 잠시 연결이 불안정할 수 있어요.')
    } finally {
      setLoading(false)
    }
  }

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
      .finally(() => setLoading(false))

    return () => controller.abort()
  }, [id])

  const copyContent = async () => {
    if (!diary) return
    await navigator.clipboard.writeText(`${diary.title}\n\n${diary.content}`)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  return (
    <div className="page-frame detail-frame">
      <AppHeader>
        <Link className="button button-quiet" to="/">← 목록</Link>
        <Link className="button button-primary" to="/write">＋ 새 기록</Link>
      </AppHeader>
      <main id="main-content" className="detail-main">
        {loading ? (
          <article className="detail-paper detail-loading" aria-label="기록을 불러오는 중">
            <div className="skeleton-line short" /><div className="skeleton-line title" />
            <div className="skeleton-line" /><div className="skeleton-line" /><div className="skeleton-line medium" />
          </article>
        ) : error || !diary ? (
          <div className="empty-state detail-error">
            <span aria-hidden="true">…</span><h1>기록을 열 수 없어요.</h1><p>{error}</p>
            <div className="inline-actions">
              <Link className="button button-quiet" to="/">목록으로</Link>
              <button className="button button-secondary" type="button" onClick={() => void loadDiary()}>다시 시도</button>
            </div>
          </div>
        ) : (
          <article className="detail-paper">
            <header className="detail-header">
              <div><p className="eyebrow">A PAGE FROM MY ARCHIVE</p><h1>{diary.title}</h1></div>
              <button className="icon-button" type="button" onClick={() => void copyContent()}>
                <span aria-hidden="true">{copied ? '✓' : '⧉'}</span>{copied ? '복사됨' : '내용 복사'}
              </button>
            </header>
            <div className="detail-rule" />
            <p className="detail-content">{diary.content}</p>
            <footer className="detail-meta"><span>ARCHIVE ID</span><code>{diary.id}</code></footer>
          </article>
        )}
      </main>
    </div>
  )
}
