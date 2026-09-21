import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthContext } from '../../auth/AuthContext'
import { makeAuthValue, makeSignedInAuthValue, makeProfile } from '../../test/testUtils'
import { getUserProfileByUsername } from '../../lib/userProfile'
import type { UserProfilePage as UserProfileData } from '../../lib/userProfile'
import { getSavedPostCount, getSavedPostsByUser } from '../../lib/savedPosts'
import UserProfile from './UserProfile'

vi.mock('../../lib/userProfile', () => ({ getUserProfileByUsername: vi.fn() }))
vi.mock('../../lib/savedPosts', () => ({ getSavedPostCount: vi.fn(), getSavedPostsByUser: vi.fn() }))

const getUserProfileByUsernameMock = vi.mocked(getUserProfileByUsername)
const getSavedPostCountMock = vi.mocked(getSavedPostCount)
const getSavedPostsByUserMock = vi.mocked(getSavedPostsByUser)

const makeUserProfileData = (overrides: Partial<UserProfileData> = {}): UserProfileData => ({
  id: 'u1',
  username: 'alexr',
  firstName: 'Alex',
  lastName: 'Rivera',
  avatarUrl: null,
  bio: null,
  reputation: 42,
  role: 'user',
  isBlocked: false,
  createdAt: '2023-01-01T00:00:00.000Z',
  postCount: 2,
  commentsMade: 3,
  commentsEarned: 5,
  badges: [],
  allBadges: [],
  posts: [{ id: 'p1', title: 'A gravel ride', author: 'alexr', commentCount: 5, createdAt: '2024-01-01T00:00:00.000Z' }],
  ...overrides,
})

beforeEach(() => {
  getUserProfileByUsernameMock.mockReset().mockResolvedValue(makeUserProfileData())
  getSavedPostCountMock.mockReset().mockResolvedValue(0)
  getSavedPostsByUserMock.mockReset().mockResolvedValue([])
})

const renderUserProfile = (authValue = makeAuthValue(), route = '/users/alexr') =>
  render(
    <MemoryRouter initialEntries={[route]}>
      <AuthContext.Provider value={authValue}>
        <Routes>
          <Route path="/users/:username" element={<UserProfile />} />
        </Routes>
      </AuthContext.Provider>
    </MemoryRouter>,
  )

describe('UserProfile', () => {
  it('shows a not-found message for a missing user', async () => {
    getUserProfileByUsernameMock.mockResolvedValue(null)
    renderUserProfile()

    expect(await screen.findByText("This user doesn't exist.")).toBeInTheDocument()
  })

  it("renders the user's identity, stats, and posts", async () => {
    renderUserProfile()

    expect(await screen.findByRole('heading', { name: 'alexr' })).toBeInTheDocument()
    expect(screen.getByText('42', { selector: '.profile-stat-value' })).toBeInTheDocument()
    expect(screen.getByText('A gravel ride')).toBeInTheDocument()
  })

  it('does not show an edit link or tabs for someone else\'s profile', async () => {
    renderUserProfile(makeSignedInAuthValue({ profile: makeProfile({ id: 'someone-else' }) }))

    await screen.findByRole('heading', { name: 'alexr' })
    expect(screen.queryByRole('link', { name: 'Edit your profile' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Saved' })).not.toBeInTheDocument()
  })

  it('shows an edit link and Posts/Saved tabs for your own profile', async () => {
    renderUserProfile(makeSignedInAuthValue({ profile: makeProfile({ id: 'u1', username: 'alexr' }) }))

    expect(await screen.findByRole('link', { name: 'Edit your profile' })).toHaveAttribute('href', '/profile')
    expect(screen.getByRole('button', { name: 'Saved' })).toBeInTheDocument()
  })

  it('lazily loads the Saved tab on first click and caches it', async () => {
    const user = userEvent.setup()
    getSavedPostsByUserMock.mockResolvedValue([{ id: 'p2', title: 'Saved post', author: 'someone', commentCount: 0, createdAt: '2024-01-01T00:00:00.000Z' }])
    renderUserProfile(makeSignedInAuthValue({ profile: makeProfile({ id: 'u1', username: 'alexr' }) }))

    await screen.findByText('A gravel ride')
    await user.click(screen.getByRole('button', { name: 'Saved' }))

    expect(await screen.findByText('Saved post')).toBeInTheDocument()
    expect(getSavedPostsByUserMock).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: 'Posts' }))
    await user.click(screen.getByRole('button', { name: 'Saved' }))
    expect(getSavedPostsByUserMock).toHaveBeenCalledTimes(1)
  })

  it('shows a prompt to add a bio only on your own profile', async () => {
    renderUserProfile(makeSignedInAuthValue({ profile: makeProfile({ id: 'u1', username: 'alexr' }) }))

    expect(await screen.findByRole('link', { name: 'Add one' })).toHaveAttribute('href', '/profile')
  })

  it("shows the user's bio text when set", async () => {
    getUserProfileByUsernameMock.mockResolvedValue(makeUserProfileData({ bio: 'I love long gravel climbs.' }))
    renderUserProfile()

    expect(await screen.findByText('I love long gravel climbs.')).toBeInTheDocument()
  })

  it('shows empty-state copy when the user has no posts yet', async () => {
    getUserProfileByUsernameMock.mockResolvedValue(makeUserProfileData({ posts: [], postCount: 0 }))
    renderUserProfile()

    expect(await screen.findByText("alexr hasn't created any posts yet.")).toBeInTheDocument()
  })
})
