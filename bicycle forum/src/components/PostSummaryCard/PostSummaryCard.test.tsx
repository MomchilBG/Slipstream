import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import PostSummaryCard from './PostSummaryCard'
import type { PostSummary } from '../../lib/posts'

const post: PostSummary = {
  id: 'p1',
  title: 'Tubeless setup tips',
  author: 'alexr',
  commentCount: 3,
  createdAt: '2024-01-01T00:00:00.000Z',
}

describe('PostSummaryCard', () => {
  it('links the title to the post and the author to their profile', () => {
    render(<PostSummaryCard post={post} />, { wrapper: MemoryRouter })

    expect(screen.getByRole('link', { name: 'Tubeless setup tips' })).toHaveAttribute('href', '/posts/p1')
    expect(screen.getByRole('link', { name: 'alexr' })).toHaveAttribute('href', '/users/alexr')
  })

  it('omits the score when the post has none', () => {
    render(<PostSummaryCard post={post} />, { wrapper: MemoryRouter })

    expect(screen.queryByText(/score/)).not.toBeInTheDocument()
  })

  it('shows the score when present', () => {
    render(<PostSummaryCard post={{ ...post, score: 7 }} />, { wrapper: MemoryRouter })

    expect(screen.getByText(/7 score/)).toBeInTheDocument()
  })
})
