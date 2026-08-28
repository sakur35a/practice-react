import { useEffect, useState } from "react"
import { Link } from "react-router"
import { api } from "../api/client"
import type { Diary, DiaryListResponse } from "../types/diary"

function HomePage() {

    const [diaries, setDiaries] = useState<Diary[]>([])

    useEffect(() => {
        const loadDiaries = async () => {
            const res = await api.get("diary").json<DiaryListResponse>()
            setDiaries(res.items)
        }

        void loadDiaries()
    }, [])

    return (
        <div>
            <header className="grid grid-cols-[1fr_auto_1fr] items-center">
                <h1 className="text-4xl font-bold col-start-2 border-1">its diary</h1>

                <Link
                    to="/write"
                    className="col-start-3 justify-self-end border-1 cursor-pointer"
                >
                    일기 쓰러가기
                </Link>
            </header>

            <ul className="mx-auto mt-10 w-fit">
                {diaries.map((diary) => (
                    <li key={diary.id}>
                        {diary.title}
                    </li>
                ))}
            </ul>
        </div>
    )
}

export default HomePage
