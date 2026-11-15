import { Link, Outlet } from 'react-router'
import AppHeader from '../components/AppHeader'
import DiaryArchive from '../components/DiaryArchive'

export default function HomePage() {
  return (
    <>
      <div className="page-frame">
        <AppHeader>
          <Link className="button button-primary" to="/write"><span aria-hidden="true">＋</span> 새 기록</Link>
        </AppHeader>

        <main id="main-content">
          <section className="hero" aria-labelledby="page-title">
            <div>
              <p className="eyebrow">A SPACE FOR YOUR MOMENTS</p>
              <h1 id="page-title">오늘의 마음을,<br />오래 남도록.</h1>
              <p className="hero-copy">지나가는 생각과 소중한 순간을 조용히 모아두는 공간이에요.</p>
            </div>
            <div className="hero-orbit" aria-hidden="true"><span>오늘</span><i /></div>
          </section>

          <DiaryArchive />
        </main>
      </div>
      <footer className="site-footer">
        <p>매일의 마음이 쌓여, 나만의 이야기가 됩니다.</p>
        <span>ITS DIARY · {new Date().getFullYear()}</span>
      </footer>
      <Outlet />
    </>
  )
}
