import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders, makeSignedInAuthValue, makeProfile } from '../../test/testUtils'
import { getUnreadNotificationCount } from '../../lib/notifications'
import Navbar from './Navbar'

vi.mock('../../lib/notifications', () => ({
  getUnreadNotificationCount: vi.fn(),
  getNotifications: vi.fn(),
  markNotificationRead: vi.fn(),
  describeNotification: vi.fn(),
  notificationHref: vi.fn(),
}))

const getUnreadNotificationCountMock = vi.mocked(getUnreadNotificationCount)

beforeEach(() => {
  getUnreadNotificationCountMock.mockReset().mockResolvedValue(0)
})

describe('Navbar', () => {
  it('shows the logo as the home link, with no brand text beside it', () => {
    renderWithProviders(<Navbar />)

    const homeLink = screen.getByRole('link', { name: 'Slipstream' })
    expect(homeLink).toHaveAttribute('href', '/')
    expect(homeLink.querySelector('img')).toHaveAttribute('src', '/favicon.svg')
    expect(homeLink).not.toHaveTextContent('Slipstream')
  })

  it('shows Log in/Register and hides Browse/New post when signed out', () => {
    renderWithProviders(<Navbar />)

    expect(screen.getByRole('link', { name: 'Log in' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Register' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Browse' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'New post' })).not.toBeInTheDocument()
  })

  it('hides the notification bell when signed out', () => {
    renderWithProviders(<Navbar />)

    expect(screen.queryByRole('button', { name: /Notifications/ })).not.toBeInTheDocument()
  })

  it('shows Browse/New post, the notification bell, and the avatar link when signed in, but not Admin for a plain user', () => {
    renderWithProviders(<Navbar />, { authValue: makeSignedInAuthValue() })

    expect(screen.getByRole('link', { name: 'Browse' })).toHaveAttribute('href', '/posts')
    expect(screen.getByRole('link', { name: 'New post' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Your profile' })).toHaveAttribute('href', '/users/alexr')
    expect(screen.queryByRole('link', { name: 'Admin' })).not.toBeInTheDocument()
  })

  it('hides New post for a blocked user', () => {
    renderWithProviders(<Navbar />, { authValue: makeSignedInAuthValue({ profile: makeProfile({ is_blocked: true }) }) })

    expect(screen.queryByRole('link', { name: 'New post' })).not.toBeInTheDocument()
  })

  it('shows the Admin link for an admin profile', () => {
    renderWithProviders(<Navbar />, { authValue: makeSignedInAuthValue({ profile: makeProfile({ role: 'admin' }) }) })

    expect(screen.getByRole('link', { name: 'Admin' })).toBeInTheDocument()
  })

  it('opens the menu drawer, focuses its close button, and closes it again', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Navbar />)

    const toggle = screen.getByRole('button', { name: 'Open menu' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(document.getElementById('nav-menu')).toHaveClass('open')

    const close = screen.getByRole('button', { name: 'Close menu' })
    expect(close).toHaveFocus()
    await user.click(close)
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(document.getElementById('nav-menu')).not.toHaveClass('open')
  })

  it('closes the drawer on Escape, on a backdrop click, and when a link is followed', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Navbar />, { authValue: makeSignedInAuthValue() })
    const toggle = screen.getByRole('button', { name: 'Open menu' })

    await user.click(toggle)
    await user.keyboard('{Escape}')
    expect(toggle).toHaveAttribute('aria-expanded', 'false')

    await user.click(toggle)
    await user.click(document.getElementById('nav-backdrop')!)
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(document.getElementById('nav-backdrop')).not.toBeInTheDocument()

    await user.click(toggle)
    await user.click(screen.getByRole('link', { name: 'Browse' }))
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
  })

  it('gives the drawer a Home link and an icon next to each nav link', () => {
    renderWithProviders(<Navbar />, { authValue: makeSignedInAuthValue() })

    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/')
    for (const name of ['Home', 'Browse', 'New post']) {
      expect(screen.getByRole('link', { name }).querySelector('svg.nav-icon')).toBeInTheDocument()
    }
  })
})
