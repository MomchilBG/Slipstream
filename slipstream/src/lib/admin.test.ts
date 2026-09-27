import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockQuery } from '../test/mockSupabase'
import type { SupabaseMock } from '../test/mockSupabase'
import { supabase } from './supabaseClient'
import { searchAdminUsers, setUserBlocked } from './admin'

vi.mock('./supabaseClient', async () => {
  const { createSupabaseMock } = await import('../test/mockSupabase')
  return { supabase: createSupabaseMock() }
})

const supabaseMock = supabase as unknown as SupabaseMock

beforeEach(() => {
  supabaseMock.from.mockReset()
})

describe('searchAdminUsers', () => {
  it('returns an empty list without querying for a blank term', async () => {
    expect(await searchAdminUsers('   ')).toEqual([])
    expect(supabaseMock.from).not.toHaveBeenCalled()
  })

  it('queries profiles directly (not the public-safe view) and maps email/blocked status', async () => {
    supabaseMock.from.mockReturnValue(mockQuery([
      { id: 'u1', username: 'alexr', first_name: 'Alex', last_name: null, email: 'alex@example.com', is_blocked: false, created_at: '2024-01-01T00:00:00.000Z' },
    ]))

    const result = await searchAdminUsers('alex')

    expect(supabaseMock.from).toHaveBeenCalledWith('profiles')
    expect(result).toEqual([{ id: 'u1', username: 'alexr', firstName: 'Alex', lastName: null, email: 'alex@example.com', isBlocked: false, createdAt: '2024-01-01T00:00:00.000Z' }])
  })
})

describe('setUserBlocked', () => {
  it('updates is_blocked on the profiles row', async () => {
    supabaseMock.from.mockReturnValue(mockQuery(null))

    await setUserBlocked('u1', true)

    expect(supabaseMock.from).toHaveBeenCalledWith('profiles')
  })
})
