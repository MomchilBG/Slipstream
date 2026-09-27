import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import type { SupabaseMock } from '../../test/mockSupabase'
import { supabase } from '../../lib/supabaseClient'
import Login from './Login'

vi.mock('../../lib/supabaseClient', async () => {
  const { createSupabaseMock } = await import('../../test/mockSupabase')
  return { supabase: createSupabaseMock() }
})

const supabaseMock = supabase as unknown as SupabaseMock

beforeEach(() => {
  supabaseMock.rpc.mockReset()
  supabaseMock.auth.signInWithPassword.mockReset().mockResolvedValue({ data: {}, error: null })
})

const LocationProbe = () => {
  const location = useLocation()
  return <div data-testid="location">{location.pathname}</div>
}

const renderLogin = () =>
  render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  )

describe('Login', () => {
  it('shows a validation error when submitted empty', async () => {
    const user = userEvent.setup()
    renderLogin()

    await user.click(screen.getByRole('button', { name: 'Log in' }))

    expect(screen.getByText('Enter your username or email and password.')).toBeInTheDocument()
    expect(supabaseMock.auth.signInWithPassword).not.toHaveBeenCalled()
  })

  it('resolves a username identifier to its email before signing in', async () => {
    const user = userEvent.setup()
    supabaseMock.rpc.mockReturnValue(Promise.resolve({ data: 'alex@example.com', error: null }))
    renderLogin()

    await user.type(screen.getByLabelText('Username or email'), 'alexr')
    await user.type(screen.getByLabelText('Password'), 'hunter2')
    await user.click(screen.getByRole('button', { name: 'Log in' }))

    expect(supabaseMock.rpc).toHaveBeenCalledWith('email_for_username', { p_username: 'alexr' })
    expect(supabaseMock.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'alex@example.com', password: 'hunter2' })
    expect(await screen.findByTestId('location')).toHaveTextContent('/')
  })

  it('skips the username lookup for an email identifier', async () => {
    const user = userEvent.setup()
    renderLogin()

    await user.type(screen.getByLabelText('Username or email'), 'alex@example.com')
    await user.type(screen.getByLabelText('Password'), 'hunter2')
    await user.click(screen.getByRole('button', { name: 'Log in' }))

    expect(supabaseMock.rpc).not.toHaveBeenCalled()
    expect(supabaseMock.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'alex@example.com', password: 'hunter2' })
  })

  it('shows an invalid-credentials error when the username cannot be resolved', async () => {
    const user = userEvent.setup()
    supabaseMock.rpc.mockReturnValue(Promise.resolve({ data: null, error: { message: 'not found' } }))
    renderLogin()

    await user.type(screen.getByLabelText('Username or email'), 'ghost')
    await user.type(screen.getByLabelText('Password'), 'hunter2')
    await user.click(screen.getByRole('button', { name: 'Log in' }))

    expect(await screen.findByText('Invalid username/email or password.')).toBeInTheDocument()
    expect(supabaseMock.auth.signInWithPassword).not.toHaveBeenCalled()
  })

  it('shows an invalid-credentials error when sign-in itself fails', async () => {
    const user = userEvent.setup()
    supabaseMock.auth.signInWithPassword.mockResolvedValue({ data: {}, error: { message: 'Invalid login credentials' } })
    renderLogin()

    await user.type(screen.getByLabelText('Username or email'), 'alex@example.com')
    await user.type(screen.getByLabelText('Password'), 'wrong')
    await user.click(screen.getByRole('button', { name: 'Log in' }))

    expect(await screen.findByText('Invalid username/email or password.')).toBeInTheDocument()
  })
})
