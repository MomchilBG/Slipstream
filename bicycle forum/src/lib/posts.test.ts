import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockQuery } from '../test/mockSupabase'
import type { SupabaseMock } from '../test/mockSupabase'
import { supabase } from './supabaseClient'
import { createPost, deletePost, getMostCommentedPosts, getPlatformStats } from './posts'

vi.mock('./supabaseClient', async () => {
  const { createSupabaseMock } = await import('../test/mockSupabase')
  return { supabase: createSupabaseMock() }
})

const supabaseMock = supabase as unknown as SupabaseMock

beforeEach(() => {
  supabaseMock.from.mockReset()
  supabaseMock.rpc.mockReset()
})

describe('getPlatformStats', () => {
  it('reads user_count/post_count off the platform_stats() RPC', async () => {
    supabaseMock.rpc.mockReturnValue(mockQuery({ user_count: 42, post_count: 7 }))

    const stats = await getPlatformStats()

    expect(supabaseMock.rpc).toHaveBeenCalledWith('platform_stats')
    expect(stats).toEqual({ userCount: 42, postCount: 7 })
  })

  it('falls back to zeros when the RPC errors', async () => {
    supabaseMock.rpc.mockReturnValue(mockQuery(null, { message: 'boom' }))

    expect(await getPlatformStats()).toEqual({ userCount: 0, postCount: 0 })
  })
})

describe('getMostCommentedPosts', () => {
  it('maps post rows to summaries using the batched public profiles', async () => {
    supabaseMock.from.mockImplementation((table: string) => {
      if (table === 'posts') {
        return mockQuery([
          { id: 'p1', title: 'Gravel bike build', created_at: '2024-01-02T00:00:00.000Z', comment_count: 3, author_id: 'u1' },
        ])
      }
      throw new Error(`unexpected table ${table}`)
    })
    supabaseMock.rpc.mockReturnValue(mockQuery([{ id: 'u1', username: 'alexr', first_name: 'Alex', last_name: null, avatar_url: null, reputation: 5, role: 'user', is_blocked: false }]))

    const posts = await getMostCommentedPosts(5)

    expect(posts).toEqual([
      { id: 'p1', title: 'Gravel bike build', author: 'alexr', commentCount: 3, createdAt: '2024-01-02T00:00:00.000Z' },
    ])
  })

  it('returns an empty list when the query errors', async () => {
    supabaseMock.from.mockReturnValue(mockQuery(null, { message: 'boom' }))

    expect(await getMostCommentedPosts()).toEqual([])
  })
})

describe('createPost', () => {
  it('inserts a post row for the given author', async () => {
    supabaseMock.from.mockReturnValue(mockQuery({ id: 'new-post' }))

    const result = await createPost('u1', 'A title', 'Some content')

    expect(supabaseMock.from).toHaveBeenCalledWith('posts')
    expect(result.data).toEqual({ id: 'new-post' })
  })
})

describe('deletePost', () => {
  it('fetches the post images before deleting, then cleans up storage', async () => {
    supabaseMock.from.mockImplementation((table: string) => {
      if (table === 'post_images') return mockQuery([{ image_url: 'https://test.supabase.local/storage/v1/object/public/post-images/u1/a.png' }])
      if (table === 'posts') return mockQuery(null)
      throw new Error(`unexpected table ${table}`)
    })
    const removeMock = vi.fn(async () => ({ data: [], error: null }))
    supabaseMock.storage.from.mockReturnValue({ upload: vi.fn(), remove: removeMock, list: vi.fn(), getPublicUrl: vi.fn() })

    const { error } = await deletePost('p1')

    expect(error).toBeNull()
    expect(removeMock).toHaveBeenCalledWith(['u1/a.png'])
  })

  it('does not attempt storage cleanup when the delete itself fails', async () => {
    supabaseMock.from.mockImplementation((table: string) => {
      if (table === 'post_images') return mockQuery([{ image_url: 'https://test.supabase.local/storage/v1/object/public/post-images/u1/a.png' }])
      if (table === 'posts') return mockQuery(null, { message: 'permission denied' })
      throw new Error(`unexpected table ${table}`)
    })
    const removeMock = vi.fn()
    supabaseMock.storage.from.mockReturnValue({ upload: vi.fn(), remove: removeMock, list: vi.fn(), getPublicUrl: vi.fn() })

    const { error } = await deletePost('p1')

    expect(error?.message).toBe('permission denied')
    expect(removeMock).not.toHaveBeenCalled()
  })
})
