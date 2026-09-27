import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import type { SupabaseMock } from '../../test/mockSupabase'
import { supabase } from '../../lib/supabaseClient'
import Register from './Register'

vi.mock('../../lib/supabaseClient', async () => {
  const { createSupabaseMock } = await import('../../test/mockSupabase')
  return { supabase: createSupabaseMock() }
})

const supabaseMock = supabase as unknown as SupabaseMock

beforeEach(() => {
  supabaseMock.rpc.mockReset().mockReturnValue(Promise.resolve({ data: false, error: null }))
  supabaseMock.auth.signUp.mockReset().mockResolvedValue({ data: { session: null }, error: null })
})

const LocationProbe = () => {
  const location = useLocation()
  return <div data-testid="location">{location.pathname}</div>
}

const renderRegister = () =>
  render(
    <MemoryRouter initialEntries={['/register']}>
      <Routes>
        <Route path="/register" element={<Register />} />
        <Route path="/" element={<LocationProbe />} />
        <Route path="/login" element={<div data-testid="location">/login</div>} />
      </Routes>
    </MemoryRouter>,
  )

const fillValidForm = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByLabelText(/First name/), 'Alex')
  await user.type(screen.getByLabelText(/Username/), 'alexr')
  await user.type(screen.getByLabelText(/Email/), 'alex@example.com')
  await user.type(screen.getByLabelText('Password *'), 'password123')
  await user.type(screen.getByLabelText('Confirm password *'), 'password123')
}

describe('Register', () => {
  it('shows field errors and blocks submission for invalid input', async () => {
    const user = userEvent.setup()
    renderRegister()

    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(screen.getByText('First name must be 4-32 characters.')).toBeInTheDocument()
    expect(supabaseMock.auth.signUp).not.toHaveBeenCalled()
  })

  it('flags mismatched password confirmation', async () => {
    const user = userEvent.setup()
    renderRegister()

    await fillValidForm(user)
    await user.clear(screen.getByLabelText('Confirm password *'))
    await user.type(screen.getByLabelText('Confirm password *'), 'different')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(screen.getByText('Passwords do not match.')).toBeInTheDocument()
    expect(supabaseMock.auth.signUp).not.toHaveBeenCalled()
  })

  it('checks username availability before signing up, and blocks submission if taken', async () => {
    const user = userEvent.setup()
    supabaseMock.rpc.mockReturnValue(Promise.resolve({ data: true, error: null }))
    renderRegister()

    await fillValidForm(user)
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(supabaseMock.rpc).toHaveBeenCalledWith('is_username_taken', { p_username: 'alexr' })
    expect(await screen.findByText('This username is already taken.')).toBeInTheDocument()
    expect(supabaseMock.auth.signUp).not.toHaveBeenCalled()
  })

  it('signs up and navigates home when a session comes back immediately', async () => {
    const user = userEvent.setup()
    supabaseMock.auth.signUp.mockResolvedValue({ data: { session: { access_token: 'x' } }, error: null })
    renderRegister()

    await fillValidForm(user)
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByTestId('location')).toHaveTextContent('/')
  })

  it('shows a "check your email" dialog when signup succeeds without a session', async () => {
    const user = userEvent.setup()
    renderRegister()

    await fillValidForm(user)
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByText('Check your email')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Go to log in' }))
    expect(await screen.findByTestId('location')).toHaveTextContent('/login')
  })

  it('shows a friendly message when the email is already registered', async () => {
    const user = userEvent.setup()
    supabaseMock.auth.signUp.mockResolvedValue({ data: { session: null }, error: { message: 'User already registered' } })
    renderRegister()

    await fillValidForm(user)
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByText('This email is already registered.')).toBeInTheDocument()
  })
})
