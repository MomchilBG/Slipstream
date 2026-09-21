import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockQuery } from '../test/mockSupabase'
import type { SupabaseMock } from '../test/mockSupabase'
import { supabase } from './supabaseClient'
import { attachTagsToPost, getTagsForPost, removeTagFromPost, replacePostTags } from './tags'

vi.mock('./supabaseClient', async () => {
  const { createSupabaseMock } = await import('../test/mockSupabase')
  return { supabase: createSupabaseMock() }
})

const supabaseMock = supabase as unknown as SupabaseMock

beforeEach(() => {
  supabaseMock.from.mockReset()
})

describe('attachTagsToPost', () => {
  it('reuses an existing tag row instead of inserting a duplicate', async () => {
    const insertMock = vi.fn()
    supabaseMock.from.mockImplementation((table: string) => {
      if (table === 'tags') return mockQuery({ id: 'tag-1' })
      if (table === 'post_tags') {
        insertMock()
        return mockQuery(null)
      }
      throw new Error(`unexpected table ${table}`)
    })

    const { error } = await attachTagsToPost('p1', ['gravel'])

    expect(error).toBeNull()
    expect(insertMock).toHaveBeenCalledTimes(1)
  })

  it('creates a new tag row when none exists yet', async () => {
    let selectCalls = 0
    supabaseMock.from.mockImplementation((table: string) => {
      if (table === 'tags') {
        selectCalls += 1
        // First lookup finds nothing, so it inserts; the insert's own
        // .select().single() call reuses the same builder chain.
        return selectCalls === 1 ? mockQuery(null) : mockQuery({ id: 'tag-new' })
      }
      if (table === 'post_tags') return mockQuery(null)
      throw new Error(`unexpected table ${table}`)
    })

    const { error } = await attachTagsToPost('p1', ['newtag'])

    expect(error).toBeNull()
  })

  it('surfaces a resolve error without attempting the insert', async () => {
    supabaseMock.from.mockImplementation((table: string) => {
      if (table === 'tags') return mockQuery(null, { message: 'db down' })
      throw new Error(`unexpected table ${table}`)
    })

    const { error } = await attachTagsToPost('p1', ['gravel'])

    expect(error).toMatch(/Couldn't save tag "gravel"/)
  })
})

describe('getTagsForPost', () => {
  it('joins post_tags to tags and returns sorted names', async () => {
    supabaseMock.from.mockImplementation((table: string) => {
      if (table === 'post_tags') return mockQuery([{ tag_id: 't1' }, { tag_id: 't2' }])
      if (table === 'tags') return mockQuery([{ name: 'gravel' }, { name: 'commuting' }])
      throw new Error(`unexpected table ${table}`)
    })

    expect(await getTagsForPost('p1')).toEqual(['commuting', 'gravel'])
  })

  it('returns an empty list when the post has no tags', async () => {
    supabaseMock.from.mockReturnValue(mockQuery([]))

    expect(await getTagsForPost('p1')).toEqual([])
  })
})

describe('removeTagFromPost', () => {
  it('deletes the post_tags row for the named tag', async () => {
    const deleteMock = vi.fn()
    supabaseMock.from.mockImplementation((table: string) => {
      if (table === 'tags') return mockQuery({ id: 'tag-1' })
      if (table === 'post_tags') {
        deleteMock()
        return mockQuery(null)
      }
      throw new Error(`unexpected table ${table}`)
    })

    const { error } = await removeTagFromPost('p1', 'gravel')

    expect(error).toBeNull()
    expect(deleteMock).toHaveBeenCalledTimes(1)
  })

  it('is a no-op when the tag does not exist', async () => {
    const deleteMock = vi.fn()
    supabaseMock.from.mockImplementation((table: string) => {
      if (table === 'tags') return mockQuery(null)
      if (table === 'post_tags') {
        deleteMock()
        return mockQuery(null)
      }
      throw new Error(`unexpected table ${table}`)
    })

    await removeTagFromPost('p1', 'ghost')

    expect(deleteMock).not.toHaveBeenCalled()
  })
})

describe('replacePostTags', () => {
  it('leaves existing tags untouched when resolving the new names fails', async () => {
    const deleteMock = vi.fn()
    supabaseMock.from.mockImplementation((table: string) => {
      if (table === 'tags') return mockQuery(null, { message: 'db down' })
      if (table === 'post_tags') {
        deleteMock()
        return mockQuery(null)
      }
      throw new Error(`unexpected table ${table}`)
    })

    const { error } = await replacePostTags('p1', ['gravel'])

    expect(error).toMatch(/Couldn't save tag/)
    expect(deleteMock).not.toHaveBeenCalled()
  })

  it('clears then reattaches the new tag list', async () => {
    const calls: string[] = []
    supabaseMock.from.mockImplementation((table: string) => {
      if (table === 'tags') return mockQuery({ id: 'tag-1' })
      if (table === 'post_tags') {
        calls.push('post_tags')
        return mockQuery(null)
      }
      throw new Error(`unexpected table ${table}`)
    })

    const { error } = await replacePostTags('p1', ['gravel'])

    expect(error).toBeNull()
    expect(calls.length).toBeGreaterThanOrEqual(2)
  })
})
