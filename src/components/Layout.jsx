import { Link, NavLink, Outlet } from 'react-router-dom'

export function Layout() {
  return (
    <div className="app">
      <header className="header">
        <div className="header__inner">
          <Link className="header__brand" to="/" data-text="Lum IQ" aria-label="Lum IQ — на головну">
            Lum <span className="header__brand-iq">IQ</span>
          </Link>
          <nav className="header__nav" aria-label="Головне меню">
            <NavLink
              className={({ isActive }) => `header__link${isActive ? ' header__link--active' : ''}`}
              to="/"
              end
            >
              Головна
            </NavLink>
            <NavLink
              className={({ isActive }) => `header__link${isActive ? ' header__link--active' : ''}`}
              to="/before-after"
            >
              Lumiq в дії
            </NavLink>
          </nav>
        </div>
      </header>

      <div className="app__content">
        <Outlet />
        <footer className="footer">
          <small>© {new Date().getFullYear()} Lumiq</small>
        </footer>
      </div>
    </div>
  )
}
