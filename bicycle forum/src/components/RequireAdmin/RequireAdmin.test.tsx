import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { renderWithProviders, makeAuthValue, makeSignedInAuthValue, makeProfile } from '../../test/testUtils'
import RequireAdmin from './RequireAdmin'

const renderGuarded = (authValue: ReturnType<typeof makeAuthValue>) =>
  renderWithProviders(
    <Routes>
      <Route element={<RequireAdmin />}>
        <Route path="/admin/users" element={<p>Admin content</p>} />
      </Route>
      <Route path="/login" element={<p>Login page</p>} />
      <Route path="/" element={<p>Home page</p>} />
    </Routes>,
    { authValue, route: '/admin/users' },
  )

describe('RequireAdmin', () => {
  it('renders nothing while the session is loading', () => {
    renderGuarded(makeAuthValue({ loading: true }))

    expect(screen.queryByText(/content|page/)).not.toBeInTheDocument()
  })

  it('redirects to /login when signed out', () => {
    renderGuarded(makeAuthValue({ loading: false, session: null }))

    expect(screen.getByText('Login page')).toBeInTheDocument()
  })

  it('renders nothing while the profile fetch is still in flight (not yet "not an admin")', () => {
    renderGuarded(makeSignedInAuthValue({ profile: null, profileLoading: true }))

    expect(screen.queryByText(/content|page/)).not.toBeInTheDocument()
  })

  it('redirects home once the profile resolves and is not an admin', () => {
    renderGuarded(makeSignedInAuthValue({ profile: makeProfile({ role: 'user' }) }))

    expect(screen.getByText('Home page')).toBeInTheDocument()
  })

  it('redirects home when the profile fetch resolved to null', () => {
    renderGuarded(makeSignedInAuthValue({ profile: null, profileLoading: false }))

    expect(screen.getByText('Home page')).toBeInTheDocument()
  })

  it('renders the admin route for an admin profile', () => {
    renderGuarded(makeSignedInAuthValue({ profile: makeProfile({ role: 'admin' }) }))

    expect(screen.getByText('Admin content')).toBeInTheDocument()
  })
})
