import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockQuery } from '../test/mockSupabase'
import type { SupabaseMock } from '../test/mockSupabase'
import { supabase } from './supabaseClient'
import { getSavedPostCount, getSavedPostsByUser, isPostSaved, savePost, unsavePost } from './savedPosts'

vi.mock('./supabaseClient', async () => {
  const { createSupabaseMock } = await import('../test/mockSupabase')
  return { supabase: createSupabaseMock() }
})

const supabaseMock = supabase as unknown as SupabaseMock

beforeEach(() => {
  supabaseMock.from.mockReset()
  supabaseMock.rpc.mockReset()
})

describe('savePost / unsavePost', () => {
  it('inserts a saved_posts row', async () => {
    supabaseMock.from.mockReturnValue(mockQuery(null))

    await savePost('u1', 'p1')

    expect(supabaseMock.from).toHaveBeenCalledWith('saved_posts')
  })

  it('deletes the matching saved_posts row', async () => {
    supabaseMock.from.mockReturnValue(mockQuery(null))

    await unsavePost('u1', 'p1')

    expect(supabaseMock.from).toHaveBeenCalledWith('saved_posts')
  })
})

describe('isPostSaved', () => {
  it('is true when a row is found', async () => {
    supabaseMock.from.mockReturnValue(mockQuery({ post_id: 'p1' }))

    expect(await isPostSaved('u1', 'p1')).toBe(true)
  })

  it('is false when no row is found', async () => {
    supabaseMock.from.mockReturnValue(mockQuery(null))

    expect(await isPostSaved('u1', 'p1')).toBe(false)
  })
})

describe('getSavedPostCount', () => {
  it('returns the row count, defaulting to 0', async () => {
    supabaseMock.from.mockReturnValue(mockQuery(null, null, 3))

    expect(await getSavedPostCount('u1')).toBe(3)
  })

  it('defaults to 0 when count is null', async () => {
    supabaseMock.from.mockReturnValue(mockQuery(null, null, null))

    expect(await getSavedPostCount('u1')).toBe(0)
  })
})

describe('getSavedPostsByUser', () => {
  it('preserves most-recently-saved-first order regardless of the posts table lookup order', async () => {
    supabaseMock.from.mockImplementation((table: string) => {
      if (table === 'saved_posts') return mockQuery([{ post_id: 'p2' }, { post_id: 'p1' }])
      if (table === 'posts') {
        return mockQuery([
          { id: 'p1', title: 'First', created_at: '2024-01-01T00:00:00.000Z', comment_count: 0, author_id: 'u1' },
          { id: 'p2', title: 'Second', created_at: '2024-02-01T00:00:00.000Z', comment_count: 1, author_id: 'u1' },
        ])
      }
      throw new Error(`unexpected table ${table}`)
    })
    supabaseMock.rpc.mockReturnValue(mockQuery([{ id: 'u1', username: 'alexr', first_name: 'Alex', last_name: null, avatar_url: null, reputation: 0, role: 'user', is_blocked: false }]))

    const result = await getSavedPostsByUser('u1')

    expect(result.map((post) => post.id)).toEqual(['p2', 'p1'])
  })

  it('returns an empty list when nothing is saved', async () => {
    supabaseMock.from.mockReturnValue(mockQuery([]))

    expect(await getSavedPostsByUser('u1')).toEqual([])
  })
})
