import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { parseSearchQuery, searchPosts } from '../../lib/search'
import type { SortOption } from '../../lib/search'
import type { PostSummary } from '../../lib/posts'
import { deletePost } from '../../lib/posts'
import { getComments, deleteComment, DELETED_COMMENT_PLACEHOLDER } from '../../lib/postDetail'
import type { CommentItem } from '../../lib/postDetail'
import { getTagsForPost, removeTagFromPost } from '../../lib/tags'
import { formatDateTime } from '../../lib/formatDate'
import ConfirmDialog from '../../components/ConfirmDialog/ConfirmDialog'
import './Admin.css'

const adminTabClass = ({ isActive }: { isActive: boolean }) => isActive ? 'active' : undefined
const sortLinkClass = (current: SortOption, target: SortOption) => current === target ? 'active' : undefined

interface TagModalState {
  postId: string
  title: string
  tags: string[]
  // getTagsForPost() resolves after the modal opens with tags: [] - this
  // tells the "Loading tags…" placeholder apart from a post that genuinely
  // has none.
  loaded: boolean
}

interface CommentsModalState {
  postId: string
  title: string
  comments: CommentItem[]
  loaded: boolean
}

const AdminPosts = () => {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortOption>('recent')
  const [posts, setPosts] = useState<PostSummary[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<PostSummary | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const [tagModal, setTagModal] = useState<TagModalState | null>(null)
  const [tagError, setTagError] = useState<string | null>(null)
  const [removingTag, setRemovingTag] = useState<string | null>(null)

  const [commentsModal, setCommentsModal] = useState<CommentsModalState | null>(null)
  const [deleteCommentTarget, setDeleteCommentTarget] = useState<CommentItem | null>(null)
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null)
  const [deleteCommentError, setDeleteCommentError] = useState<string | null>(null)

  const runSearch = async (nextSort: SortOption, nextPage: number) => {
    if (nextPage === 0) setLoading(true)
    else setLoadingMore(true)

    const result = await searchPosts(parseSearchQuery(query), nextSort, nextPage)

    if (nextPage === 0) setPosts(result.posts)
    else setPosts((current) => [...current, ...result.posts])

    setTotalCount(result.totalCount)
    setPage(nextPage)
    setLoading(false)
    setLoadingMore(false)
  }

  // Load the default (unfiltered, most-recent) list once on mount, same as
  // PostsBrowse does - only the initial load is automatic, sort/search/load
  // more are all explicit user actions after that. Fetches directly (like
  // PostsBrowse's own mount effect) rather than through runSearch, since
  // runSearch's synchronous setLoading(true) at the top - fine when called
  // from an event handler - trips the set-state-in-effect lint rule when
  // called straight from an effect body.
  useEffect(() => {
    searchPosts(parseSearchQuery(''), 'recent', 0).then((result) => {
      setPosts(result.posts)
      setTotalCount(result.totalCount)
      setLoading(false)
    })
  }, [])

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void runSearch(sort, 0)
  }

  const handleSort = (target: SortOption) => {
    setSort(target)
    void runSearch(target, 0)
  }

  const handleLoadMore = () => void runSearch(sort, page + 1)

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    setDeleteError(null)

    const { error } = await deletePost(deleteTarget.id)
    setDeleting(false)

    if (error) {
      setDeleteError(error.message)
      return
    }

    setPosts((current) => current.filter((post) => post.id !== deleteTarget.id))
    setTotalCount((current) => Math.max(current - 1, 0))
    setDeleteTarget(null)
  }

  const openTagModal = async (post: PostSummary) => {
    setTagModal({ postId: post.id, title: post.title, tags: [], loaded: false })
    setTagError(null)
    const tags = await getTagsForPost(post.id)
    setTagModal((current) => (current && current.postId === post.id ? { ...current, tags, loaded: true } : current))
  }

  const removeTag = async (tag: string) => {
    if (!tagModal) return
    setRemovingTag(tag)
    setTagError(null)

    const { error } = await removeTagFromPost(tagModal.postId, tag)
    setRemovingTag(null)

    if (error) {
      setTagError(error)
      return
    }

    setTagModal((current) => (current ? { ...current, tags: current.tags.filter((existing) => existing !== tag) } : current))
  }

  const openCommentsModal = async (post: PostSummary) => {
    setCommentsModal({ postId: post.id, title: post.title, comments: [], loaded: false })
    const comments = await getComments(post.id)
    setCommentsModal((current) => (current && current.postId === post.id ? { ...current, comments, loaded: true } : current))
  }

  // Deleting a comment soft-deletes it (content replaced with "[deleted]",
  // the row otherwise untouched) rather than removing it, so it's just a
  // local patch here rather than a refetch - no reply gets reparented and
  // the post's comment_count doesn't change.
  const confirmDeleteComment = async () => {
    if (!deleteCommentTarget) return
    const commentId = deleteCommentTarget.id

    setDeletingCommentId(commentId)
    setDeleteCommentError(null)

    const { error } = await deleteComment(commentId)
    setDeletingCommentId(null)

    if (error) {
      setDeleteCommentError(error.message)
      return
    }

    setCommentsModal((current) =>
      current
        ? {
            ...current,
            comments: current.comments.map((comment) =>
              comment.id === commentId ? { ...comment, content: DELETED_COMMENT_PLACEHOLDER, isDeleted: true } : comment,
            ),
          }
        : current,
    )
    setDeleteCommentTarget(null)
  }

  const hasMore = posts.length < totalCount

  return (
    <section id="admin-page">
      <h1>Admin</h1>
      <nav id="admin-tabs">
        <NavLink to="/admin/users" className={adminTabClass}>
          Users
        </NavLink>
        <NavLink to="/admin/posts" className={adminTabClass}>
          Posts
        </NavLink>
      </nav>

      <form id="admin-post-search" onSubmit={handleSubmit}>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search posts or #tag_name"
          aria-label="Search posts"
        />
        <button type="submit" className="button primary">
          Search
        </button>
      </form>

      <div id="admin-post-sort">
        <button type="button" className={sortLinkClass(sort, 'recent')} onClick={() => handleSort('recent')}>
          Most recent
        </button>
        <button type="button" className={sortLinkClass(sort, 'score')} onClick={() => handleSort('score')}>
          Top score
        </button>
      </div>

      {loading ? (
        <p>Loading…</p>
      ) : posts.length === 0 ? (
        <p>No posts match.</p>
      ) : (
        <>
          <ul id="admin-post-list">
            {posts.map((post) => (
              <li key={post.id} className="admin-post-row">
                <div className="admin-post-identity">
                  <Link to={`/posts/${post.id}`} className="admin-post-title">
                    {post.title}
                  </Link>
                  <span className="admin-post-meta">
                    by <Link to={`/users/${post.author}`}>{post.author}</Link> · {post.commentCount} comments
                    {post.score !== undefined && ` · ${post.score} score`} · {formatDateTime(post.createdAt)}
                  </span>
                </div>
                <div className="admin-post-actions">
                  <button type="button" className="button" onClick={() => void openCommentsModal(post)}>
                    Comments
                  </button>
                  <button type="button" className="button" onClick={() => void openTagModal(post)}>
                    Remove tags
                  </button>
                  <button type="button" className="button danger" onClick={() => setDeleteTarget(post)}>
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {hasMore && (
            <button type="button" className="button" onClick={handleLoadMore} disabled={loadingMore}>
              {loadingMore ? 'Loading…' : `Load more (${totalCount - posts.length} left)`}
            </button>
          )}
        </>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete post"
          message={`Delete "${deleteTarget.title}"? This also removes its comments and votes. This can't be undone.`}
          confirmLabel="Delete"
          danger
          confirming={deleting}
          error={deleteError}
          onConfirm={() => void confirmDelete()}
          onCancel={() => {
            setDeleteTarget(null)
            setDeleteError(null)
          }}
        />
      )}

      {tagModal && (
        <div className="modal-overlay" onClick={removingTag ? undefined : () => setTagModal(null)}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <h2>Tags on &quot;{tagModal.title}&quot;</h2>
            {tagError && <p className="auth-form-error">{tagError}</p>}
            {!tagModal.loaded ? (
              <p>Loading tags…</p>
            ) : tagModal.tags.length === 0 ? (
              <p>This post has no tags.</p>
            ) : (
              <ul id="tag-bubble-list">
                {tagModal.tags.map((tag) => (
                  <li key={tag} className="tag-bubble">
                    <span>{tag}</span>
                    <button
                      type="button"
                      onClick={() => void removeTag(tag)}
                      disabled={removingTag === tag}
                      aria-label={`Remove tag ${tag}`}
                    >
                      <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                        <line x1="4" y1="4" x2="20" y2="20" />
                        <line x1="20" y1="4" x2="4" y2="20" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="modal-actions">
              <button type="button" className="button" onClick={() => setTagModal(null)} disabled={!!removingTag}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {commentsModal && (
        <div className="modal-overlay" onClick={deletingCommentId ? undefined : () => setCommentsModal(null)}>
          <div className="modal-card admin-comments-modal" onClick={(event) => event.stopPropagation()}>
            <h2>Comments on &quot;{commentsModal.title}&quot;</h2>
            {!commentsModal.loaded ? (
              <p>Loading…</p>
            ) : commentsModal.comments.length === 0 ? (
              <p>No comments on this post.</p>
            ) : (
              <ul id="admin-comment-list">
                {commentsModal.comments.map((comment) => (
                  <li key={comment.id} className="admin-comment-row">
                    <div className="admin-comment-body">
                      <span className="admin-comment-meta">
                        {comment.parentCommentId && 'Reply · '}
                        <Link to={`/users/${comment.author.username}`}>{comment.author.username}</Link> ·{' '}
                        {formatDateTime(comment.createdAt)}
                      </span>
                      <p className={comment.isDeleted ? 'admin-comment-content admin-comment-content-deleted' : 'admin-comment-content'}>
                        {comment.content}
                      </p>
                    </div>
                    {!comment.isDeleted && (
                      <button
                        type="button"
                        className="button danger"
                        onClick={() => setDeleteCommentTarget(comment)}
                        disabled={deletingCommentId === comment.id}
                      >
                        Delete
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <div className="modal-actions">
              <button type="button" className="button" onClick={() => setCommentsModal(null)} disabled={!!deletingCommentId}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteCommentTarget && (
        <ConfirmDialog
          title="Delete comment"
          message={`Delete this comment? Its content will be replaced with "${DELETED_COMMENT_PLACEHOLDER}" and this can't be undone.`}
          confirmLabel="Delete"
          danger
          confirming={deletingCommentId === deleteCommentTarget.id}
          error={deleteCommentError}
          onConfirm={() => void confirmDeleteComment()}
          onCancel={() => {
            setDeleteCommentTarget(null)
            setDeleteCommentError(null)
          }}
        />
      )}
    </section>
  )
}

export default AdminPosts
