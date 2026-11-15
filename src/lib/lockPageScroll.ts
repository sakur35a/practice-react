// 모달이 열려 있는 동안 뒤 화면이 스크롤되지 않게 잠그고, 잠금을 푸는 함수를 돌려준다.
// 자리를 차지하는 스크롤바(Windows, 일부 Linux)는 overflow: hidden이 되면 사라지면서 화면 폭이 그만큼 넓어져
// 가운데 정렬된 내용이 옆으로 밀린다. 잠그기 전에 스크롤바 폭을 재 두었다가 그만큼 오른쪽 안쪽 여백을 줘서 내용이 제자리에 있게 한다.
// (잠근 뒤에 줄어든 폭을 재는 방법은 쓰지 않는다: 브라우저가 스크롤바를 바로 걷지 않아 같은 틱에서는 옛 값이 나온다.
// overlay 스크롤바(macOS 기본, 모바일)는 폭이 0이라 아무것도 하지 않는다)
export function lockPageScroll(): () => void {
  const { body, documentElement } = document
  const scrollbarWidth = window.innerWidth - documentElement.clientWidth
  body.style.overflow = 'hidden'
  if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`

  return () => {
    body.style.overflow = ''
    body.style.paddingRight = ''
  }
}
