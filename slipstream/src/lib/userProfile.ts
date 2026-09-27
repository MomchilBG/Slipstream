import { supabase } from './supabaseClient'
import { getPostsByAuthor } from './posts'
import type { PostSummary } from './posts'
import { getAllBadges } from './badges'
import type { BadgeDefinition } from './badges'

export interface UserBadge {
  id: string
  code: string
  name: string
  description: string
  awardedAt: string
}

export interface UserProfilePage {
  id: string
  username: string
  firstName: string
  lastName: string | null
  avatarUrl: string | null
  bio: string | null
  reputation: number
  role: 'user' | 'admin'
  isBlocked: boolean
  createdAt: string
  postCount: number
  commentsMade: number
  commentsEarned: number
  badges: UserBadge[]
  allBadges: BadgeDefinition[]
  posts: PostSummary[]
}

// Excludes soft-deleted comments, matching check_and_award_badges()'s own
// comment_count - otherwise this would count comments the badge system
// itself no longer does, throwing off the comment-count progress bar.
export const getCommentCountForUser = async (userId: string): Promise<number> => {
  const { count } = await supabase
    .from('comments')
    .select('id', { count: 'exact', head: true })
    .eq('author_id', userId)
    .eq('is_deleted', false)
  return count ?? 0
}

// Mirrors the join-in-app-code pattern getBadgesForUsers() in postDetail.ts
// uses, but for a single user and including each badge's award date.
export const getBadgesForUser = async (userId: string): Promise<UserBadge[]> => {
  const { data: rows } = await supabase
    .from('user_badges')
    .select('badge_id, awarded_at')
    .eq('user_id', userId)
    .order('awarded_at', { ascending: true })

  if (!rows || rows.length === 0) return []

  const badgeIds = rows.map((row) => row.badge_id)
  const { data: badgeRows } = await supabase.from('badges').select('id, code, name, description').in('id', badgeIds)
  const badgeById = new Map((badgeRows ?? []).map((badge) => [badge.id, badge]))

  return rows
    .map((row) => {
      const badge = badgeById.get(row.badge_id)
      return badge ? { ...badge, awardedAt: row.awarded_at } : null
    })
    .filter((badge): badge is UserBadge => badge !== null)
}

export const getUserProfileByUsername = async (username: string): Promise<UserProfilePage | null> => {
  const { data: profileRow } = await supabase.rpc('public_profiles').eq('username', username.toLowerCase()).maybeSingle()
  if (!profileRow) return null

  const [posts, commentsMade, badges, allBadges] = await Promise.all([
    getPostsByAuthor(profileRow.id, profileRow.username),
    getCommentCountForUser(profileRow.id),
    getBadgesForUser(profileRow.id),
    getAllBadges(),
  ])

  // "Comments earned" is how many comments this user's own posts have
  // received - just the sum of the per-post counts we already fetched, so
  // it doesn't need its own round trip.
  const commentsEarned = posts.reduce((total, post) => total + post.commentCount, 0)

  return {
    id: profileRow.id,
    username: profileRow.username,
    firstName: profileRow.first_name,
    lastName: profileRow.last_name,
    avatarUrl: profileRow.avatar_url,
    bio: profileRow.bio,
    reputation: profileRow.reputation,
    role: profileRow.role,
    isBlocked: profileRow.is_blocked,
    createdAt: profileRow.created_at,
    postCount: posts.length,
    commentsMade,
    commentsEarned,
    badges,
    allBadges,
    posts,
  }
}
