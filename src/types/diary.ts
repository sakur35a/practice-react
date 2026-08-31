export interface Diary {
  id: string
  title: string
  content: string
}

export type DiaryPreview = Diary

export interface DiaryListResponse {
  items: DiaryPreview[]
  hasNext: boolean
  nextCursorId: string | null
}

export type CreateDiaryRequest = Omit<Diary, 'id'>
