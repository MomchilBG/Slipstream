import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes, useLocation } from 'react-router-dom'
import { renderWithProviders, makeAuthValue, makeSignedInAuthValue } from '../../test/testUtils'
import { getNotifications, getUnreadNotificationCount, markNotificationRead } from '../../lib/notifications'
import type { NotificationItem } from '../../lib/notifications'
import NotificationBell from './NotificationBell'

vi.mock('../../lib/notifications', () => ({
  getNotifications: vi.fn(),
  getUnreadNotificationCount: vi.fn(),
  markNotificationRead: vi.fn(),
  describeNotification: vi.fn((notification: NotificationItem) => `${notification.actorUsername} did something`),
  notificationHref: vi.fn((notification: NotificationItem) => `/posts/${notification.postId}#comment-${notification.commentId}`),
}))

const getNotificationsMock = vi.mocked(getNotifications)
const getUnreadNotificationCountMock = vi.mocked(getUnreadNotificationCount)
const markNotificationReadMock = vi.mocked(markNotificationRead)

const notification: NotificationItem = {
  id: 'n1',
  type: 'reply_to_comment',
  postId: 'p1',
  commentId: 'c1',
  actorUsername: 'alexr',
  isRead: false,
  createdAt: '2024-01-01T00:00:00.000Z',
}

beforeEach(() => {
  getNotificationsMock.mockReset().mockResolvedValue([])
  getUnreadNotificationCountMock.mockReset().mockResolvedValue(0)
  markNotificationReadMock.mockReset().mockResolvedValue({ error: null } as never)
})

const LocationProbe = () => {
  const location = useLocation()
  return <div data-testid="location">{location.pathname}{location.hash}</div>
}

describe('NotificationBell', () => {
  it('renders nothing when signed out', () => {
    renderWithProviders(<NotificationBell />, { authValue: makeAuthValue() })

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('shows an unread badge reflecting the unread count', async () => {
    getUnreadNotificationCountMock.mockResolvedValue(3)
    renderWithProviders(<NotificationBell />, { authValue: makeSignedInAuthValue() })

    expect(await screen.findByText('3')).toBeInTheDocument()
  })

  it('caps the badge at "9+"', async () => {
    getUnreadNotificationCountMock.mockResolvedValue(12)
    renderWithProviders(<NotificationBell />, { authValue: makeSignedInAuthValue() })

    expect(await screen.findByText('9+')).toBeInTheDocument()
  })

  it('hides the badge when there are no unread notifications', async () => {
    renderWithProviders(<NotificationBell />, { authValue: makeSignedInAuthValue() })

    await screen.findByRole('button', { name: 'Notifications' })
    expect(document.getElementById('notification-bell-badge')).not.toBeInTheDocument()
  })

  it('lazily fetches and shows the notification list on first open', async () => {
    const user = userEvent.setup()
    getNotificationsMock.mockResolvedValue([notification])
    renderWithProviders(<NotificationBell />, { authValue: makeSignedInAuthValue() })

    await user.click(screen.getByRole('button', { name: /Notifications/ }))

    expect(await screen.findByText('alexr did something')).toBeInTheDocument()
    expect(getNotificationsMock).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: /Notifications/ }))
    await user.click(screen.getByRole('button', { name: /Notifications/ }))
    expect(getNotificationsMock).toHaveBeenCalledTimes(1)
  })

  it('shows empty-state copy when there are no notifications', async () => {
    const user = userEvent.setup()
    renderWithProviders(<NotificationBell />, { authValue: makeSignedInAuthValue() })

    await user.click(screen.getByRole('button', { name: /Notifications/ }))

    expect(await screen.findByText('No notifications yet.')).toBeInTheDocument()
  })

  it('marks a notification read and navigates to it on click', async () => {
    const user = userEvent.setup()
    getNotificationsMock.mockResolvedValue([notification])
    renderWithProviders(
      <Routes>
        <Route path="/" element={<NotificationBell />} />
        <Route path="/posts/:id" element={<LocationProbe />} />
      </Routes>,
      { authValue: makeSignedInAuthValue() },
    )

    await user.click(screen.getByRole('button', { name: /Notifications/ }))
    await user.click(await screen.findByText('alexr did something'))

    expect(markNotificationReadMock).toHaveBeenCalledWith('n1')
    expect(await screen.findByTestId('location')).toHaveTextContent('/posts/p1#comment-c1')
  })

  it('does not call markNotificationRead again for an already-read notification', async () => {
    const user = userEvent.setup()
    getNotificationsMock.mockResolvedValue([{ ...notification, isRead: true }])
    renderWithProviders(
      <Routes>
        <Route path="/" element={<NotificationBell />} />
        <Route path="/posts/:id" element={<LocationProbe />} />
      </Routes>,
      { authValue: makeSignedInAuthValue() },
    )

    await user.click(screen.getByRole('button', { name: 'Notifications' }))
    await user.click(await screen.findByText('alexr did something'))

    expect(markNotificationReadMock).not.toHaveBeenCalled()
  })

  it('closes the dropdown on Escape', async () => {
    const user = userEvent.setup()
    renderWithProviders(<NotificationBell />, { authValue: makeSignedInAuthValue() })

    await user.click(screen.getByRole('button', { name: /Notifications/ }))
    expect(screen.getByRole('menu')).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
})
