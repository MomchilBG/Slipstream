import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockQuery } from '../test/mockSupabase'
import type { SupabaseMock } from '../test/mockSupabase'
import { supabase } from './supabaseClient'
import { getCommentCountForUser, getUserProfileByUsername } from './userProfile'

vi.mock('./supabaseClient', async () => {
  const { createSupabaseMock } = await import('../test/mockSupabase')
  return { supabase: createSupabaseMock() }
})

const supabaseMock = supabase as unknown as SupabaseMock

beforeEach(() => {
  supabaseMock.from.mockReset()
  supabaseMock.rpc.mockReset()
})

describe('getCommentCountForUser', () => {
  it('returns the count, defaulting to 0', async () => {
    supabaseMock.from.mockReturnValue(mockQuery(null, null, 4))

    expect(await getCommentCountForUser('u1')).toBe(4)
  })
})

describe('getUserProfileByUsername', () => {
  it('returns null when no profile matches', async () => {
    supabaseMock.rpc.mockImplementation((name: string) => {
      if (name === 'public_profiles') return mockQuery(null)
      throw new Error(`unexpected rpc ${name}`)
    })

    expect(await getUserProfileByUsername('ghost')).toBeNull()
  })

  it('assembles profile, posts, comment counts and badges into one page', async () => {
    supabaseMock.rpc.mockImplementation((name: string) => {
      if (name === 'public_profiles') {
        return mockQuery({
          id: 'u1', username: 'alexr', first_name: 'Alex', last_name: null, avatar_url: null, bio: 'Rides gravel.',
          reputation: 12, role: 'user', is_blocked: false, created_at: '2024-01-01T00:00:00.000Z',
        })
      }
      throw new Error(`unexpected rpc ${name}`)
    })
    supabaseMock.from.mockImplementation((table: string) => {
      if (table === 'posts') return mockQuery([{ id: 'p1', title: 'Post', created_at: '2024-01-02T00:00:00.000Z', comment_count: 5, author_id: 'u1' }])
      if (table === 'comments') return mockQuery(null, null, 2)
      if (table === 'user_badges') return mockQuery([])
      if (table === 'badges') return mockQuery([])
      throw new Error(`unexpected table ${table}`)
    })

    const page = await getUserProfileByUsername('alexr')

    expect(page).not.toBeNull()
    expect(page?.postCount).toBe(1)
    expect(page?.commentsMade).toBe(2)
    // commentsEarned = sum of each post's own commentCount
    expect(page?.commentsEarned).toBe(5)
    expect(page?.bio).toBe('Rides gravel.')
  })
})
