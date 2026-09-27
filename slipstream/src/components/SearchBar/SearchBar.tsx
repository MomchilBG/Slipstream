import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import type { SearchMode } from '../../lib/search'
import './SearchBar.css'

const MODES: SearchMode[] = ['posts', 'tags', 'users']

const MODE_LABEL: Record<SearchMode, string> = {
  posts: 'Posts',
  tags: 'Tags',
  users: 'Users',
}

const MODE_PREFIX: Record<SearchMode, string> = {
  posts: '',
  tags: '#',
  users: 'u/',
}

const MODE_PLACEHOLDER: Record<SearchMode, string> = {
  posts: 'Search posts by title',
  tags: 'Search by tag_name',
  users: 'Search by username',
}

// Applies the selected mode's prefix to every token typed into the box, so
// picking "Tags"/"Users" from the dropdown means the user never has to type
// # or u/ themselves - mirrors how parseSearchQuery reads those prefixes
// back out on the results page.
const buildSearchQuery = (value: string, mode: SearchMode): string => {
  const prefix = MODE_PREFIX[mode]
  if (!prefix) return value.trim()

  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => (token.toLowerCase().startsWith(prefix) ? token : `${prefix}${token}`))
    .join(' ')
}

const SearchBar = () => {
  const navigate = useNavigate()
  const [value, setValue] = useState('')
  const [mode, setMode] = useState<SearchMode>('posts')
  const [menuOpen, setMenuOpen] = useState(false)
  const modeRef = useRef<HTMLDivElement>(null)

  // A native <select>'s own popup can't be styled to match the search bar
  // (no cross-browser control over its background/corners, and Firefox and
  // Chrome each center its closed-state text slightly differently from an
  // <input>) - so the mode picker is a plain button + absolutely positioned
  // menu instead, fully styled by us. Close it on an outside click or Escape.
  useEffect(() => {
    if (!menuOpen) return

    const handlePointerDown = (event: PointerEvent) => {
      if (modeRef.current && !modeRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [menuOpen])

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const query = buildSearchQuery(value, mode)
    navigate(query ? `/posts?q=${encodeURIComponent(query)}` : '/posts')
  }

  const selectMode = (next: SearchMode) => {
    setMode(next)
    setMenuOpen(false)
  }

  return (
    <form id="search-bar" role="search" onSubmit={handleSubmit}>
      <div id="search-bar-mode" ref={modeRef}>
        <button
          type="button"
          id="search-bar-mode-trigger"
          aria-haspopup="listbox"
          aria-expanded={menuOpen}
          aria-label="Search type"
          onClick={() => setMenuOpen((open) => !open)}
        >
          {MODE_LABEL[mode]}
          <svg id="search-bar-mode-caret" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        {menuOpen && (
          <ul id="search-bar-mode-menu" role="listbox" aria-label="Search type">
            {MODES.map((option) => (
              <li key={option} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={mode === option}
                  className={mode === option ? 'active' : undefined}
                  onClick={() => selectMode(option)}
                >
                  {MODE_LABEL[option]}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <input
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={MODE_PLACEHOLDER[mode]}
        aria-label="Search"
      />
      <button type="submit" id="search-bar-submit" aria-label="Search">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </button>
    </form>
  )
}

export default SearchBar
