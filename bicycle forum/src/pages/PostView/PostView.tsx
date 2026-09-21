import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import {
  castVote,
  createComment,
  deleteComment,
  DELETED_COMMENT_PLACEHOLDER,
  getComments,
  getPostDetail,
  updateComment,
} from '../../lib/postDetail'
import type { Badge, CommentItem, PostDetail } from '../../lib/postDetail'
import { deletePost } from '../../lib/posts'
import { savePost, unsavePost } from '../../lib/savedPosts'
import { tagSearchHref } from '../../lib/search'
import { formatDateTime } from '../../lib/formatDate'
import { formatFullName } from '../../lib/formatName'
import { roleLabel } from '../../lib/publicProfiles'
import type { PublicProfile } from '../../lib/publicProfiles'
import ConfirmDialog from '../../components/ConfirmDialog/ConfirmDialog'
import ImageLightbox from '../../components/ImageLightbox/ImageLightbox'
import MentionText from '../../components/MentionText/MentionText'
import '../auth.css'
import './PostView.css'

const AuthorAvatar = ({ author }: { author: { username: string; avatarUrl: string | null } }) =>
  author.avatarUrl ? (
    <img className="author-avatar" src={author.avatarUrl} alt="" />
  ) : (
    <span className="author-avatar author-avatar-fallback">{author.username.slice(0, 1).toUpperCase()}</span>
  )

const CommentBadges = ({ author, badges }: { author: PublicProfile; badges: Badge[] }) => (
  <span className="comment-badges">
    <span className={`comment-badge-pill role-pill role-${author.role}`}>{roleLabel(author.role)}</span>
    {author.isBlocked && <span className="comment-badge-pill blocked-pill">Blocked</span>}
    {badges.map((badge) => (
      <span key={badge.id} className="comment-badge-pill" title={badge.description}>
        {badge.name}
      </span>
    ))}
  </span>
)

interface CommentBodyProps {
  comment: CommentItem
  canReply: boolean
  canEdit: boolean
  canDelete: boolean
  isEditing: boolean
  editText: string
  editError: string | null
  savingEdit: boolean
  isDeleting: boolean
  onStartReply: () => void
  onStartEdit: () => void
  onCancelEdit: () => void
  onEditTextChange: (value: string) => void
  onEditSubmit: (event: FormEvent<HTMLFormElement>) => void
  onDelete: () => void
}

