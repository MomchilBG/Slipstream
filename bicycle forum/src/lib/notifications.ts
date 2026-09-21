import { supabase } from './supabaseClient'
import { getPublicProfiles } from './publicProfiles'

export type NotificationType = 'comment_on_post' | 'reply_to_comment' | 'mention'

export interface NotificationItem {
  id: string
  type: NotificationType
  postId: string
  commentId: string
  actorUsername: string
  isRead: boolean
  createdAt: string
}

interface NotificationRow {
  id: string
  type: string
  post_id: string
  comment_id: string
  actor_id: string
  is_read: boolean
  created_at: string
}

// Newest-first, capped - a notification bell is a recent-activity glance,
// not a full archive, so there's no pagination beyond this first page.
const NOTIFICATIONS_LIMIT = 30

export const getNotifications = async (userId: string): Promise<NotificationItem[]> => {
  const { data: rows, error } = await supabase
    .from('notifications')
    .select('id, type, post_id, comment_id, actor_id, is_read, created_at')
    .eq('recipient_id', userId)
    .order('created_at', { ascending: false })
    .limit(NOTIFICATIONS_LIMIT)

  if (error || !rows || rows.length === 0) return []

  // Actor display names aren't stored on the notification row itself (only
  // actor_id) - batch-resolve them the same way posts/comments resolve
  // author usernames, rather than embedding a denormalized copy that could
  // go stale if the actor later renames... usernames are immutable, but
  // this still avoids duplicating profiles.username onto every row.
  const actorIds = [...new Set(rows.map((row) => row.actor_id))]
  const profiles = await getPublicProfiles(actorIds)

  return (rows as NotificationRow[]).map((row) => ({
    id: row.id,
    type: row.type as NotificationType,
    postId: row.post_id,
    commentId: row.comment_id,
    actorUsername: profiles.get(row.actor_id)?.username ?? 'someone',
    isRead: row.is_read,
    createdAt: row.created_at,
  }))
}

export const getUnreadNotificationCount = async (userId: string): Promise<number> => {
  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_id', userId)
    .eq('is_read', false)
  return count ?? 0
}

export const markNotificationRead = (notificationId: string) =>
  supabase.from('notifications').update({ is_read: true }).eq('id', notificationId)

// Short enough to comfortably fit the bell dropdown's own width (sized for
// roughly 7-10 words per line) without wrapping onto a third line.
export const describeNotification = (notification: NotificationItem): string => {
  switch (notification.type) {
    case 'comment_on_post':
      return `${notification.actorUsername} commented on your post`
    case 'reply_to_comment':
      return `${notification.actorUsername} replied to your comment`
    case 'mention':
      return `${notification.actorUsername} mentioned you in a comment`
  }
}

// Every notification type points at the comment that produced it - the new
// top-level comment itself, the reply, or the comment containing the
// mention - so this one link shape covers all three.
export const notificationHref = (notification: NotificationItem): string =>
  `/posts/${notification.postId}#comment-${notification.commentId}`
