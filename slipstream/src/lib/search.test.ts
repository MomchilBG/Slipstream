import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockQuery } from '../test/mockSupabase'
import type { SupabaseMock } from '../test/mockSupabase'
import { supabase } from './supabaseClient'
import { describeSearchQuery, escapeOrFilterValue, parseSearchQuery, searchPosts, searchUsers, tagSearchHref } from './search'

vi.mock('./supabaseClient', async () => {
  const { createSupabaseMock } = await import('../test/mockSupabase')
  return { supabase: createSupabaseMock() }
})

const supabaseMock = supabase as unknown as SupabaseMock

beforeEach(() => {
  supabaseMock.from.mockReset()
  supabaseMock.rpc.mockReset()
})

describe('parseSearchQuery', () => {
  it('splits tags, users, and plain words apart', () => {
    expect(parseSearchQuery('#gravel #mountain_biking maintenance u/alice')).toEqual({
      words: ['maintenance'],
      tags: ['gravel', 'mountain biking'],
      users: ['alice'],
    })
  })

  it('lowercases tags and usernames but not plain words', () => {
    expect(parseSearchQuery('#Gravel U/Alice Maintenance')).toEqual({
      words: ['Maintenance'],
      tags: ['gravel'],
      users: ['alice'],
    })
  })

  it('ignores empty/whitespace-only input', () => {
    expect(parseSearchQuery('   ')).toEqual({ words: [], tags: [], users: [] })
  })

  it('drops a bare # or u/ with nothing after it', () => {
    expect(parseSearchQuery('# u/')).toEqual({ words: [], tags: [], users: [] })
  })
})

describe('tagSearchHref', () => {
  it('turns spaces into underscores and url-encodes the #-prefixed query', () => {
    expect(tagSearchHref('mountain biking')).toBe('/posts?q=%23mountain_biking')
  })
})

describe('describeSearchQuery', () => {
  it('reads any u/ token as a user search, even mixed with other tokens', () => {
    expect(describeSearchQuery('#gravel u/alice maintenance')).toEqual({ mode: 'users', display: 'alice' })
  })

  it('reads a pure #tag query with no plain words as a tag search', () => {
    expect(describeSearchQuery('#gravel #commuting')).toEqual({ mode: 'tags', display: 'gravel commuting' })
  })

  it('falls back to a posts search for a mixed #tag + word query', () => {
    expect(describeSearchQuery('#gravel maintenance')).toEqual({ mode: 'posts', display: '#gravel maintenance' })
  })

  it('reads a plain-word query as a posts search', () => {
    expect(describeSearchQuery('disc brakes')).toEqual({ mode: 'posts', display: 'disc brakes' })
  })
})

describe('escapeOrFilterValue', () => {
  it('wraps the value in quotes', () => {
    expect(escapeOrFilterValue('alice')).toBe('"alice"')
  })

  it('escapes embedded commas, parens, and quotes so they read as literal', () => {
    expect(escapeOrFilterValue('Smith, John (jr)')).toBe('"Smith, John (jr)"')
  })

  it('escapes a literal backslash or double quote', () => {
    expect(escapeOrFilterValue('a"b\\c')).toBe('"a\\"b\\\\c"')
  })
})

describe('searchPosts', () => {
  it('maps search_posts() rows to PostSummary using the total_count column', async () => {
    supabaseMock.rpc.mockImplementation((name: string) => {
      if (name === 'search_posts') {
        return mockQuery([
          { id: 'p1', title: 'Tubeless setup', author_id: 'u1', comment_count: 2, created_at: '2024-02-01T00:00:00.000Z', like_count: 5, dislike_count: 1, total_count: 12 },
        ])
      }
      if (name === 'public_profiles') {
        return mockQuery([{ id: 'u1', username: 'alexr', first_name: 'Alex', last_name: null, avatar_url: null, reputation: 5, role: 'user', is_blocked: false }])
      }
      throw new Error(`unexpected rpc ${name}`)
    })

    const result = await searchPosts({ words: ['tubeless'], tags: [], users: [] }, 'score', 0)

    expect(result.totalCount).toBe(12)
    expect(result.posts).toEqual([
      { id: 'p1', title: 'Tubeless setup', author: 'alexr', commentCount: 2, createdAt: '2024-02-01T00:00:00.000Z', score: 4 },
    ])
  })

  it('returns an empty result when the RPC errors', async () => {
    supabaseMock.rpc.mockReturnValue(mockQuery(null, { message: 'boom' }))

    expect(await searchPosts({ words: [], tags: [], users: [] }, 'recent', 0)).toEqual({ posts: [], totalCount: 0 })
  })
})

describe('searchUsers', () => {
  it('returns an empty list without querying when given no terms', async () => {
    expect(await searchUsers([])).toEqual([])
    expect(supabaseMock.rpc).not.toHaveBeenCalled()
  })

  it('maps matching profile rows', async () => {
    supabaseMock.rpc.mockReturnValue(mockQuery([{ id: 'u1', username: 'alexr', first_name: 'Alex', last_name: 'Rivera', avatar_url: null, reputation: 10, role: 'admin', is_blocked: true }]))

    const result = await searchUsers(['alex'])

    expect(result).toEqual([{ id: 'u1', username: 'alexr', firstName: 'Alex', lastName: 'Rivera', avatarUrl: null, reputation: 10, role: 'admin', isBlocked: true }])
  })
})
