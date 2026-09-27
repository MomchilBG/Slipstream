import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { getUserProfileByUsername } from '../../lib/userProfile'
import type { UserProfilePage as UserProfileData } from '../../lib/userProfile'
import { getSavedPostCount, getSavedPostsByUser } from '../../lib/savedPosts'
import type { PostSummary } from '../../lib/posts'
import PostSummaryCard from '../../components/PostSummaryCard/PostSummaryCard'
import { formatDate, formatDateTime } from '../../lib/formatDate'
import { formatFullName } from '../../lib/formatName'
import { roleLabel } from '../../lib/publicProfiles'
import { computeBadgeProgress } from '../../lib/badges'
import type { BadgeCriteriaType } from '../../lib/badges'
import '../profileShared.css'
import './UserProfile.css'

const BADGE_CATEGORY_LABELS: Record<BadgeCriteriaType, string> = {
  post_count: 'Posts',
  comment_count: 'Comments',
  reputation: 'Reputation',
  tenure_days: 'Tenure',
}

// Fixed display order, independent of whatever order badges come back in.
const BADGE_CATEGORY_ORDER: BadgeCriteriaType[] = ['post_count', 'comment_count', 'reputation', 'tenure_days']

const UserProfile = () => {
  const { username } = useParams<{ username: string }>()
  if (!username) return null
  // Keyed on the username so navigating between profiles remounts this
  // (and resets all of its fetch state) instead of needing to reset it in an effect.
  return <UserProfileForUsername key={username} username={username} />
}

