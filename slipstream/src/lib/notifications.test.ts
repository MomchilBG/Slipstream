import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockQuery } from '../test/mockSupabase'
import type { SupabaseMock } from '../test/mockSupabase'
import { supabase } from './supabaseClient'
import {
  describeNotification,
  getNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  notificationHref,
} from './notifications'
import type { NotificationItem } from './notifications'

vi.mock('./supabaseClient', async () => {
  const { createSupabaseMock } = await import('../test/mockSupabase')
  return { supabase: createSupabaseMock() }
})

const supabaseMock = supabase as unknown as SupabaseMock

beforeEach(() => {
  supabaseMock.from.mockReset()
  supabaseMock.rpc.mockReset()
})

describe('getNotifications', () => {
  it('maps notification rows and resolves actor usernames via the batched public profiles', async () => {
    supabaseMock.from.mockImplementation((table: string) => {
      if (table === 'notifications') {
        return mockQuery([
          { id: 'n1', type: 'reply_to_comment', post_id: 'p1', comment_id: 'c2', actor_id: 'u2', is_read: false, created_at: '2024-02-01T00:00:00.000Z' },
        ])
      }
      throw new Error(`unexpected table ${table}`)
    })
    supabaseMock.rpc.mockReturnValue(mockQuery([{ id: 'u2', username: 'bob', first_name: 'Bob', last_name: null, avatar_url: null, reputation: 0, role: 'user', is_blocked: false }]))

    const result = await getNotifications('u1')

    expect(result).toEqual([
      { id: 'n1', type: 'reply_to_comment', postId: 'p1', commentId: 'c2', actorUsername: 'bob', isRead: false, createdAt: '2024-02-01T00:00:00.000Z' },
    ])
  })

  it('falls back to "someone" when the actor profile cannot be resolved', async () => {
    supabaseMock.from.mockReturnValue(mockQuery([
      { id: 'n1', type: 'mention', post_id: 'p1', comment_id: 'c2', actor_id: 'ghost', is_read: true, created_at: '2024-02-01T00:00:00.000Z' },
    ]))
    supabaseMock.rpc.mockReturnValue(mockQuery([]))

    const result = await getNotifications('u1')

    expect(result[0].actorUsername).toBe('someone')
  })

  it('returns an empty list when the query errors or is empty', async () => {
    supabaseMock.from.mockReturnValue(mockQuery(null, { message: 'boom' }))

    expect(await getNotifications('u1')).toEqual([])
    expect(supabaseMock.rpc).not.toHaveBeenCalled()
  })
})

describe('getUnreadNotificationCount', () => {
  it('returns the unread count, defaulting to 0', async () => {
    supabaseMock.from.mockReturnValue(mockQuery(null, null, 3))

    expect(await getUnreadNotificationCount('u1')).toBe(3)
  })

  it('defaults to 0 when count is null', async () => {
    supabaseMock.from.mockReturnValue(mockQuery(null, null, null))

    expect(await getUnreadNotificationCount('u1')).toBe(0)
  })
})

describe('markNotificationRead', () => {
  it('updates is_read on the notifications row', async () => {
    supabaseMock.from.mockReturnValue(mockQuery(null))

    await markNotificationRead('n1')

    expect(supabaseMock.from).toHaveBeenCalledWith('notifications')
  })
})

const makeNotification = (overrides: Partial<NotificationItem> = {}): NotificationItem => ({
  id: 'n1',
  type: 'comment_on_post',
  postId: 'p1',
  commentId: 'c1',
  actorUsername: 'alexr',
  isRead: false,
  createdAt: '2024-01-01T00:00:00.000Z',
  ...overrides,
})

describe('describeNotification', () => {
  it('describes a top-level comment notification', () => {
    expect(describeNotification(makeNotification({ type: 'comment_on_post' }))).toBe('alexr commented on your post')
  })

  it('describes a reply notification', () => {
    expect(describeNotification(makeNotification({ type: 'reply_to_comment' }))).toBe('alexr replied to your comment')
  })

  it('describes a mention notification', () => {
    expect(describeNotification(makeNotification({ type: 'mention' }))).toBe('alexr mentioned you in a comment')
  })
})

describe('notificationHref', () => {
  it('links to the post with a #comment-<id> hash', () => {
    expect(notificationHref(makeNotification({ postId: 'p1', commentId: 'c9' }))).toBe('/posts/p1#comment-c9')
  })
})