const CommentBody = ({
  comment,
  canReply,
  canEdit,
  canDelete,
  isEditing,
  editText,
  editError,
  savingEdit,
  isDeleting,
  onStartReply,
  onStartEdit,
  onCancelEdit,
  onEditTextChange,
  onEditSubmit,
  onDelete,
}: CommentBodyProps) => {
  const wasEdited = !comment.isDeleted && comment.updatedAt !== comment.createdAt

  return (
    <div className="comment-row">
      <AuthorAvatar author={comment.author} />
      <div>
        <div className="comment-meta">
          <Link to={`/users/${comment.author.username}`} className="comment-author">
            {comment.author.username}
          </Link>
          <CommentBadges author={comment.author} badges={comment.badges} />
          <span className="comment-date">
            {formatDateTime(comment.createdAt)}
            {wasEdited && ' (edited)'}
          </span>
        </div>

        {isEditing ? (
          <form className="comment-edit-form" onSubmit={onEditSubmit}>
            <textarea
              value={editText}
              onChange={(event) => onEditTextChange(event.target.value)}
              rows={3}
              maxLength={8192}
              autoFocus
            />
            {editError && <p className="auth-form-error">{editError}</p>}
            <div className="comment-edit-actions">
              <button type="submit" className="button primary" disabled={savingEdit}>
                {savingEdit ? 'Saving…' : 'Save'}
              </button>
              <button type="button" onClick={onCancelEdit}>
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <>
            <p className={comment.isDeleted ? 'comment-content comment-content-deleted' : 'comment-content'}>
              {comment.isDeleted ? comment.content : <MentionText text={comment.content} />}
            </p>
            <div className="comment-actions">
              {canReply && (
                <button type="button" className="action-link" onClick={onStartReply}>
                  Reply
                </button>
              )}
              {canEdit && (
                <button type="button" className="action-link" onClick={onStartEdit}>
                  Edit
                </button>
              )}
              {canDelete && (
                <button type="button" className="action-link danger" onClick={onDelete} disabled={isDeleting}>
                  {isDeleting ? 'Deleting…' : 'Delete'}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

const PostView = () => {
  const { id } = useParams<{ id: string }>()
  if (!id) return null
  // Keyed on the post id so navigating between posts remounts this (and
  // resets all of its fetch state) instead of needing to reset it in an effect.
  return <PostViewForPost key={id} postId={id} />
}

const PostViewForPost = ({ postId }: { postId: string }) => {
  const navigate = useNavigate()
  const { profile, user } = useAuth()

  const [post, setPost] = useState<PostDetail | null>(null)
  const [comments, setComments] = useState<CommentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [voting, setVoting] = useState(false)
  const [voteError, setVoteError] = useState<string | null>(null)
  const [savingBookmark, setSavingBookmark] = useState(false)
  const [bookmarkError, setBookmarkError] = useState<string | null>(null)
  const [commentText, setCommentText] = useState('')
  const [commentError, setCommentError] = useState<string | null>(null)
  const [submittingComment, setSubmittingComment] = useState(false)

  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  // The username of whichever comment/reply "Reply" was actually clicked on
  // - separate from replyingTo (always the top-level thread id, since
  // replies are flat) so the composer's placeholder still names the right
  // person if the prefilled @mention is cleared out.
  const [replyingToAuthor, setReplyingToAuthor] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [replyError, setReplyError] = useState<string | null>(null)
  const [submittingReply, setSubmittingReply] = useState(false)

  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [editError, setEditError] = useState<string | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null)
  const [deleteCommentTarget, setDeleteCommentTarget] = useState<CommentItem | null>(null)
  const [deleteCommentError, setDeleteCommentError] = useState<string | null>(null)

  const [deletingPost, setDeletingPost] = useState(false)
  const [postActionError, setPostActionError] = useState<string | null>(null)
  const [showDeletePostConfirm, setShowDeletePostConfirm] = useState(false)

  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [highlightedCommentId, setHighlightedCommentId] = useState<string | null>(null)
  const location = useLocation()

  useEffect(() => {
    let cancelled = false

    Promise.all([getPostDetail(postId, user?.id ?? null), getComments(postId)]).then(
      ([postResult, commentsResult]) => {
        if (cancelled) return
        setPost(postResult)
        setNotFound(!postResult)
        setComments(commentsResult)
        setLoading(false)
      },
    )

    return () => {
      cancelled = true
    }
  }, [postId, user?.id])

  // Landing here from a notification (a #comment-<id> hash) - scroll to and
  // briefly highlight the comment it points at, once the comments it needs
  // to find have actually loaded. Runs once per hash rather than per
  // render, so it doesn't keep re-scrolling on every unrelated state update.
  useEffect(() => {
    if (loading || !location.hash.startsWith('#comment-')) return

    const commentId = location.hash.slice('#comment-'.length)
    const target = document.getElementById(location.hash.slice(1))
    if (!target) return

    target.scrollIntoView({ behavior: 'smooth', block: 'center' })

    // Deferred rather than called synchronously in the effect body itself
    // (react-hooks/set-state-in-effect) - both timeouts still fire well
    // within the same tick's worth of user-perceived time.
    const highlightTimeout = setTimeout(() => setHighlightedCommentId(commentId), 0)
    const unhighlightTimeout = setTimeout(() => setHighlightedCommentId(null), 2500)
    return () => {
      clearTimeout(highlightTimeout)
      clearTimeout(unhighlightTimeout)
    }
  }, [loading, location.hash])

  const refreshPost = async () => {
    const result = await getPostDetail(postId, user?.id ?? null)
    setPost(result)
  }

  const refreshComments = async () => {
    const updated = await getComments(postId)
    setComments(updated)
  }

  const handleVote = async (value: 1 | -1) => {
    if (!user || voting) return
    setVoting(true)
    setVoteError(null)

    const { error } = await castVote(postId, user.id, value)
    if (error) {
      setVoteError(error.message)
      setVoting(false)
      return
    }

    await refreshPost()
    setVoting(false)
  }

  const handleToggleSave = async () => {
    if (!user || !post || savingBookmark) return
    setSavingBookmark(true)
    setBookmarkError(null)

    const { error } = post.isSaved ? await unsavePost(user.id, postId) : await savePost(user.id, postId)
    setSavingBookmark(false)

    if (error) {
      setBookmarkError(error.message)
      return
    }

    setPost({ ...post, isSaved: !post.isSaved })
  }

  const closeDeletePostConfirm = () => {
    setShowDeletePostConfirm(false)
    setPostActionError(null)
  }

  const handleDeletePost = async () => {
    if (!profile) return
    setDeletingPost(true)
    setPostActionError(null)

    const { error } = await deletePost(postId)
    setDeletingPost(false)

    if (error) {
      setPostActionError(error.message)
      return
    }

    navigate(`/users/${profile.username}`)
  }

  const handleCommentSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!profile) return
    setCommentError(null)

    const trimmed = commentText.trim()
    if (trimmed.length === 0 || trimmed.length > 8192) {
      setCommentError('Comment must be 1-8192 characters.')
      return
    }

    setSubmittingComment(true)
    const { error } = await createComment(postId, profile.id, trimmed)
    setSubmittingComment(false)

    if (error) {
      setCommentError(error.message)
      return
    }

    setCommentText('')
    await refreshComments()
  }

  // Prefills "@username " for the comment being replied to - it's editable
  // plain text in the textarea (not a real link until posted), but doubles
  // as an implicit mention: MentionText renders it as a profile link once
  // the reply is rendered back, and the notify_on_comment_insert() trigger
  // reads it the same way any other @mention in the content would be read,
  // deliberately deduping against the reply's own reply_to_comment
  // notification rather than sending that person two notifications.
  // Replies are flat (one level deep) - replying to a reply attaches the
  // new comment to the same top-level parent as a sibling, not to the
  // reply itself, so it lands in the same visible list rather than
  // creating a second layer of nesting the rest of this page doesn't
  // render. The reply's own author still gets @mentioned via the prefill.
  const startReply = (comment: CommentItem) => {
    setReplyingTo(comment.parentCommentId ?? comment.id)
    setReplyingToAuthor(comment.author.username)
    setReplyText(`@${comment.author.username} `)
    setReplyError(null)
  }

  const cancelReply = () => {
    setReplyingTo(null)
    setReplyingToAuthor(null)
    setReplyText('')
    setReplyError(null)
  }

  const handleReplySubmit = async (event: FormEvent<HTMLFormElement>, parentId: string) => {
    event.preventDefault()
    if (!profile) return
    setReplyError(null)

    const trimmed = replyText.trim()
    if (trimmed.length === 0 || trimmed.length > 8192) {
      setReplyError('Reply must be 1-8192 characters.')
      return
    }

    setSubmittingReply(true)
    const { error } = await createComment(postId, profile.id, trimmed, parentId)
    setSubmittingReply(false)

    if (error) {
      setReplyError(error.message)
      return
    }

    cancelReply()
    await refreshComments()
  }

  const startEditComment = (comment: CommentItem) => {
    setEditingCommentId(comment.id)
    setEditText(comment.content)
    setEditError(null)
  }

  const cancelEditComment = () => {
    setEditingCommentId(null)
    setEditText('')
    setEditError(null)
  }

  const handleEditCommentSubmit = async (event: FormEvent<HTMLFormElement>, commentId: string) => {
    event.preventDefault()
    setEditError(null)

    const trimmed = editText.trim()
    if (trimmed.length === 0 || trimmed.length > 8192) {
      setEditError('Comment must be 1-8192 characters.')
      return
    }

    setSavingEdit(true)
    const { error } = await updateComment(commentId, trimmed)
    setSavingEdit(false)

    if (error) {
      setEditError(error.message)
      return
    }

    cancelEditComment()
    await refreshComments()
  }

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

    setComments((current) =>
      current.map((comment) =>
        comment.id === commentId ? { ...comment, content: DELETED_COMMENT_PLACEHOLDER, isDeleted: true } : comment,
      ),
    )
    setDeleteCommentTarget(null)
  }

  if (loading) {
    return (
      <section id="post-view-page">
        <p>Loading…</p>
      </section>
    )
  }

  if (notFound || !post) {
    return (
      <section id="post-view-page">
        <p>This post doesn&apos;t exist.</p>
      </section>
    )
  }

  const isOwnPost = profile?.id === post.author.id
  const canVote = !!profile && !profile.is_blocked && !isOwnPost
  const canComment = !!profile && !profile.is_blocked

  const topLevelComments = comments.filter((comment) => !comment.parentCommentId)
  const repliesByParent = new Map<string, CommentItem[]>()
  for (const comment of comments) {
    if (comment.parentCommentId) {
      const list = repliesByParent.get(comment.parentCommentId) ?? []
      list.push(comment)
      repliesByParent.set(comment.parentCommentId, list)
    }
  }

  // Both top-level comments and their replies can be replied to (replies
  // are flat - see startReply() - so this is the same canComment gate
  // either way, not conditioned on nesting depth).
  const renderCommentBody = (comment: CommentItem) => {
    const isOwn = profile?.id === comment.author.id
    const isOwnAndNotBlocked = isOwn && !!profile && !profile.is_blocked
    // While a comment is being edited, only its own Edit stays available -
    // switching to edit a different comment would silently discard the
    // first one's unsaved text with no warning.
    const editLocked = editingCommentId !== null && editingCommentId !== comment.id

    return (
      <CommentBody
        comment={comment}
        canReply={canComment}
        canEdit={isOwnAndNotBlocked && !editLocked && !comment.isDeleted}
        canDelete={isOwnAndNotBlocked && !comment.isDeleted}
        isEditing={editingCommentId === comment.id}
        editText={editText}
        editError={editError}
        savingEdit={savingEdit}
        isDeleting={deletingCommentId === comment.id}
        onStartReply={() => startReply(comment)}
        onStartEdit={() => startEditComment(comment)}
        onCancelEdit={cancelEditComment}
        onEditTextChange={setEditText}
        onEditSubmit={(event) => handleEditCommentSubmit(event, comment.id)}
        onDelete={() => setDeleteCommentTarget(comment)}
      />
    )
  }

  return (
    <section id="post-view-page">
      <article id="post-view">
        <div className="post-author-card">
          <Link to={`/users/${post.author.username}`} className="post-author-top">
            <AuthorAvatar author={post.author} />
            <div>
              <div className="post-author-name">
                {formatFullName(post.author.firstName, post.author.lastName)}
              </div>
              <div className="post-author-username">@{post.author.username}</div>
            </div>
          </Link>
          <ul className="badge-list">
            <li className={`role-pill role-${post.author.role}`}>{roleLabel(post.author.role)}</li>
            {post.author.isBlocked && <li className="blocked-pill">Blocked</li>}
            {post.authorBadges.map((badge) => (
              <li key={badge.id} title={badge.description}>
                {badge.name}
              </li>
            ))}
          </ul>
        </div>

        <h1>{post.title}</h1>
        <p className="post-view-meta">
          {formatDateTime(post.createdAt)}
          {post.updatedAt !== post.createdAt && ' (edited)'}
        </p>
        <div className="post-view-content">{post.content}</div>

        {post.images.length > 0 && (
          <ul className="post-view-images">
            {post.images.map((url) => (
              <li key={url}>
                <button type="button" onClick={() => setLightboxUrl(url)} aria-label="View full size image">
                  <img src={url} alt="" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {post.tags.length > 0 && (
          <ul className="tag-list">
            {post.tags.map((tag) => (
              <li key={tag}>
                <Link to={tagSearchHref(tag)} className="tag-pill">
                  {tag}
                </Link>
              </li>
            ))}
          </ul>
        )}

        <div id="post-vote-actions">
          <div id="post-votes">
            <button
              type="button"
              className={post.myVote === 1 ? 'vote-arrow active' : 'vote-arrow'}
              onClick={() => handleVote(1)}
              disabled={!canVote || voting}
              aria-label="Upvote"
              title={isOwnPost ? "You can't vote on your own post" : 'Upvote'}
            >
              ▲
            </button>
            <div id="post-vote-score" tabIndex={0}>
              {post.upvoteCount - post.downvoteCount}
              <span id="post-vote-tooltip">
                {post.upvoteCount} upvote{post.upvoteCount === 1 ? '' : 's'} · {post.downvoteCount} downvote
                {post.downvoteCount === 1 ? '' : 's'}
              </span>
            </div>
            <button
              type="button"
              className={post.myVote === -1 ? 'vote-arrow active' : 'vote-arrow'}
              onClick={() => handleVote(-1)}
              disabled={!canVote || voting}
              aria-label="Downvote"
              title={isOwnPost ? "You can't vote on your own post" : 'Downvote'}
            >
              ▼
            </button>
            {user && (
              <button
                type="button"
                className={post.isSaved ? 'button primary' : 'button'}
                onClick={() => void handleToggleSave()}
                disabled={savingBookmark || (!post.isSaved && !!profile?.is_blocked)}
              >
                {post.isSaved ? 'Saved' : 'Save'}
              </button>
            )}
            {!user && <span className="post-view-hint">Log in to vote.</span>}
            {voteError && <span className="auth-error">{voteError}</span>}
            {bookmarkError && <span className="auth-error">{bookmarkError}</span>}
          </div>

          {isOwnPost && !profile?.is_blocked && (
            <div id="post-actions">
              <Link to={`/posts/${postId}/edit`} className="button">
                Edit
              </Link>
              <button
                type="button"
                className="button danger"
                onClick={() => setShowDeletePostConfirm(true)}
                disabled={deletingPost}
              >
                {deletingPost ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          )}
        </div>

        <section id="post-comments">
          <h2>Comments ({comments.length})</h2>

          <div id="comment-composer">
            {canComment ? (
              <form id="comment-form" onSubmit={handleCommentSubmit}>
                <textarea
                  value={commentText}
                  onChange={(event) => setCommentText(event.target.value)}
                  placeholder="Write a comment…"
                  rows={3}
                  maxLength={8192}
                />
                {commentError && <p className="auth-form-error">{commentError}</p>}
                <button type="submit" className="button primary" disabled={submittingComment}>
                  {submittingComment ? 'Posting…' : 'Comment'}
                </button>
              </form>
            ) : !user ? (
              <p className="post-view-hint">
                <Link to="/login">Log in</Link> to leave a comment.
              </p>
            ) : profile?.is_blocked ? (
              <p className="auth-form-error">You&apos;ve been blocked from commenting.</p>
            ) : null}
          </div>

          {topLevelComments.length === 0 ? (
            <p>No comments yet.</p>
          ) : (
            <ul id="comment-list">
              {topLevelComments.map((comment) => (
                <li
                  key={comment.id}
                  id={`comment-${comment.id}`}
                  className={comment.id === highlightedCommentId ? 'comment-item comment-item-highlighted' : 'comment-item'}
                >
                  {renderCommentBody(comment)}

                  {editingCommentId !== comment.id &&
                    (replyingTo === comment.id ? (
                      <form className="reply-form" onSubmit={(event) => handleReplySubmit(event, comment.id)}>
                        <textarea
                          value={replyText}
                          onChange={(event) => setReplyText(event.target.value)}
                          placeholder={`Reply to ${replyingToAuthor ?? comment.author.username}…`}
                          rows={2}
                          maxLength={8192}
                          autoFocus
                        />
                        {replyError && <p className="auth-form-error">{replyError}</p>}
                        <div className="reply-form-actions">
                          <button type="submit" className="button primary" disabled={submittingReply}>
                            {submittingReply ? 'Replying…' : 'Reply'}
                          </button>
                          <button type="button" onClick={cancelReply}>
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : null)}

                  {(repliesByParent.get(comment.id) ?? []).length > 0 && (
                    <ul className="comment-replies">
                      {repliesByParent.get(comment.id)!.map((reply) => (
                        <li
                          key={reply.id}
                          id={`comment-${reply.id}`}
                          className={
                            reply.id === highlightedCommentId
                              ? 'comment-item comment-reply comment-item-highlighted'
                              : 'comment-item comment-reply'
                          }
                        >
                          {renderCommentBody(reply)}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </article>

      {lightboxUrl && <ImageLightbox src={lightboxUrl} onClose={() => setLightboxUrl(null)} />}

      {showDeletePostConfirm && (
        <ConfirmDialog
          title="Delete this post?"
          message="This cannot be undone."
          confirmLabel="Delete post"
          danger
          confirming={deletingPost}
          error={postActionError}
          onConfirm={() => void handleDeletePost()}
          onCancel={closeDeletePostConfirm}
        />
      )}

      {deleteCommentTarget && (
        <ConfirmDialog
          title="Delete comment"
          message={`Delete this comment? Its content will be replaced with "${DELETED_COMMENT_PLACEHOLDER}" and this cannot be undone.`}
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

export default PostView
