import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useDiaryList, type LoadError } from '../hooks/useDiaryList'
import type { DiaryPreview } from '../types/diary'

const ERROR_COPY: Record<LoadError, { title: string, message: string }> = {
  unavailable: { title: '서버가 잠시 쉬고 있어요.', message: '조금 뒤에 다시 불러와 주세요.' },
  failed: { title: '잠시 연결이 매끄럽지 않아요.', message: '기록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.' },
}

// '기록 더 보기' 아래에 한 줄로 보이는 문구
const INLINE_ERROR: Record<LoadError, string> = {
  unavailable: '서버가 잠시 쉬고 있어요. 조금 뒤에 다시 불러와 주세요.',
  failed: ERROR_COPY.failed.message,
}

function filterDiaries(diaries: DiaryPreview[], query: string): DiaryPreview[] {
  const normalizedQuery = query.trim().toLocaleLowerCase('ko')
  if (!normalizedQuery) return diaries
  return diaries.filter(({ title, content }) =>
    `${title} ${content}`.toLocaleLowerCase('ko').includes(normalizedQuery),
  )
}

function LoadErrorState({ error, onRetry }: { error: LoadError, onRetry: () => void }) {
  return (
    <div className="empty-state">
      <span aria-hidden="true">↻</span><h3>{ERROR_COPY[error].title}</h3><p>{ERROR_COPY[error].message}</p>
      <button className="button button-secondary" type="button" onClick={onRetry}>다시 불러오기</button>
    </div>
  )
}

function EmptyState({ searching }: { searching: boolean }) {
  return (
    <div className="empty-state">
      <span aria-hidden="true">✦</span>
      <h3>{searching ? '검색 결과가 없어요.' : '첫 기록을 기다리고 있어요.'}</h3>
      <p>{searching ? '다른 단어로 찾아보세요.' : '지금 떠오른 한 문장부터 가볍게 시작해 보세요.'}</p>
      {!searching && <Link className="button button-secondary" to="/write">첫 기록 남기기</Link>}
    </div>
  )
}

function DiaryGrid({ diaries }: { diaries: DiaryPreview[] }) {
  return (
    <div className="diary-grid">
      {diaries.map((diary, index) => (
        <Link className="diary-card" to={`/diary/${diary.id}`} state={diary} preventScrollReset key={diary.id}>
          <span className="card-number">{String(index + 1).padStart(2, '0')}</span>
          <div><h3>{diary.title}</h3><p>{diary.content}</p></div>
          <span className="card-arrow" aria-hidden="true">↗</span>
        </Link>
      ))}
    </div>
  )
}

interface LoadMoreProps {
  loading: boolean
  error: LoadError | null
  onLoadMore: () => void
}

function LoadMore({ loading, error, onLoadMore }: LoadMoreProps) {
  return (
    <div className="load-more">
      <button className="button button-secondary" type="button" disabled={loading} onClick={onLoadMore}>
        {loading ? '불러오는 중…' : '기록 더 보기'}
      </button>
      {error && <p role="alert">{INLINE_ERROR[error]}</p>}
    </div>
  )
}

interface ArchiveBodyProps {
  diaries: DiaryPreview[]
  visibleDiaries: DiaryPreview[]
  query: string
  hasNext: boolean
  loading: boolean
  error: LoadError | null
  onReload: () => void
  onLoadMore: () => void
}

// 불러오는 중, 불러오기 실패, 비어 있음, 목록 중 지금 보여 줄 것 하나
function ArchiveBody({ diaries, visibleDiaries, query, hasNext, loading, error, onReload, onLoadMore }: ArchiveBodyProps) {
  const noneLoaded = diaries.length === 0
  if (loading && noneLoaded) {
    return (
      <div className="diary-grid" aria-label="기록을 불러오는 중">
        {[1, 2, 3].map((item) => <div className="diary-card skeleton" key={item} />)}
      </div>
    )
  }
  if (error && noneLoaded) return <LoadErrorState error={error} onRetry={onReload} />
  if (visibleDiaries.length === 0) return <EmptyState searching={Boolean(query)} />

  return (
    <>
      <DiaryGrid diaries={visibleDiaries} />
      {hasNext && !query && <LoadMore loading={loading} error={error} onLoadMore={onLoadMore} />}
    </>
  )
}

export default function DiaryArchive() {
  const { diaries, hasNext, loading, error, reload, loadMore } = useDiaryList()
  const [query, setQuery] = useState('')
  const visibleDiaries = useMemo(() => filterDiaries(diaries, query), [diaries, query])

  return (
    <section className="archive" aria-labelledby="archive-title">
      <div className="section-heading">
        <div><p className="eyebrow">MY ARCHIVE</p><h2 id="archive-title">기록 보관함</h2></div>
        <label className="search-field">
          <span className="sr-only">불러온 기록 검색</span><span aria-hidden="true">⌕</span>
          <input type="search" value={query} onChange={(event) => setQuery(event.currentTarget.value)} placeholder="기록 검색" />
        </label>
      </div>
      <ArchiveBody
        diaries={diaries}
        visibleDiaries={visibleDiaries}
        query={query}
        hasNext={hasNext}
        loading={loading}
        error={error}
        onReload={reload}
        onLoadMore={loadMore}
      />
    </section>
  )
}
