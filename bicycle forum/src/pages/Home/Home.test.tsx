import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders, makeAuthValue, makeSignedInAuthValue } from '../../test/testUtils'
import { getMostCommentedPosts, getMostRecentPosts, getPlatformStats } from '../../lib/posts'
import Home from './Home'

vi.mock('../../lib/posts', () => ({
  getPlatformStats: vi.fn(),
  getMostCommentedPosts: vi.fn(),
  getMostRecentPosts: vi.fn(),
}))

const getPlatformStatsMock = vi.mocked(getPlatformStats)
const getMostCommentedPostsMock = vi.mocked(getMostCommentedPosts)
const getMostRecentPostsMock = vi.mocked(getMostRecentPosts)

beforeEach(() => {
  getPlatformStatsMock.mockReset().mockResolvedValue({ userCount: 128, postCount: 42 })
  getMostCommentedPostsMock.mockReset().mockResolvedValue([])
  getMostRecentPostsMock.mockReset().mockResolvedValue([])
})

describe('Home', () => {
  it('shows a loading state before the fetches resolve', () => {
    getPlatformStatsMock.mockReturnValue(new Promise(() => {}))
    renderWithProviders(<Home />)

    expect(screen.getAllByText('Loading…')).toHaveLength(2)
  })

  it('renders platform stats and empty-state copy once loaded', async () => {
    renderWithProviders(<Home />)

    await waitFor(() => expect(screen.getByText('128')).toBeInTheDocument())
    expect(screen.getByText('42')).toBeInTheDocument()
    expect(screen.getAllByText('No posts yet — be the first to create one.')).toHaveLength(2)
  })

  it('renders fetched posts in each list', async () => {
    getMostCommentedPostsMock.mockResolvedValue([
      { id: 'p1', title: 'Most commented post', author: 'alexr', commentCount: 9, createdAt: '2024-01-01T00:00:00.000Z' },
    ])
    getMostRecentPostsMock.mockResolvedValue([
      { id: 'p2', title: 'Most recent post', author: 'alexr', commentCount: 0, createdAt: '2024-02-01T00:00:00.000Z' },
    ])
    renderWithProviders(<Home />)

    expect(await screen.findByText('Most commented post')).toBeInTheDocument()
    expect(screen.getByText('Most recent post')).toBeInTheDocument()
  })

  it('shows the join/log-in CTAs when signed out', async () => {
    renderWithProviders(<Home />, { authValue: makeAuthValue() })

    await waitFor(() => expect(screen.getByText('128')).toBeInTheDocument())
    expect(screen.getByRole('link', { name: 'Join the forum' })).toBeInTheDocument()
  })

  it('hides the join/log-in CTAs when signed in', async () => {
    renderWithProviders(<Home />, { authValue: makeSignedInAuthValue() })

    await waitFor(() => expect(screen.getByText('128')).toBeInTheDocument())
    expect(screen.queryByRole('link', { name: 'Join the forum' })).not.toBeInTheDocument()
  })
})
