import { useEffect } from 'react'
import { Link, Route, Routes, useLocation } from 'react-router'
import DiaryDetailModal from './components/DiaryDetailModal'
import HomePage from './pages/Homepage'
import WritePage from './pages/WritePage'

function App() {
  const { pathname } = useLocation()

  useEffect(() => {
    // html에 scroll-behavior: smooth가 있어서 그냥 scrollTo(0, 0)이면 새 화면이 이전 스크롤 위치에 그려진 채로 위로 미끄러진다.
    // 화면을 바꿀 때는 바로 맨 위로 보낸다
    if (!pathname.startsWith('/diary/')) window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [pathname])

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">본문으로 건너뛰기</a>
      <Routes>
        <Route path="/" element={<HomePage />}>
          <Route path="diary/:id" element={<DiaryDetailModal />} />
        </Route>
        <Route path="/write" element={<WritePage />} />
        <Route path="*" element={
          <main id="main-content" className="centered-state">
            <p className="eyebrow">404</p>
            <h1>페이지를 찾을 수 없어요.</h1>
            <Link className="button button-primary" to="/">기록으로 돌아가기</Link>
          </main>
        } />
      </Routes>
    </div>
  )
}

export default App
