import type { ComponentProps } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import PostForm from './PostForm'

const renderForm = (onSubmit = vi.fn(async (): Promise<{ error: string | null }> => ({ error: null })), props: Partial<ComponentProps<typeof PostForm>> = {}) => {
  render(
    <PostForm heading="New post" submitLabel="Create Post" submittingLabel="Creating…" onSubmit={onSubmit} {...props} />,
    { wrapper: MemoryRouter },
  )
  return { onSubmit }
}

describe('PostForm', () => {
  it('rejects a title shorter than 4 characters without calling onSubmit', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderForm()

    await user.type(screen.getByLabelText(/Title/), 'Hi')
    await user.type(screen.getByLabelText(/Content/), 'This content is long enough.')
    await user.click(screen.getByRole('button', { name: 'Create Post' }))

    expect(screen.getByText('Title must be 4-64 characters.')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('rejects content shorter than 16 characters', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderForm()

    await user.type(screen.getByLabelText(/Title/), 'A good title')
    await user.type(screen.getByLabelText(/Content/), 'too short')
    await user.click(screen.getByRole('button', { name: 'Create Post' }))

    expect(screen.getByText('Content must be 16-8192 characters.')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits trimmed title/content plus tags on success', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn(async () => ({ error: null }))
    renderForm(onSubmit)

    await user.type(screen.getByLabelText(/Title/), '  A great ride  ')
    await user.type(screen.getByLabelText(/Content/), 'Rode 60km on gravel today, great weather.')
    await user.type(screen.getByLabelText('Tags'), 'gravel')
    await user.click(screen.getByRole('button', { name: 'Add tag' }))
    await user.click(screen.getByRole('button', { name: 'Create Post' }))

    expect(onSubmit).toHaveBeenCalledWith(
      'A great ride',
      'Rode 60km on gravel today, great weather.',
      ['gravel'],
      { keepUrls: [], newFiles: [] },
    )
  })

  it('adds a tag on Enter and removes it via its remove button', async () => {
    const user = userEvent.setup()
    renderForm()

    const tagInput = screen.getByLabelText('Tags')
    await user.type(tagInput, 'gravel{Enter}')
    expect(screen.getByText('gravel')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Remove tag gravel' }))
    expect(screen.queryByText('gravel')).not.toBeInTheDocument()
  })

  it('rejects a duplicate tag', async () => {
    const user = userEvent.setup()
    renderForm()

    const tagInput = screen.getByLabelText('Tags')
    await user.type(tagInput, 'gravel{Enter}')
    await user.type(tagInput, 'gravel{Enter}')

    expect(screen.getByText('That tag is already added.')).toBeInTheDocument()
  })

  it('normalizes underscores/extra spaces in a typed tag to single spaces', async () => {
    const user = userEvent.setup()
    renderForm()

    await user.type(screen.getByLabelText('Tags'), 'mountain_biking{Enter}')

    expect(screen.getByText('mountain biking')).toBeInTheDocument()
  })

  it('shows the server-side error returned by onSubmit', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn(async () => ({ error: 'Something went wrong creating your post.' }))
    renderForm(onSubmit)

    await user.type(screen.getByLabelText(/Title/), 'A good title')
    await user.type(screen.getByLabelText(/Content/), 'This content is long enough to pass.')
    await user.click(screen.getByRole('button', { name: 'Create Post' }))

    expect(await screen.findByText('Something went wrong creating your post.')).toBeInTheDocument()
  })

  it('renders a Cancel link only when cancelHref is given', () => {
    renderForm(vi.fn(), { cancelHref: '/posts/p1' })

    expect(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute('href', '/posts/p1')
  })
})
