import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import PostSummaryCard from '../../components/PostSummaryCard/PostSummaryCard'
import { describeSearchQuery, parseSearchQuery, searchPosts, searchUsers } from '../../lib/search'
import type { SortOption } from '../../lib/search'
import type { PostSummary } from '../../lib/posts'
import type { PublicProfile } from '../../lib/publicProfiles'
import { formatFullName } from '../../lib/formatName'
import './PostsBrowse.css'

const sortLinkClass = (current: SortOption, target: SortOption) => current === target ? 'active' : undefined

const RESULTS_HEADING: Record<'posts' | 'tags' | 'users', (display: string) => string> = {
  posts: (display) => `Results for "${display}"`,
  tags: (display) => `Tag results for "${display}"`,
  users: (display) => `User results for "${display}"`,
}

const PostsBrowse = () => {
  const [searchParams] = useSearchParams()
  const q = searchParams.get('q') ?? ''
  const sort: SortOption = searchParams.get('sort') === 'score' ? 'score' : 'recent'
  const { mode, display } = describeSearchQuery(q)

  if (mode === 'users') {
    return <UserSearchResults key={q} terms={parseSearchQuery(q).users} display={display} />
  }

  // Keyed on the search criteria so changing them remounts this (and resets
  // its fetch/pagination state) instead of needing to reset it in an effect.
  return <PostsBrowseResults key={`${q}::${sort}`} q={q} sort={sort} heading={q ? RESULTS_HEADING[mode](display) : 'Browse posts'} />
}

const UserSearchResults = ({ terms, display }: { terms: string[]; display: string }) => {
  const [users, setUsers] = useState<PublicProfile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    searchUsers(terms).then((result) => {
      if (cancelled) return
      setUsers(result)
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [terms])

  return (
    <section id="posts-browse-page">
      <div id="posts-browse-header">
        <h1>{RESULTS_HEADING.users(display)}</h1>
      </div>

      {loading ? (
        <p>Loading…</p>
      ) : users.length === 0 ? (
        <p>No users match your search.</p>
      ) : (
        <ul id="user-search-list">
          {users.map((user) => (
            <li key={user.id} className="user-result-card">
              <Link to={`/users/${user.username}`} className="user-result-avatar">
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt="" />
                ) : (
                  <span>{user.username.slice(0, 1).toUpperCase()}</span>
                )}
              </Link>
              <div className="user-result-identity">
                <Link to={`/users/${user.username}`} className="user-result-username">
                  {user.username}
                </Link>
                <span className="user-result-meta">
                  {formatFullName(user.firstName, user.lastName)} · {user.reputation} reputation
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

const PostsBrowseResults = ({ q, sort, heading }: { q: string; sort: SortOption; heading: string }) => {
  const [posts, setPosts] = useState<PostSummary[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(0)

  useEffect(() => {
    let cancelled = false

    searchPosts(parseSearchQuery(q), sort, 0).then((result) => {
      if (cancelled) return
      setPosts(result.posts)
      setTotalCount(result.totalCount)
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [q, sort])

  const handleLoadMore = async () => {
    setLoadingMore(true)
    const nextPage = page + 1
    const result = await searchPosts(parseSearchQuery(q), sort, nextPage)
    setPosts((current) => [...current, ...result.posts])
    setPage(nextPage)
    setLoadingMore(false)
  }

  const hasMore = posts.length < totalCount

  const sortLink = (target: SortOption): string => {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    params.set('sort', target)
    return `/posts?${params.toString()}`
  }

  return (
    <section id="posts-browse-page">
      <div id="posts-browse-header">
        <h1>{heading}</h1>
        <div id="posts-browse-sort">
          <Link to={sortLink('recent')} className={sortLinkClass(sort, 'recent')}>
            Most recent
          </Link>
          <Link to={sortLink('score')} className={sortLinkClass(sort, 'score')}>
            Top score
          </Link>
        </div>
      </div>

      {loading ? (
        <p>Loading…</p>
      ) : posts.length === 0 ? (
        <p>No posts match your search.</p>
      ) : (
        <>
          <ul id="posts-browse-list">
            {posts.map((post) => (
              <PostSummaryCard key={post.id} post={post} />
            ))}
          </ul>
          {hasMore && (
            <button type="button" className="button" onClick={handleLoadMore} disabled={loadingMore}>
              {loadingMore ? 'Loading…' : `Load more (${totalCount - posts.length} left)`}
            </button>
          )}
        </>
      )}
    </section>
  )
}

export default PostsBrowse
