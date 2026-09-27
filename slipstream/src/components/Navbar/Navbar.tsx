import { useEffect, useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useTheme } from '../../theme/ThemeContext'
import { useAuth } from '../../auth/AuthContext'
import SearchBar from '../SearchBar/SearchBar'
import NotificationBell from '../NotificationBell/NotificationBell'
import { CloseIcon, HomeIcon, PersonAddIcon, PlusIcon, SearchIcon, ShieldIcon, SignInIcon } from './NavIcons'
import './Navbar.css'

const navLinkClass = ({ isActive }: { isActive: boolean }) => isActive ? 'active' : undefined

const Navbar = () => {
  const { theme, toggleTheme } = useTheme()
  const { profile } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const isDark = theme === 'dark' || (theme === null && window.matchMedia('(prefers-color-scheme: dark)').matches)

  const closeButtonRef = useRef<HTMLButtonElement>(null)

  const closeMenu = () => setMenuOpen(false)

  // While the drawer is open: move focus into it, and let Escape close it.
  useEffect(() => {
    if (!menuOpen) return
    closeButtonRef.current?.focus()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [menuOpen])

  return (
    <header id="navbar">
      <button
        type="button"
        id="nav-menu-toggle"
        aria-label="Open menu"
        aria-expanded={menuOpen}
        aria-controls="nav-menu"
        onClick={() => setMenuOpen(true)}
      >
        <span />
        <span />
        <span />
      </button>
      {menuOpen && <div id="nav-backdrop" onClick={closeMenu} />}
      <div id="nav-menu" className={menuOpen ? 'open' : undefined}>
        {/* Drawer-only header (hidden on desktop): a non-clickable logo, since
            the drawer's own Home link right below it covers navigation to /. */}
        <div id="nav-drawer-header">
          <img src="/favicon.svg" alt="Slipstream" width={32} height={32} />
          <button type="button" id="nav-drawer-close" ref={closeButtonRef} aria-label="Close menu" onClick={closeMenu}>
            <CloseIcon />
          </button>
        </div>
        <NavLink to="/" id="brand" onClick={closeMenu}>
          <img src="/favicon.svg" alt="Slipstream" width={36} height={36} />
        </NavLink>
        <nav>
          <NavLink to="/" end id="nav-home-link" className={navLinkClass} onClick={closeMenu}>
            <HomeIcon className="nav-icon" />
            Home
          </NavLink>
          {profile ? (
            <>
              <NavLink to="/posts" end className={navLinkClass} onClick={closeMenu}>
                <SearchIcon className="nav-icon" />
                Browse
              </NavLink>
              {!profile.is_blocked && (
                <NavLink to="/posts/new" className={navLinkClass} onClick={closeMenu}>
                  <PlusIcon className="nav-icon" />
                  New post
                </NavLink>
              )}
              {profile.role === 'admin' && (
                <NavLink to="/admin" className={navLinkClass} onClick={closeMenu}>
                  <ShieldIcon className="nav-icon" />
                  Admin
                </NavLink>
              )}
            </>
          ) : (
            <>
              <NavLink to="/login" className={navLinkClass} onClick={closeMenu}>
                <SignInIcon className="nav-icon" />
                Log in
              </NavLink>
              <NavLink to="/register" className={navLinkClass} onClick={closeMenu}>
                <PersonAddIcon className="nav-icon" />
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
