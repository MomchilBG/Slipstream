import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../test/testUtils'
import { searchPosts, searchUsers } from '../../lib/search'
import PostsBrowse from './PostsBrowse'

vi.mock('../../lib/search', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/search')>()
  return { ...actual, searchPosts: vi.fn(), searchUsers: vi.fn() }
})

const searchPostsMock = vi.mocked(searchPosts)
const searchUsersMock = vi.mocked(searchUsers)

beforeEach(() => {
  searchPostsMock.mockReset().mockResolvedValue({ posts: [], totalCount: 0 })
  searchUsersMock.mockReset().mockResolvedValue([])
})

describe('PostsBrowse', () => {
  it('shows "Browse posts" with no query', async () => {
    renderWithProviders(<PostsBrowse />, { route: '/posts' })

    expect(await screen.findByRole('heading', { name: 'Browse posts' })).toBeInTheDocument()
    expect(searchPostsMock).toHaveBeenCalledWith({ words: [], tags: [], users: [] }, 'recent', 0)
  })

  it('runs a posts search and renders results', async () => {
    searchPostsMock.mockResolvedValue({
      posts: [{ id: 'p1', title: 'Tubeless setup', author: 'alexr', commentCount: 2, createdAt: '2024-01-01T00:00:00.000Z', score: 4 }],
      totalCount: 1,
    })
    renderWithProviders(<PostsBrowse />, { route: '/posts?q=tubeless' })

    expect(await screen.findByText('Tubeless setup')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Results for "tubeless"' })).toBeInTheDocument()
  })

  it('shows a "Load more" button and fetches the next page', async () => {
    const user = userEvent.setup()
    searchPostsMock.mockResolvedValueOnce({
      posts: [{ id: 'p1', title: 'First page post', author: 'alexr', commentCount: 0, createdAt: '2024-01-01T00:00:00.000Z' }],
      totalCount: 2,
    })
    renderWithProviders(<PostsBrowse />, { route: '/posts' })

    await screen.findByText('First page post')
    searchPostsMock.mockResolvedValueOnce({
      posts: [{ id: 'p2', title: 'Second page post', author: 'alexr', commentCount: 0, createdAt: '2024-01-01T00:00:00.000Z' }],
      totalCount: 2,
    })

    await user.click(screen.getByRole('button', { name: 'Load more (1 left)' }))

    expect(await screen.findByText('Second page post')).toBeInTheDocument()
    expect(searchPostsMock).toHaveBeenLastCalledWith({ words: [], tags: [], users: [] }, 'recent', 1)
  })

  it('renders a users search as user cards, not posts', async () => {
    searchUsersMock.mockResolvedValue([{ id: 'u1', username: 'alexr', firstName: 'Alex', lastName: null, avatarUrl: null, reputation: 12, role: 'user', isBlocked: false }])
    renderWithProviders(<PostsBrowse />, { route: '/posts?q=u%2Falexr' })

    expect(await screen.findByRole('heading', { name: 'User results for "alexr"' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /alexr/ })).toHaveAttribute('href', '/users/alexr')
    expect(searchPostsMock).not.toHaveBeenCalled()
  })

  it('shows empty-state copy when nothing matches', async () => {
    renderWithProviders(<PostsBrowse />, { route: '/posts?q=nonexistent' })

    expect(await screen.findByText('No posts match your search.')).toBeInTheDocument()
  })
})
