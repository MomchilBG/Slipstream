import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { renderWithProviders, makeAuthValue, makeSignedInAuthValue } from '../../test/testUtils'
import RequireAuth from './RequireAuth'

const renderGuarded = (authValue: ReturnType<typeof makeAuthValue>) =>
  renderWithProviders(
    <Routes>
      <Route element={<RequireAuth />}>
        <Route path="/" element={<p>Protected content</p>} />
      </Route>
      <Route path="/login" element={<p>Login page</p>} />
    </Routes>,
    { authValue },
  )

describe('RequireAuth', () => {
  it('renders nothing while the initial session check is loading', () => {
    renderGuarded(makeAuthValue({ loading: true }))

    expect(screen.queryByText('Protected content')).not.toBeInTheDocument()
    expect(screen.queryByText('Login page')).not.toBeInTheDocument()
  })

  it('redirects to /login when there is no session', () => {
    renderGuarded(makeAuthValue({ loading: false, session: null }))

    expect(screen.getByText('Login page')).toBeInTheDocument()
  })

  it('renders the protected route when signed in', () => {
    renderGuarded(makeSignedInAuthValue())

    expect(screen.getByText('Protected content')).toBeInTheDocument()
  })
})
