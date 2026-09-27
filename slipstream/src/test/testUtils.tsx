import type { ComponentProps, ReactElement, ReactNode } from 'react'
import { render } from '@testing-library/react'
import type { RenderOptions } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { Session, User } from '@supabase/supabase-js'
import { vi } from 'vitest'
import { AuthContext } from '../auth/AuthContext'
import type { AuthContextValue, Profile } from '../auth/AuthContext'
import { ThemeContext } from '../theme/ThemeContext'
import type { ThemeContextValue } from '../theme/ThemeContext'

export const makeProfile = (overrides: Partial<Profile> = {}): Profile => ({
  id: 'user-1',
  avatar_url: null,
  bio: null,
  created_at: '2024-01-01T00:00:00.000Z',
  email: 'rider@example.com',
  first_name: 'Alex',
  is_blocked: false,
  last_name: 'Rivera',
  phone_number: null,
  reputation: 0,
  role: 'user',
  updated_at: '2024-01-01T00:00:00.000Z',
  username: 'alexr',
  ...overrides,
})

export const makeUser = (overrides: Partial<User> = {}): User => ({
  id: 'user-1',
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  created_at: '2024-01-01T00:00:00.000Z',
  ...overrides,
}) as User

export const makeSession = (overrides: Partial<Session> = {}): Session => ({
  access_token: 'test-access-token',
  refresh_token: 'test-refresh-token',
  expires_in: 3600,
  token_type: 'bearer',
  user: makeUser(),
  ...overrides,
}) as Session

export const makeAuthValue = (overrides: Partial<AuthContextValue> = {}): AuthContextValue => ({
  session: null,
  user: null,
  profile: null,
  loading: false,
  profileLoading: false,
  signOut: vi.fn(async () => {}),
  refreshProfile: vi.fn(async () => {}),
  ...overrides,
})

// A signed-in, non-blocked, non-admin user with a resolved profile - the
// common case most component/page tests want by default.
export const makeSignedInAuthValue = (overrides: Partial<AuthContextValue> = {}): AuthContextValue => {
  const profile = overrides.profile ?? makeProfile()
  const user = makeUser({ id: profile?.id ?? 'user-1' })
  return makeAuthValue({
    session: makeSession({ user }),
    user,
    profile,
    ...overrides,
  })
}

export const makeThemeValue = (overrides: Partial<ThemeContextValue> = {}): ThemeContextValue => ({
  theme: 'light',
  toggleTheme: vi.fn(),
  ...overrides,
})

interface RenderWithProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  authValue?: AuthContextValue
  themeValue?: ThemeContextValue
  route?: string
  routerProps?: Omit<ComponentProps<typeof MemoryRouter>, 'children'>
}

// Wraps a UI tree in the same providers App.tsx composes at the root -
// AuthContext, ThemeContext, and a router - so a component/page under test
// can call useAuth()/useTheme()/useNavigate() exactly as it would in the
// real app, with test-controlled values passed in instead of hitting
// Supabase or the browser's real theme/history APIs.
export const renderWithProviders = (ui: ReactElement, options: RenderWithProvidersOptions = {}) => {
  const { authValue = makeAuthValue(), themeValue = makeThemeValue(), route = '/', routerProps, ...renderOptions } = options

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[route]} {...routerProps}>
      <ThemeContext.Provider value={themeValue}>
        <AuthContext.Provider value={authValue}>{children}</AuthContext.Provider>
      </ThemeContext.Provider>
    </MemoryRouter>
  )

  return render(ui, { wrapper: Wrapper, ...renderOptions })
}
