// 서버가 실제로 거부하는 규칙만 그대로 옮긴 클라이언트 검사다. 서버는 빈 제목과 빈 본문을 받으므로(도메인이 허용한다)
// 여기서도 막지 않는다. 더 엄격하게 만들지 않는다: 서버와 어긋나면 사용자가 서버라면 저장되었을 글을 못 쓰게 된다.
// 코드 이름은 서버의 `errors[].code`와 같게 둬서, 클라이언트 검사와 서버 응답이 같은 문구 표를 쓴다.

export const TITLE_MAX_CODE_POINTS = 255

export type DiaryField = 'title' | 'content'
export type DiaryFieldCode = 'too-long' | 'nul-character'

// 유니코드 코드 포인트 수. `string.length`나 input의 `maxLength`는 UTF-16 단위라 이모지 하나를 2로 센다.
// 서버(`@MaxCodePoints`)와 DB(varchar)는 코드 포인트로 센다.
export function countCodePoints(text: string): number {
  let count = 0
  for (let index = 0; index < text.length; index += 1) {
    const unit = text.charCodeAt(index)
    // 높은 서로게이트 뒤에 낮은 서로게이트가 오면 한 글자(쌍)다
    if (unit >= 0xd800 && unit <= 0xdbff && index + 1 < text.length) {
      const next = text.charCodeAt(index + 1)
      if (next >= 0xdc00 && next <= 0xdfff) index += 1
    }
    count += 1
  }
  return count
}

export function containsNul(text: string): boolean {
  return text.includes('\u0000')
}

// 서버로 보낼 값(trim한 뒤)에 대해 서버가 거부할 것을 미리 찾는다
export function validateDiary(diary: { title: string, content: string }): Partial<Record<DiaryField, DiaryFieldCode[]>> {
  const errors: Partial<Record<DiaryField, DiaryFieldCode[]>> = {}
  const title = diary.title.trim()
  const content = diary.content.trim()

  const titleCodes: DiaryFieldCode[] = []
  if (countCodePoints(title) > TITLE_MAX_CODE_POINTS) titleCodes.push('too-long')
  if (containsNul(title)) titleCodes.push('nul-character')
  if (titleCodes.length) errors.title = titleCodes
  if (containsNul(content)) errors.content = ['nul-character']

  return errors
}
