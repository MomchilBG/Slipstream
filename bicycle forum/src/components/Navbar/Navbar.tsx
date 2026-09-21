import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useTheme } from '../../theme/ThemeContext'
import { useAuth } from '../../auth/AuthContext'
import SearchBar from '../SearchBar/SearchBar'
import NotificationBell from '../NotificationBell/NotificationBell'
import './Navbar.css'

const navLinkClass = ({ isActive }: { isActive: boolean }) => isActive ? 'active' : undefined

const Navbar = () => {
  const { theme, toggleTheme } = useTheme()
  const { profile } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const isDark = theme === 'dark' || (theme === null && window.matchMedia('(prefers-color-scheme: dark)').matches)

  const closeMenu = () => setMenuOpen(false)

  return (
    <header id="navbar">
      <button
        type="button"
        id="nav-menu-toggle"
        aria-label={menuOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((open) => !open)}
      >
        <span />
        <span />
        <span />
      </button>
      <div id="nav-menu" className={menuOpen ? 'open' : undefined}>
        <NavLink to="/" id="brand" onClick={closeMenu}>
          🚲 Slipstream
        </NavLink>
        <nav>
          {profile ? (
            <>
              <NavLink to="/posts" end className={navLinkClass} onClick={closeMenu}>
                Browse
              </NavLink>
              {!profile.is_blocked && (
                <NavLink to="/posts/new" className={navLinkClass} onClick={closeMenu}>
                  New post
                </NavLink>
              )}
              {profile.role === 'admin' && (
                <NavLink to="/admin" className={navLinkClass} onClick={closeMenu}>
                  Admin
                </NavLink>
              )}
            </>
          ) : (
            <>
              <NavLink to="/login" className={navLinkClass} onClick={closeMenu}>
                Log in
              </NavLink>
              <NavLink to="/register" className={navLinkClass} onClick={closeMenu}>
                Register
              </NavLink>
            </>
          )}
        </nav>
      </div>
      {profile && <SearchBar />}
      {profile && <NotificationBell />}
      {profile && (
        <NavLink to={`/users/${profile.username}`} id="nav-avatar" aria-label="Your profile" className={navLinkClass}>
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt="" />
          ) : (
            <span id="nav-avatar-fallback">{profile.username.slice(0, 1).toUpperCase()}</span>
          )}
        </NavLink>
      )}
      <button
        type="button"
        id="theme-toggle"
        onClick={toggleTheme}
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {isDark ? '☀️' : '🌙'}
      </button>
    </header>
  )
}

export default Navbar
