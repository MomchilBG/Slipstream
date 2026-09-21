import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockQuery } from '../test/mockSupabase'
import type { SupabaseMock } from '../test/mockSupabase'
import { supabase } from './supabaseClient'
import { getPublicProfiles, roleLabel } from './publicProfiles'

vi.mock('./supabaseClient', async () => {
  const { createSupabaseMock } = await import('../test/mockSupabase')
  return { supabase: createSupabaseMock() }
})

const supabaseMock = supabase as unknown as SupabaseMock

beforeEach(() => {
  supabaseMock.rpc.mockReset()
})

describe('roleLabel', () => {
  it('labels admin as Admin', () => {
    expect(roleLabel('admin')).toBe('Admin')
  })

  it('labels a plain user as Member', () => {
    expect(roleLabel('user')).toBe('Member')
  })
})

describe('getPublicProfiles', () => {
  it('returns an empty map without querying for an empty id list', async () => {
    const result = await getPublicProfiles([])

    expect(result.size).toBe(0)
    expect(supabaseMock.rpc).not.toHaveBeenCalled()
  })

  it('batches ids into a single public_profiles() lookup, keyed by id', async () => {
    supabaseMock.rpc.mockReturnValue(mockQuery([
      { id: 'u1', username: 'alexr', first_name: 'Alex', last_name: null, avatar_url: null, reputation: 5, role: 'user', is_blocked: false },
      { id: 'u2', username: 'admin1', first_name: 'Admin', last_name: 'One', avatar_url: 'https://cdn.test/a.png', reputation: 100, role: 'admin', is_blocked: true },
    ]))

    const result = await getPublicProfiles(['u1', 'u2'])

    expect(supabaseMock.rpc).toHaveBeenCalledWith('public_profiles')
    expect(result.get('u1')).toEqual({ id: 'u1', username: 'alexr', firstName: 'Alex', lastName: null, avatarUrl: null, reputation: 5, role: 'user', isBlocked: false })
    expect(result.get('u2')?.isBlocked).toBe(true)
  })
})
