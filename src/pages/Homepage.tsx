import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { api } from '../api/client'
import AppHeader from '../components/AppHeader'
import type { DiaryListResponse, DiaryPreview } from '../types/diary'

export default function HomePage() {
  const [diaries, setDiaries] = useState<DiaryPreview[]>([])
  const [nextCursorId, setNextCursorId] = useState<string | null>(null)
  const [hasNext, setHasNext] = useState(false)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadDiaries = async (cursorId?: string) => {
    setLoading(true)
    setError('')
    try {
      const response = await api
        .get('diary', { searchParams: cursorId ? { cursorId } : undefined })
        .json<DiaryListResponse>()
      setDiaries((current) => cursorId ? [...current, ...response.items] : response.items)
      setHasNext(response.hasNext)
      setNextCursorId(response.nextCursorId)
    } catch {
      setError('기록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const controller = new AbortController()

    void api.get('diary', { signal: controller.signal }).json<DiaryListResponse>()
      .then((response) => {
        setDiaries(response.items)
        setHasNext(response.hasNext)
        setNextCursorId(response.nextCursorId)
      })
      .catch((requestError: unknown) => {
        if ((requestError as { name?: string }).name !== 'AbortError') {
          setError('기록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.')
        }
      })
      .finally(() => setLoading(false))

    return () => controller.abort()
  }, [])

  const visibleDiaries = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('ko')
    if (!normalizedQuery) return diaries
    return diaries.filter(({ title, content }) =>
      `${title} ${content}`.toLocaleLowerCase('ko').includes(normalizedQuery),
    )
  }, [diaries, query])

  return (
    <>
      <div className="page-frame">
        <AppHeader>
          <Link className="button button-primary" to="/write"><span aria-hidden="true">＋</span> 새 기록</Link>
        </AppHeader>

        <main id="main-content">
          <section className="hero" aria-labelledby="page-title">
            <div>
              <p className="eyebrow">A SPACE FOR YOUR MOMENTS</p>
              <h1 id="page-title">오늘의 마음을,<br />오래 남도록.</h1>
              <p className="hero-copy">지나가는 생각과 소중한 순간을 조용히 모아두는 공간이에요.</p>
            </div>
            <div className="hero-orbit" aria-hidden="true"><span>오늘</span><i /></div>
          </section>

          <section className="archive" aria-labelledby="archive-title">
            <div className="section-heading">
              <div><p className="eyebrow">MY ARCHIVE</p><h2 id="archive-title">기록 보관함</h2></div>
              <label className="search-field">
                <span className="sr-only">불러온 기록 검색</span><span aria-hidden="true">⌕</span>
                <input type="search" value={query} onChange={(event) => setQuery(event.currentTarget.value)} placeholder="기록 검색" />
              </label>
            </div>

            {loading && diaries.length === 0 ? (
              <div className="diary-grid" aria-label="기록을 불러오는 중">
                {[1, 2, 3].map((item) => <div className="diary-card skeleton" key={item} />)}
              </div>
            ) : error && diaries.length === 0 ? (
              <div className="empty-state">
                <span aria-hidden="true">↻</span><h3>잠시 연결이 매끄럽지 않아요.</h3><p>{error}</p>
                <button className="button button-secondary" type="button" onClick={() => void loadDiaries()}>다시 불러오기</button>
              </div>
            ) : visibleDiaries.length === 0 ? (
              <div className="empty-state">
                <span aria-hidden="true">✦</span>
                <h3>{query ? '검색 결과가 없어요.' : '첫 기록을 기다리고 있어요.'}</h3>
                <p>{query ? '다른 단어로 찾아보세요.' : '지금 떠오른 한 문장부터 가볍게 시작해 보세요.'}</p>
                {!query && <Link className="button button-secondary" to="/write">첫 기록 남기기</Link>}
              </div>
            ) : (
              <>
                <div className="diary-grid">
                  {visibleDiaries.map((diary, index) => (
                    <Link className="diary-card" to={`/diary/${diary.id}`} key={diary.id}>
                      <span className="card-number">{String(index + 1).padStart(2, '0')}</span>
                      <div><h3>{diary.title}</h3><p>{diary.content}</p></div>
                      <span className="card-arrow" aria-hidden="true">↗</span>
                    </Link>
                  ))}
                </div>
                {hasNext && !query && (
                  <div className="load-more">
                    <button
                      className="button button-secondary"
                      type="button"
                      disabled={loading}
                      onClick={() => { if (nextCursorId) void loadDiaries(nextCursorId) }}
                    >
                      {loading ? '불러오는 중…' : '기록 더 보기'}
                    </button>
                    {error && <p role="alert">{error}</p>}
                  </div>
                )}
              </>
            )}
          </section>
        </main>
      </div>
      <footer className="site-footer">
        <p>매일의 마음이 쌓여, 나만의 이야기가 됩니다.</p>
        <span>ITS DIARY · {new Date().getFullYear()}</span>
      </footer>
    </>
  )
}
