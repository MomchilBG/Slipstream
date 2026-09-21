import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ConfirmDialog from './ConfirmDialog'

describe('ConfirmDialog', () => {
  it('calls onConfirm/onCancel from their respective buttons', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    const onCancel = vi.fn()

    render(<ConfirmDialog title="Delete post" confirmLabel="Delete" danger onConfirm={onConfirm} onCancel={onCancel} />)

    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('dismisses via a backdrop click when not confirming', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()

    const { container } = render(<ConfirmDialog title="Delete post" confirmLabel="Delete" onConfirm={vi.fn()} onCancel={onCancel} />)

    await user.click(container.querySelector('.modal-overlay')!)
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('ignores a backdrop click while confirming is in flight', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()

    const { container } = render(<ConfirmDialog title="Delete post" confirmLabel="Delete" confirming onConfirm={vi.fn()} onCancel={onCancel} />)

    await user.click(container.querySelector('.modal-overlay')!)
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('shows the confirming label and disables both buttons while confirming', () => {
    render(<ConfirmDialog title="Delete post" confirmLabel="Delete" confirming onConfirm={vi.fn()} onCancel={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Delete…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
  })

  it('hides the Cancel button when hideCancel is set', () => {
    render(<ConfirmDialog title="Saved" confirmLabel="OK" hideCancel onConfirm={vi.fn()} onCancel={vi.fn()} />)

    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument()
  })

  it('shows an inline error message when given one', () => {
    render(<ConfirmDialog title="Delete post" confirmLabel="Delete" error="Something went wrong" onConfirm={vi.fn()} onCancel={vi.fn()} />)

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
  })
})
