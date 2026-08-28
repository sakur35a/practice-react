export interface Diary {
    id: string | null,
    title: string,
    content: string
}

export interface DiaryListResponse {
    items: Diary[],
    hasNext: boolean,
    nextCursorId: string | null
}

export type CreateDiaryRequest = Omit<Diary, 'id'>
