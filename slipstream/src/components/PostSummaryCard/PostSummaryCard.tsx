import { Link } from 'react-router-dom'
import type { PostSummary } from '../../lib/posts'
import { formatDateTime } from '../../lib/formatDate'
import './PostSummaryCard.css'

const PostSummaryCard = ({ post }: { post: PostSummary }) => (
  <li className="post-summary-card">
    <Link to={`/posts/${post.id}`} className="post-title">
      {post.title}
    </Link>
    <span className="post-meta">
      by <Link to={`/users/${post.author}`}>{post.author}</Link> · {post.commentCount} comments
      {post.score !== undefined && ` · ${post.score} score`} · {formatDateTime(post.createdAt)}
    </span>
  </li>
)

export default PostSummaryCard
