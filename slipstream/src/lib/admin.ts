import { supabase } from './supabaseClient'
import { escapeOrFilterValue } from './search'

export interface AdminUserRow {
  id: string
  username: string
  firstName: string
  lastName: string | null
  email: string
  isBlocked: boolean
  createdAt: string
}

const ADMIN_USER_SEARCH_LIMIT = 50

// Queries `profiles` directly rather than the public-safe public_profiles()
// RPC used elsewhere - admins need email/blocked-status, which that view
// deliberately omits. RLS ("Owners and admins can view full profiles")
// already grants an admin session the full row for any user, so this needs
// no new migration or RPC.
export const searchAdminUsers = async (term: string): Promise<AdminUserRow[]> => {
  const trimmed = term.trim()
  if (!trimmed) return []

  const pattern = escapeOrFilterValue(`%${trimmed}%`)
  const { data } = await supabase
    .from('profiles')
    .select('id, username, first_name, last_name, email, is_blocked, created_at')
    .or(`username.ilike.${pattern},email.ilike.${pattern},first_name.ilike.${pattern},last_name.ilike.${pattern}`)
    .order('username')
    .limit(ADMIN_USER_SEARCH_LIMIT)

  return (data ?? []).map((row) => ({
    id: row.id,
    username: row.username,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    isBlocked: row.is_blocked,
    createdAt: row.created_at,
  }))
}

export const setUserBlocked = (userId: string, blocked: boolean) =>
  supabase.from('profiles').update({ is_blocked: blocked }).eq('id', userId)
