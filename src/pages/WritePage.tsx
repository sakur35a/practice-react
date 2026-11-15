import { useEffect, useRef, useState, type SubmitEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { api } from '../api/client'
import { countCodePoints, TITLE_MAX_CODE_POINTS, validateDiary, type DiaryField } from '../api/diaryRules'
import {
  describeProblem, fieldErrors, isServiceUnavailable, problemType, ProblemType, retryAfterSeconds, toProblem,
} from '../api/problem'
import AppHeader from '../components/AppHeader'
import Modal from '../components/Modal'
import type { CreateDiaryRequest, Diary } from '../types/diary'

const DRAFT_KEY = 'its-diary-draft'
const EMPTY_DIARY: CreateDiaryRequest = { title: '', content: '' }

const DIARY_FIELDS = ['title', 'content'] as const
type FieldCodes = Partial<Record<DiaryField, string[]>>

const SAVE_FAILED = '저장하지 못했어요. 작성한 내용은 보관되어 있으니 잠시 후 다시 시도해 주세요.'
const SAVE_UNAVAILABLE = '서버가 잠시 쉬고 있어요. 작성한 내용은 이 기기에 보관되어 있으니 조금만 기다렸다가 다시 저장해 주세요.'

// 서버의 errors[].code(와 같은 이름의 클라이언트 검사 결과)를 사용자 문구로 바꾼다. 모르는 code는 필드별 일반 문구다.
const FIELD_MESSAGES: Record<DiaryField, { byCode: Record<string, string>, fallback: string }> = {
  title: {
    byCode: {
      'required': '제목을 입력해 주세요.',
      'too-long': `제목은 ${TITLE_MAX_CODE_POINTS}자까지 쓸 수 있어요.`,
      'nul-character': '제목에 쓸 수 없는 문자가 들어 있어요. 지우고 다시 저장해 주세요.',
    },
    fallback: '제목을 다시 확인해 주세요.',
  },
  content: {
    byCode: {
      'required': '이야기를 입력해 주세요.',
      'nul-character': '이야기에 쓸 수 없는 문자가 들어 있어요. 지우고 다시 저장해 주세요.',
    },
    fallback: '이야기를 다시 확인해 주세요.',
  },
}

function fieldMessage(field: DiaryField, codes: string[]): string {
  const { byCode, fallback } = FIELD_MESSAGES[field]
  const messages = codes.map((code) => (Object.hasOwn(byCode, code) ? byCode[code] : fallback))
  return [...new Set(messages)].join(' ')
}

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
  const [fieldCodes, setFieldCodes] = useState<FieldCodes>({})
  const [focusRequest, setFocusRequest] = useState<{ field: DiaryField } | null>(null)
  // 서버가 503으로 쉬는 동안(Retry-After) 저장 버튼을 쉬게 한다. 시간이 지나면 스스로 돌아온다.
  const [cooldownUntil, setCooldownUntil] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const titleRef = useRef<HTMLInputElement>(null)
  const contentRef = useRef<HTMLTextAreaElement>(null)
  const cooldownSeconds = Math.max(0, Math.ceil((cooldownUntil - now) / 1000))
  const titleLength = countCodePoints(diary.title.trim())
  const hasDraft = Boolean(diary.title.trim() || diary.content.trim())

  useEffect(() => {
    if (hasDraft) localStorage.setItem(DRAFT_KEY, JSON.stringify(diary))
    else localStorage.removeItem(DRAFT_KEY)
  }, [diary, hasDraft])

  useEffect(() => {
    if (cooldownUntil <= Date.now()) return
    const timer = window.setInterval(() => {
      const current = Date.now()
      setNow(current)
      if (current >= cooldownUntil) window.clearInterval(timer)
    }, 250)
    return () => window.clearInterval(timer)
  }, [cooldownUntil])

  // 오류 문구가 화면에 그려진 뒤(aria-invalid, aria-describedby가 붙은 뒤)에 첫 오류 필드로 포커스를 옮긴다
  useEffect(() => {
    if (focusRequest) (focusRequest.field === 'title' ? titleRef : contentRef).current?.focus()
  }, [focusRequest])

  useEffect(() => {
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      if (!hasDraft || savedDiary) return
      event.preventDefault()
    }
    window.addEventListener('beforeunload', warnBeforeLeaving)
    return () => window.removeEventListener('beforeunload', warnBeforeLeaving)
  }, [hasDraft, savedDiary])

  const showFieldErrors = (codes: FieldCodes) => {
    setFieldCodes(codes)
    const field = DIARY_FIELDS.find((name) => codes[name]?.length)
    if (field) setFocusRequest({ field })
  }

  const clearFieldError = (field: DiaryField) => {
    setFieldCodes((current) => {
      if (!current[field]) return current
      const next = { ...current }
      delete next[field]
      return next
    })
  }

  const requestSave = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    // ⌘/Ctrl + Enter는 submit 버튼이 쉬는 중에도 requestSubmit()으로 들어오므로 여기서도 막는다
    if (cooldownSeconds > 0) return
    setError('')
    // 서버가 거부할 것(제목 길이, NUL 문자)을 먼저 걸러 서버까지 가지 않게 한다
    const invalid = validateDiary(diary)
    if (Object.keys(invalid).length > 0) {
      showFieldErrors(invalid)
      return
    }
    setFieldCodes({})
    setConfirming(true)
  }

  const handleSaveFailure = (failure: unknown) => {
    // 서버가 쉬는 중(503): 내용은 이 기기에 남아 있다. Retry-After 동안 저장 버튼을 쉬게 해 연타를 막는다.
    if (isServiceUnavailable(failure)) {
      const at = Date.now()
      setNow(at)
      setCooldownUntil(at + retryAfterSeconds(failure) * 1000)
      setError(SAVE_UNAVAILABLE)
      return
    }

    const problem = toProblem(failure)
    if (problem && problemType(problem) === ProblemType.ValidationError) {
      const { byField, unmapped } = fieldErrors(problem, DIARY_FIELDS)
      if (unmapped.length > 0) console.error('[diary] 필드에 연결하지 못한 검증 오류', describeProblem(failure))
      if (Object.keys(byField).length > 0) {
        showFieldErrors(byField)
        return
      }
    } else if (problem && problemType(problem) === ProblemType.MalformedRequest) {
      // 이 화면이 보내는 요청은 항상 올바른 JSON이어야 한다. 프런트 결함이라 사용자에게는 일반 문구만 보인다.
      console.error('[diary] 서버가 요청을 해석하지 못했어요 (프런트 결함 가능성)', describeProblem(failure))
    } else {
      // 중복 id(이 화면은 id를 보내지 않는다), 500, 모르는 type, problem이 아닌 응답, 네트워크 오류
      console.error('[diary] 저장 실패', describeProblem(failure))
    }
    setError(SAVE_FAILED)
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
    } catch (failure) {
      setConfirming(false)
      handleSaveFailure(failure)
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
          <div>
            <label>
              <span className="field-label">제목</span>
              <input
                ref={titleRef}
                autoFocus
                type="text"
                value={diary.title}
                required
                aria-invalid={fieldCodes.title ? true : undefined}
                aria-describedby={fieldCodes.title ? 'title-error' : undefined}
                onChange={(event) => {
                  const title = event.currentTarget.value
                  setDiary((current) => ({ ...current, title }))
                  clearFieldError('title')
                }}
                placeholder="오늘을 한 문장으로 남긴다면"
              />
              <span className="field-count" data-over={titleLength > TITLE_MAX_CODE_POINTS}>
                {titleLength} / {TITLE_MAX_CODE_POINTS}
              </span>
            </label>
            {fieldCodes.title && <p id="title-error" className="field-error" role="alert">{fieldMessage('title', fieldCodes.title)}</p>}
          </div>
          <div>
            <label>
              <span className="field-label">이야기</span>
              <textarea
                ref={contentRef}
                value={diary.content}
                required
                aria-invalid={fieldCodes.content ? true : undefined}
                aria-describedby={fieldCodes.content ? 'content-error' : undefined}
                onChange={(event) => {
                  const content = event.currentTarget.value
                  setDiary((current) => ({ ...current, content }))
                  clearFieldError('content')
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
            {fieldCodes.content && <p id="content-error" className="field-error" role="alert">{fieldMessage('content', fieldCodes.content)}</p>}
          </div>

          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="editor-actions">
            <button className="button button-quiet" type="button" disabled={!hasDraft} onClick={() => setDiscardAction('clear')}>비우기</button>
            <button className="button button-primary button-large" type="submit" disabled={cooldownSeconds > 0}>
              {cooldownSeconds > 0
                ? `${cooldownSeconds}초 뒤 다시 저장할 수 있어요`
                : <>기록 저장하기 <span aria-hidden="true">→</span></>}
            </button>
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
