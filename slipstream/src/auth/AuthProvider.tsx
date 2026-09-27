import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabaseClient'
import { AuthContext, type Profile } from './AuthContext'

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null)
  const [profileState, setProfileState] = useState<{ userId: string; profile: Profile | null } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return
      setSession(data.session)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  const userId = session?.user.id ?? null

  useEffect(() => {
    if (!userId) return

    let cancelled = false

    supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
      .then(({ data }) => {
        if (!cancelled) setProfileState({ userId, profile: data })
      })

    return () => {
      cancelled = true
    }
  }, [userId])

  // Lets pages that just wrote to `profiles` (name/avatar edits) pull the
  // fresh row without waiting for a full page reload.
  const refreshProfile = async () => {
    if (!userId) return
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    setProfileState({ userId, profile: data })
  }

  // Falls back to null both when signed out and during the brief window
  // after switching users, before that user's profile fetch resolves -
  // avoids ever showing a stale profile from a previous session.
  const profile = profileState?.userId === userId ? profileState.profile : null

  // True only in that same brief window - there's a logged-in user, but the
  // fetch for their profile hasn't resolved (or settled to a genuinely null
  // row) yet. Lets a guard that depends on `profile` (like RequireAdmin) tell
  // "still fetching" apart from "fetched, and it's null", since both look
  // like `profile === null` otherwise.
  const profileLoading = !!userId && profileState?.userId !== userId

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider
      value={{ session, user: session?.user ?? null, profile, loading, profileLoading, signOut, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  )
}
