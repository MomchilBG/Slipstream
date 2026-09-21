import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders, makeSignedInAuthValue, makeProfile } from '../../test/testUtils'
import Navbar from './Navbar'

describe('Navbar', () => {
  it('shows Log in/Register and hides Browse/New post when signed out', () => {
    renderWithProviders(<Navbar />)

    expect(screen.getByRole('link', { name: 'Log in' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Register' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Browse' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'New post' })).not.toBeInTheDocument()
  })

  it('shows Browse/New post and the avatar link when signed in, but not Admin for a plain user', () => {
    renderWithProviders(<Navbar />, { authValue: makeSignedInAuthValue() })

    expect(screen.getByRole('link', { name: 'Browse' })).toHaveAttribute('href', '/posts')
    expect(screen.getByRole('link', { name: 'New post' })).toBeInTheDocument()
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

  it('toggles the mobile menu open and closed', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Navbar />)

    const toggle = screen.getByRole('button', { name: 'Open menu' })
    await user.click(toggle)
    expect(screen.getByRole('button', { name: 'Close menu' })).toBeInTheDocument()
  })
})
