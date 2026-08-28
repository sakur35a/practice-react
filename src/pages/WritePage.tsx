import { useState, type KeyboardEventHandler, type SubmitEvent } from 'react'
import { Link } from "react-router"
import { api } from '../api/client'
import type { CreateDiaryRequest } from '../types/diary'

function WritePage() {
    const [diary, setDiary] = useState<CreateDiaryRequest>({
        title: '',
        content: ''
    })

    const handleSubmit = async (
        event: SubmitEvent<HTMLFormElement>,
    ) => {
        event.preventDefault()
        const result = await api.post("diary", { json: diary })
        console.log(await result.json());
    }

    const confirmBeforeSave: KeyboardEventHandler<HTMLInputElement> = (
        event,
    ) => {
        if (event.key !== 'Enter') return

        event.preventDefault()

        const shouldSave = window.confirm('일기를 저장할까요?')

        if (shouldSave) {
            event.currentTarget.form?.requestSubmit()
        }
    }


    return (
        <div className="grid grid-cols-[1fr_auto_1fr] items-start">
            <form onSubmit={handleSubmit} className="col-start-2 flex w-160 flex-col gap-4">
                <input
                    type="text"
                    value={diary.title}
                    onChange={(event) => {
                        const title = event.currentTarget.value

                        setDiary((previousDiary) => ({
                            ...previousDiary,
                            title,
                        }))
                    }}
                    placeholder="제목"
                    onKeyDown={confirmBeforeSave}
                    className="border p-3 text-4xl font-bold" />
                <textarea
                    value={diary.content}
                    onChange={(event) => {
                        const content = event.currentTarget.value

                        setDiary((previousDiary) => ({
                            ...previousDiary,
                            content,
                        }))
                    }}
                    placeholder="일기를 작성하세요"
                    className="min-h-80 resize-none border p-3"
                />
                <button type="submit" className="border p-3">
                    저장하기
                </button>
            </form>
            <Link to="/" className="col-start-3 row-start-1 justify-self-end border px-4 py-2">
                목록으로 돌아가기</Link>
        </div>
    )
}

export default WritePage
