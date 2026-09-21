import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PasswordInput from './PasswordInput'

describe('PasswordInput', () => {
  it('starts masked and toggles to visible text on click', async () => {
    const user = userEvent.setup()
    render(<PasswordInput id="password" value="secret123" onChange={vi.fn()} />)

    const input = screen.getByDisplayValue('secret123')
    expect(input).toHaveAttribute('type', 'password')

    await user.click(screen.getByRole('button', { name: 'Show password' }))
    expect(input).toHaveAttribute('type', 'text')

    await user.click(screen.getByRole('button', { name: 'Hide password' }))
    expect(input).toHaveAttribute('type', 'password')
  })

  it('calls onChange as the user types', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const { container } = render(<PasswordInput id="password" value="" onChange={onChange} />)

    await user.type(container.querySelector('#password')!, 'a')

    expect(onChange).toHaveBeenCalled()
  })
})
