import type { ReactNode } from 'react'
import { Link } from 'react-router'

export default function AppHeader({ children }: { children?: ReactNode }) {
  return (
    <header className="site-header">
      <Link className="brand" to="/" aria-label="its diary 홈">
        <span className="brand-mark" aria-hidden="true">i</span>
        <span>its diary<small>나만의 조용한 기록</small></span>
      </Link>
      {children && <nav className="header-actions">{children}</nav>}
    </header>
  )
}
