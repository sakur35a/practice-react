import { useEffect, useState, type SubmitEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { api } from '../api/client'
import AppHeader from '../components/AppHeader'
import Modal from '../components/Modal'
import type { CreateDiaryRequest, Diary } from '../types/diary'

const DRAFT_KEY = 'its-diary-draft'
const EMPTY_DIARY: CreateDiaryRequest = { title: '', content: '' }

function readDraft(): CreateDiaryRequest {
  try {
    const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? '') as Partial<CreateDiaryRequest>
    return {
      title: typeof draft.title === 'string' ? draft.title : '',
      content: typeof draft.content === 'string' ? draft.content : '',
    }
  } catch {
    return EMPTY_DIARY
  }
}

export default function WritePage() {
  const navigate = useNavigate()
  const [diary, setDiary] = useState(readDraft)
  const [confirming, setConfirming] = useState(false)
  const [discardAction, setDiscardAction] = useState<'clear' | 'leave' | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedDiary, setSavedDiary] = useState<Diary | null>(null)
  const [error, setError] = useState('')
  const hasDraft = Boolean(diary.title.trim() || diary.content.trim())

  useEffect(() => {
    if (hasDraft) localStorage.setItem(DRAFT_KEY, JSON.stringify(diary))
    else localStorage.removeItem(DRAFT_KEY)
  }, [diary, hasDraft])

  useEffect(() => {
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      if (!hasDraft || savedDiary) return
      event.preventDefault()
    }
    window.addEventListener('beforeunload', warnBeforeLeaving)
    return () => window.removeEventListener('beforeunload', warnBeforeLeaving)
  }, [hasDraft, savedDiary])

  const requestSave = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setConfirming(true)
  }

  const saveDiary = async () => {
    setSaving(true)
    setError('')
    try {
      const createdDiary = await api
        .post('diary', { json: { title: diary.title.trim(), content: diary.content.trim() } })
        .json<Diary>()
      localStorage.removeItem(DRAFT_KEY)
      setConfirming(false)
      setSavedDiary(createdDiary)
    } catch {
      setConfirming(false)
      setError('저장하지 못했어요. 작성한 내용은 보관되어 있으니 잠시 후 다시 시도해 주세요.')
    } finally {
      setSaving(false)
    }
  }

  const discardDraft = () => {
    setDiary(EMPTY_DIARY)
    setDiscardAction(null)
    if (discardAction === 'leave') navigate('/')
  }

  return (
    <div className="page-frame write-frame">
      <AppHeader>
        <Link
          className="button button-quiet"
          to="/"
          onClick={(event) => {
            if (!hasDraft || savedDiary) return
            event.preventDefault()
            setDiscardAction('leave')
          }}
        >
          ← 목록
        </Link>
      </AppHeader>

      <main id="main-content" className="write-main">
        <div className="write-intro">
          <p className="eyebrow">WRITE A NEW PAGE</p>
          <h1>지금의 마음을<br />들려주세요.</h1>
          <p>완벽한 문장보다 솔직한 한 줄이면 충분해요.</p>
          <div className="draft-status">
            <span aria-hidden="true">{hasDraft ? '●' : '○'}</span>
            {hasDraft ? '이 기기에 임시 저장됨' : '작성을 시작하면 자동 저장돼요'}
          </div>
        </div>

        <form className="editor" onSubmit={requestSave}>
          <label>
            <span className="field-label">제목</span>
            <input
              autoFocus
              type="text"
              value={diary.title}
              required
              maxLength={255}
              onChange={(event) => {
                const title = event.currentTarget.value
                setDiary((current) => ({ ...current, title }))
              }}
              placeholder="오늘을 한 문장으로 남긴다면"
            />
            <span className="field-count">{diary.title.length} / 255</span>
          </label>
          <label>
            <span className="field-label">이야기</span>
            <textarea
              value={diary.content}
              required
              onChange={(event) => {
                const content = event.currentTarget.value
                setDiary((current) => ({ ...current, content }))
              }}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                  event.currentTarget.form?.requestSubmit()
                }
              }}
              placeholder={'어떤 하루였나요?\n천천히, 떠오르는 대로 적어보세요.'}
            />
            <span className="field-count">{diary.content.length.toLocaleString()}자</span>
          </label>

          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="editor-actions">
            <button className="button button-quiet" type="button" disabled={!hasDraft} onClick={() => setDiscardAction('clear')}>비우기</button>
            <button className="button button-primary button-large" type="submit">기록 저장하기 <span aria-hidden="true">→</span></button>
          </div>
          <p className="shortcut-hint">⌘/Ctrl + Enter로도 저장할 수 있어요.</p>
        </form>
      </main>

      <Modal
        open={confirming}
        title="이 기록을 저장할까요?"
        description="저장하면 보관함에서 언제든 다시 읽을 수 있어요."
        confirmText="저장하기"
        cancelText="조금 더 쓸게요"
        busy={saving}
        onClose={() => setConfirming(false)}
        onConfirm={() => void saveDiary()}
      />
      <Modal
        open={Boolean(discardAction)}
        title={discardAction === 'leave' ? '작성 중인 내용을 지우고 나갈까요?' : '작성 중인 내용을 비울까요?'}
        description="이 기기에 임시 저장된 내용도 함께 사라져요."
        confirmText="내용 비우기"
        cancelText="계속 작성"
        danger
        onClose={() => setDiscardAction(null)}
        onConfirm={discardDraft}
      />
      <Modal
        open={Boolean(savedDiary)}
        title="소중한 기록을 저장했어요."
        description="오늘의 마음이 보관함에 안전하게 담겼습니다."
        confirmText="작성한 일기 보기"
        cancelText="목록으로"
        onClose={() => navigate('/')}
        onConfirm={() => navigate(`/diary/${savedDiary?.id}`)}
      />
    </div>
  )
}
