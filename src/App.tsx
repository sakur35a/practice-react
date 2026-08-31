import { useEffect } from 'react'
import { Link, Route, Routes, useLocation } from 'react-router'
import DetailPage from './pages/DetailPage'
import HomePage from './pages/Homepage'
import WritePage from './pages/WritePage'

function App() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">본문으로 건너뛰기</a>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/write" element={<WritePage />} />
        <Route path="/diary/:id" element={<DetailPage />} />
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
