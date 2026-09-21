import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import {
  describeNotification,
  getNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  notificationHref,
} from '../../lib/notifications'
import type { NotificationItem } from '../../lib/notifications'
import './NotificationBell.css'

const NotificationBell = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<NotificationItem[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!user) return
    let cancelled = false

    getUnreadNotificationCount(user.id).then((count) => {
      if (!cancelled) setUnreadCount(count)
    })

    return () => {
      cancelled = true
    }
  }, [user])

  // Same outside-click/Escape-to-close pattern as SearchBar's mode picker.
  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  const toggleOpen = () => {
    setOpen((current) => {
      const next = !current
      // Lazily fetched on first open (and cached in state after), same as
      // the public profile page's own Saved-posts tab.
      if (next && notifications === null && user) {
        setLoading(true)
        getNotifications(user.id).then((result) => {
          setNotifications(result)
          setLoading(false)
        })
      }
      return next
    })
  }

  const setNotificationReadState = (notificationId: string, isRead: boolean) => {
    setNotifications((current) =>
      current?.map((item) => (item.id === notificationId ? { ...item, isRead } : item)) ?? current,
    )
  }

  const handleSelect = async (notification: NotificationItem) => {
    setOpen(false)

    if (!notification.isRead) {
      setUnreadCount((current) => Math.max(current - 1, 0))
      setNotificationReadState(notification.id, true)

      const { error } = await markNotificationRead(notification.id)
      if (error) {
        // The DB update failed - undo the optimistic changes above so the
        // cached list and badge don't drift out of sync with what's
        // actually stored (a silently-discarded error here would otherwise
        // leave this notification looking read for the rest of the session).
        setUnreadCount((current) => current + 1)
        setNotificationReadState(notification.id, false)
      }
    }

    navigate(notificationHref(notification))
  }

  if (!user) return null

  return (
    <div id="notification-bell" ref={containerRef}>
      <button
        type="button"
        id="notification-bell-trigger"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : 'Notifications'}
        onClick={toggleOpen}
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && <span id="notification-bell-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
      </button>

      {open && (
        <div id="notification-bell-menu" role="menu" aria-label="Notifications">
          {loading ? (
            <p className="notification-empty">Loading…</p>
          ) : !notifications || notifications.length === 0 ? (
            <p className="notification-empty">No notifications yet.</p>
          ) : (
            <ul>
              {notifications.map((notification) => (
                <li key={notification.id}>
                  <button
                    type="button"
                    className={notification.isRead ? 'notification-item' : 'notification-item unread'}
                    onClick={() => void handleSelect(notification)}
                  >
                    {describeNotification(notification)}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

export default NotificationBell
