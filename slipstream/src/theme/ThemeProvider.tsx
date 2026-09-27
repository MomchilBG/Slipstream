import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { ThemeContext, type Theme } from './ThemeContext'

const getStoredTheme = (): Theme | null => {
  const stored = localStorage.getItem('theme')
  return stored === 'light' || stored === 'dark' ? stored : null
}

const systemPrefersDark = (): boolean => window.matchMedia('(prefers-color-scheme: dark)').matches

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setTheme] = useState<Theme | null>(getStoredTheme)

  useEffect(() => {
    if (theme) {
      document.documentElement.dataset.theme = theme
      localStorage.setItem('theme', theme)
    } else {
      delete document.documentElement.dataset.theme
      localStorage.removeItem('theme')
    }
  }, [theme])

  const toggleTheme = () => {
    setTheme((current) => {
      const currentlyDark = current ? current === 'dark' : systemPrefersDark()
      return currentlyDark ? 'light' : 'dark'
    })
  }

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>
}