const UserProfileForUsername = ({ username }: { username: string }) => {
  const { profile: viewerProfile } = useAuth()
  const [data, setData] = useState<UserProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  // Computed once when the profile loads rather than inline during render,
  // which would call the impure Date.now() on every render.
  const [tenureDays, setTenureDays] = useState(0)

  const [postsTab, setPostsTab] = useState<'posts' | 'saved'>('posts')
  const [savedCount, setSavedCount] = useState(0)
  const [savedPosts, setSavedPosts] = useState<PostSummary[] | null>(null)
  const [loadingSaved, setLoadingSaved] = useState(false)

  const isOwnProfile = viewerProfile?.id === data?.id

  useEffect(() => {
    let cancelled = false

    getUserProfileByUsername(username).then((result) => {
      if (cancelled) return
      setData(result)
      setNotFound(!result)
      setLoading(false)
      if (result) setTenureDays(Math.floor((Date.now() - new Date(result.createdAt).getTime()) / (1000 * 60 * 60 * 24)))
    })

    return () => {
      cancelled = true
    }
  }, [username])

  // The saved-posts count is its own (cheap) query, and only meaningful -
  // and visible - to the profile's own owner, so it's gated on that rather
  // than fetched unconditionally.
  useEffect(() => {
    if (!data || !isOwnProfile) return
    let cancelled = false

    getSavedPostCount(data.id).then((count) => {
      if (!cancelled) setSavedCount(count)
    })

    return () => {
      cancelled = true
    }
  }, [data, isOwnProfile])

  if (loading) {
    return (
      <section id="user-profile-page">
        <p>Loading…</p>
      </section>
    )
  }

  if (notFound || !data) {
    return (
      <section id="user-profile-page">
        <p>This user doesn&apos;t exist.</p>
      </section>
    )
  }

  const showSavedTab = async () => {
    setPostsTab('saved')
    if (savedPosts !== null || loadingSaved) return
    setLoadingSaved(true)
    const posts = await getSavedPostsByUser(data.id)
    setSavedPosts(posts)
    setLoadingSaved(false)
  }

  const statsItems = [
    { label: 'Reputation', value: data.reputation },
    { label: 'Posts', value: data.postCount },
    ...(isOwnProfile ? [{ label: 'Saved', value: savedCount }] : []),
    { label: 'Comments made', value: data.commentsMade },
    { label: 'Comments earned', value: data.commentsEarned },
  ]

  const currentByCategory: Record<BadgeCriteriaType, number> = {
    post_count: data.postCount,
    comment_count: data.commentsMade,
    reputation: data.reputation,
    tenure_days: tenureDays,
  }
  const badgeProgress = BADGE_CATEGORY_ORDER.map((criteriaType) =>
    computeBadgeProgress(criteriaType, currentByCategory[criteriaType], data.allBadges),
  )
  const statsMid = Math.ceil(statsItems.length / 2)
  const statsColumns = [statsItems.slice(0, statsMid), statsItems.slice(statsMid)]

  const visiblePosts = postsTab === 'posts' ? data.posts : savedPosts

  return (
    <section id="user-profile-page">
      <div id="user-profile-header">
        <div id="user-profile-avatar-column">
          <div id="user-profile-avatar">
            {data.avatarUrl ? (
              <img src={data.avatarUrl} alt="" />
            ) : (
              <span id="user-profile-avatar-fallback">{data.username.slice(0, 1).toUpperCase()}</span>
            )}
          </div>
        </div>
        <div id="user-profile-identity">
          <h1>{data.username}</h1>
          <p id="user-profile-subtitle">
            <span>
              {formatFullName(data.firstName, data.lastName)} · Joined {formatDate(data.createdAt)}
            </span>
            <span className={`badge-pill role-pill role-${data.role}`}>{roleLabel(data.role)}</span>
            {data.isBlocked && <span className="badge-pill blocked-pill">Blocked</span>}
          </p>
        </div>
        {isOwnProfile && (
          <Link to="/profile" className="button primary" id="user-profile-edit-link">
            Edit your profile
          </Link>
        )}
      </div>

      <div className="profile-grid-2">
        <div className="profile-left-column">
          <div className="profile-bio profile-box">
            <h2>About</h2>
            {data.bio ? (
              <p className="profile-bio-text">{data.bio}</p>
            ) : isOwnProfile ? (
              <p className="profile-subtitle">
                You haven&apos;t added a bio yet. <Link to="/profile">Add one</Link>.
              </p>
            ) : (
              <p className="profile-subtitle">{data.username} hasn&apos;t added a bio yet.</p>
            )}
          </div>

          <div className="profile-stats profile-box">
            <h2>Stats</h2>
            <div className="profile-stats-columns">
              {statsColumns.map((column, columnIndex) => (
                <div className="profile-stats-column" key={columnIndex}>
                  {column.map((item) => (
                    <div className="profile-stat-row" key={item.label}>
                      <span className="profile-stat-label">{item.label}</span>
                      <span className="profile-stat-value">{item.value}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="profile-badges profile-box">
          <h2>Badges</h2>
          {data.badges.length > 0 && (
            <ul>
              {data.badges.map((badge) => (
                <li key={badge.id} title={badge.description}>
                  <span className="badge-pill">{badge.name}</span>
                  <span className="user-badge-date">Earned {formatDateTime(badge.awardedAt)}</span>
                </li>
              ))}
            </ul>
          )}

          <ul className="badge-progress-list">
            {badgeProgress.map((progress) => (
              <li key={progress.criteriaType} className="badge-progress-row">
                <div className="badge-progress-heading">
                  <span className="badge-progress-label">{BADGE_CATEGORY_LABELS[progress.criteriaType]}</span>
                  <span className="badge-progress-status">
                    {progress.nextBadge
                      ? `${progress.current} / ${progress.nextBadge.threshold} to "${progress.nextBadge.name}"`
                      : progress.earnedTopBadge
                        ? `"${progress.earnedTopBadge.name}" - max level reached`
                        : `${progress.current}`}
                  </span>
                </div>
                <div className="badge-progress-track">
                  <div className="badge-progress-fill" style={{ width: `${progress.percent}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div id="user-profile-posts" className="profile-box">
        <div id="user-profile-posts-header">
          <h2>{postsTab === 'posts' ? 'Created posts' : 'Saved posts'}</h2>
          {isOwnProfile && (
            <div id="user-profile-posts-tabs">
              <button type="button" className={postsTab === 'posts' ? 'active' : undefined} onClick={() => setPostsTab('posts')}>
                Posts
              </button>
              <button type="button" className={postsTab === 'saved' ? 'active' : undefined} onClick={() => void showSavedTab()}>
                Saved
              </button>
            </div>
          )}
        </div>

        {postsTab === 'saved' && loadingSaved ? (
          <p>Loading…</p>
        ) : visiblePosts === null || visiblePosts.length === 0 ? (
          <p>
            {postsTab === 'posts'
              ? `${data.username} hasn't created any posts yet.`
              : "You haven't saved any posts yet."}
          </p>
        ) : (
          <ul>
            {visiblePosts.map((post) => (
              <PostSummaryCard key={post.id} post={post} />
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

export default UserProfile
