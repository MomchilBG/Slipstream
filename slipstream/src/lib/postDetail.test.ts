import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockQuery } from '../test/mockSupabase'
import type { SupabaseMock } from '../test/mockSupabase'
import { supabase } from './supabaseClient'
import { castVote, DELETED_COMMENT_PLACEHOLDER, deleteComment, getComments, getPostDetail } from './postDetail'

vi.mock('./supabaseClient', async () => {
  const { createSupabaseMock } = await import('../test/mockSupabase')
  return { supabase: createSupabaseMock() }
})

const supabaseMock = supabase as unknown as SupabaseMock

beforeEach(() => {
  supabaseMock.from.mockReset()
  supabaseMock.rpc.mockReset()
})

const PROFILE_ROW = { id: 'u1', username: 'alexr', first_name: 'Alex', last_name: null, avatar_url: null, reputation: 5, role: 'user', is_blocked: false }

describe('getPostDetail', () => {
  it('returns null when the post is not found', async () => {
    supabaseMock.from.mockReturnValue(mockQuery(null, { message: 'not found' }))

    expect(await getPostDetail('missing', null)).toBeNull()
  })

  it('assembles author, tags, images, and the viewer own vote/save state', async () => {
    supabaseMock.from.mockImplementation((table: string) => {
      switch (table) {
        case 'posts':
          return mockQuery({ id: 'p1', title: 'Tubeless setup', content: 'Details...', created_at: '2024-01-01T00:00:00.000Z', updated_at: '2024-01-01T00:00:00.000Z', like_count: 5, dislike_count: 1, author_id: 'u1' })
        case 'user_badges':
          return mockQuery([])
        case 'badges':
          return mockQuery([])
        case 'post_tags':
          return mockQuery([])
        case 'tags':
          return mockQuery([])
        case 'post_images':
          return mockQuery([])
        case 'votes':
          return mockQuery({ value: 1 })
        case 'saved_posts':
          return mockQuery({ post_id: 'p1' })
        default:
          throw new Error(`unexpected table ${table}`)
      }
    })
    supabaseMock.rpc.mockReturnValue(mockQuery([PROFILE_ROW]))

    const detail = await getPostDetail('p1', 'u1')

    expect(detail?.author.username).toBe('alexr')
    expect(detail?.upvoteCount).toBe(5)
    expect(detail?.downvoteCount).toBe(1)
    expect(detail?.myVote).toBe(1)
    expect(detail?.isSaved).toBe(true)
  })

  it('falls back to a placeholder author instead of failing the whole post', async () => {
    supabaseMock.from.mockImplementation((table: string) => {
      switch (table) {
        case 'posts':
          return mockQuery({ id: 'p1', title: 'T', content: 'C', created_at: '2024-01-01T00:00:00.000Z', updated_at: '2024-01-01T00:00:00.000Z', like_count: 0, dislike_count: 0, author_id: 'ghost' })
        case 'user_badges':
        case 'post_tags':
        case 'tags':
        case 'post_images':
          return mockQuery([])
        default:
          throw new Error(`unexpected table ${table}`)
      }
    })
    supabaseMock.rpc.mockReturnValue(mockQuery([]))

    const detail = await getPostDetail('p1', null)

    expect(detail?.author.username).toBe('unknown')
    expect(detail?.myVote).toBeNull()
    expect(detail?.isSaved).toBe(false)
  })
})

describe('getComments', () => {
  it('maps rows to CommentItem, falling back to a placeholder author when missing', async () => {
    supabaseMock.from.mockImplementation((table: string) => {
      if (table === 'comments') {
        return mockQuery([
          { id: 'c1', content: 'Nice build', created_at: '2024-01-01T00:00:00.000Z', updated_at: '2024-01-01T00:00:00.000Z', author_id: 'u1', parent_comment_id: null, is_deleted: false },
        ])
      }
      if (table === 'user_badges') return mockQuery([])
      if (table === 'badges') return mockQuery([])
      throw new Error(`unexpected table ${table}`)
    })
    supabaseMock.rpc.mockReturnValue(mockQuery([PROFILE_ROW]))

    const comments = await getComments('p1')

    expect(comments).toHaveLength(1)
    expect(comments[0].author.username).toBe('alexr')
    expect(comments[0].isDeleted).toBe(false)
  })

  it('returns an empty list on error', async () => {
    supabaseMock.from.mockReturnValue(mockQuery(null, { message: 'boom' }))

    expect(await getComments('p1')).toEqual([])
  })
})

describe('deleteComment', () => {
  it('soft-deletes by replacing content and setting is_deleted', async () => {
    supabaseMock.from.mockReturnValue(mockQuery({ id: 'c1' }))

    const { error } = await deleteComment('c1')

    expect(error).toBeNull()
    expect(supabaseMock.from).toHaveBeenCalledWith('comments')
  })

  it('reports an error when RLS silently matches zero rows', async () => {
    supabaseMock.from.mockReturnValue(mockQuery(null))

    const { error } = await deleteComment('c1')

    expect(error?.message).toMatch(/already be gone/)
  })

  it('propagates a real database error', async () => {
    supabaseMock.from.mockReturnValue(mockQuery(null, { message: 'permission denied' }))

    const { error } = await deleteComment('c1')

    expect(error?.message).toBe('permission denied')
  })
})

it('DELETED_COMMENT_PLACEHOLDER is the fixed [deleted] string', () => {
  expect(DELETED_COMMENT_PLACEHOLDER).toBe('[deleted]')
})

describe('castVote', () => {
  it('inserts a new vote when the voter has not voted yet', async () => {
    const insertBuilder = mockQuery(null)
    const insertSpy = vi.spyOn(insertBuilder, 'insert')
    supabaseMock.from.mockReturnValueOnce(mockQuery(null)).mockReturnValueOnce(insertBuilder)

    await castVote('p1', 'voter1', 1)

    expect(insertSpy).toHaveBeenCalledWith({ post_id: 'p1', voter_id: 'voter1', value: 1 })
  })

  it('removes the vote row when casting the same value again (toggle off)', async () => {
    const deleteBuilder = mockQuery(null)
    const deleteSpy = vi.spyOn(deleteBuilder, 'delete')
    supabaseMock.from.mockReturnValueOnce(mockQuery({ id: 'vote-1', value: 1 })).mockReturnValueOnce(deleteBuilder)

    await castVote('p1', 'voter1', 1)

    expect(deleteSpy).toHaveBeenCalled()
  })

  it('updates the vote row when switching from downvote to upvote', async () => {
    const updateBuilder = mockQuery(null)
    const updateSpy = vi.spyOn(updateBuilder, 'update')
    supabaseMock.from.mockReturnValueOnce(mockQuery({ id: 'vote-1', value: -1 })).mockReturnValueOnce(updateBuilder)

    await castVote('p1', 'voter1', 1)

    expect(updateSpy).toHaveBeenCalledWith({ value: 1 })
  })
})
