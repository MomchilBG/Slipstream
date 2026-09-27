import { supabase } from './supabaseClient'
import { getPublicProfiles } from './publicProfiles'
import type { PostSummary } from './posts'
import type { PublicProfile } from './publicProfiles'

export type SortOption = 'recent' | 'score'

export type SearchMode = 'posts' | 'tags' | 'users'

export interface ParsedQuery {
  words: string[]
  tags: string[]
  users: string[]
}

// "#gravel #mountain_biking maintenance u/alice" -> { words: ['maintenance'],
// tags: ['gravel', 'mountain biking'], users: ['alice'] }. Underscores stand
// in for the spaces a multi-word tag can't otherwise express in a
// space-delimited search box; lowercasing mirrors the username field at
// registration (both for tags and for the u/ user-lookup prefix).
export const parseSearchQuery = (raw: string): ParsedQuery => {
  const words: string[] = []
  const tags: string[] = []
  const users: string[] = []

  for (const token of raw.trim().split(/\s+/).filter(Boolean)) {
    if (token.startsWith('#')) {
      const tag = token.slice(1).toLowerCase().replace(/_/g, ' ').trim()
      if (tag) tags.push(tag)
    } else if (token.toLowerCase().startsWith('u/')) {
      const user = token.slice(2).toLowerCase().trim()
      if (user) users.push(user)
    } else {
      words.push(token)
    }
  }

  return { words, tags, users }
}

// Inverse of parseSearchQuery's tag handling - builds the /posts?q=... link
// a tag pill navigates to when clicked.
export const tagSearchHref = (tagName: string): string => {
  const query = `#${tagName.trim().replace(/\s+/g, '_')}`
  return `/posts?q=${encodeURIComponent(query)}`
}

// Describes a raw ?q= string for the results heading: which mode it reads as
// and the query text with that mode's prefix stripped back off. A query
// carrying any u/ token is treated as a user search outright (mixing users
// with post words/tags has no sensible combined meaning); a pure #tag query
// (no plain words) reads as a tags search; anything else - including a
// mixed "#tag word" query typed by hand rather than via the mode dropdown -
// falls back to the plain posts search, shown with its prefixes intact.
export const describeSearchQuery = (raw: string): { mode: SearchMode; display: string } => {
  const parsed = parseSearchQuery(raw)
  if (parsed.users.length > 0) return { mode: 'users', display: parsed.users.join(' ') }
  if (parsed.tags.length > 0 && parsed.words.length === 0) return { mode: 'tags', display: parsed.tags.join(' ') }
  return { mode: 'posts', display: raw }
}

export const SEARCH_PAGE_SIZE = 20

export interface SearchPostsResult {
  posts: PostSummary[]
  totalCount: number
}

export const searchPosts = async (query: ParsedQuery, sort: SortOption, page: number): Promise<SearchPostsResult> => {
  const { data, error } = await supabase.rpc('search_posts', {
    search_words: query.words,
    tag_names: query.tags,
    sort_by: sort,
    page_limit: SEARCH_PAGE_SIZE,
    page_offset: page * SEARCH_PAGE_SIZE,
  })

  if (error || !data || data.length === 0) return { posts: [], totalCount: 0 }

  const authorIds = [...new Set(data.map((row) => row.author_id))]
  const profiles = await getPublicProfiles(authorIds)

  const posts: PostSummary[] = data.map((row) => ({
    id: row.id,
    title: row.title,
    author: profiles.get(row.author_id)?.username ?? 'Unknown',
    commentCount: row.comment_count,
    createdAt: row.created_at,
    score: row.like_count - row.dislike_count,
  }))

  return { posts, totalCount: data[0].total_count }
}

const USER_SEARCH_LIMIT = 50

// PostgREST's .or() filter syntax treats , ( ) as structural separators, so a
// literal one in a user-typed search term (e.g. a pasted "Smith, John") would
// otherwise corrupt the filter string it's spliced into and silently return
// no rows. Quoting the value, with any backslash/double-quote inside it
// escaped, is how PostgREST expects a literal value to be passed - see
// https://postgrest.org/en/stable/references/api/tables_views/#operators
export const escapeOrFilterValue = (value: string): string => `"${value.replace(/[\\"]/g, '\\$&')}"`

// u/username search: matches any profile whose username contains any of the
// given terms, via the same public_profiles() RPC the rest of the app uses
// for batch profile lookups - PostgREST applies the ilike/or/order/limit
// filters server-side, same as getPublicProfiles' .in() above.
export const searchUsers = async (terms: string[]): Promise<PublicProfile[]> => {
  if (terms.length === 0) return []

  const { data } = await supabase
    .rpc('public_profiles')
    .or(terms.map((term) => `username.ilike.${escapeOrFilterValue(`%${term}%`)}`).join(','))
    .order('username')
    .limit(USER_SEARCH_LIMIT)

  return (data ?? []).map((row) => ({
    id: row.id,
    username: row.username,
    firstName: row.first_name,
    lastName: row.last_name,
    avatarUrl: row.avatar_url,
    reputation: row.reputation,
    role: row.role,
    isBlocked: row.is_blocked,
  }))
}
