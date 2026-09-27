import { createContext, useContext } from 'react'

export type Theme = 'light' | 'dark'

export interface ThemeContextValue {
  theme: Theme | null
  toggleTheme: () => void
}

export const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
