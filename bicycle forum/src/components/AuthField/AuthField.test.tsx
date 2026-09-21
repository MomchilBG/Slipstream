import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import AuthField from './AuthField'

describe('AuthField', () => {
  it('renders the label and children', () => {
    render(
      <AuthField htmlFor="username" label="Username">
        <input id="username" />
      </AuthField>,
    )

    expect(screen.getByLabelText('Username')).toBeInTheDocument()
  })

  it('shows a required mark only when required', () => {
    const { rerender } = render(
      <AuthField htmlFor="username" label="Username" required>
        <input id="username" />
      </AuthField>,
    )
    expect(screen.getByText('*')).toBeInTheDocument()

    rerender(
      <AuthField htmlFor="username" label="Username">
        <input id="username" />
      </AuthField>,
    )
    expect(screen.queryByText('*')).not.toBeInTheDocument()
  })

  it('renders an error message when given one', () => {
    render(
      <AuthField htmlFor="username" label="Username" error="Username is required">
        <input id="username" />
      </AuthField>,
    )

    expect(screen.getByText('Username is required')).toBeInTheDocument()
  })

  it('renders no error text when none is given', () => {
    render(
      <AuthField htmlFor="username" label="Username">
        <input id="username" />
      </AuthField>,
    )

    expect(screen.queryByText(/required/)).not.toBeInTheDocument()
  })
})
