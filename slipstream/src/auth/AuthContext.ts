import { createContext, useContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import type { Tables } from '../lib/database.types'

export type Profile = Tables<'profiles'>

export interface AuthContextValue {
  session: Session | null
  user: User | null
  profile: Profile | null
  loading: boolean
  // True while profile is being (re)fetched for the current session - distinct
  // from `loading`, which only covers the initial session lookup. A guard
  // that depends on `profile` (like RequireAdmin) needs this to tell "still
  // fetching" apart from "fetched and it's genuinely null", since both look
  // like `profile === null` otherwise.
  profileLoading: boolean
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
