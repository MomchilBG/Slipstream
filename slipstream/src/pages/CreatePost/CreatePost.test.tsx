import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { AuthContext } from '../../auth/AuthContext'
import { makeSignedInAuthValue, makeProfile } from '../../test/testUtils'
import { createPost } from '../../lib/posts'
import { attachTagsToPost } from '../../lib/tags'
import CreatePost from './CreatePost'

vi.mock('../../lib/posts', () => ({ createPost: vi.fn() }))
vi.mock('../../lib/tags', () => ({ attachTagsToPost: vi.fn() }))
vi.mock('../../lib/postImages', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/postImages')>()
  return { ...actual, replacePostImages: vi.fn(), uploadPostImage: vi.fn() }
})

const createPostMock = vi.mocked(createPost)
const attachTagsToPostMock = vi.mocked(attachTagsToPost)

beforeEach(() => {
  createPostMock.mockReset().mockResolvedValue({ data: { id: 'new-post' }, error: null } as never)
  attachTagsToPostMock.mockReset().mockResolvedValue({ error: null })
})

const LocationProbe = () => {
  const location = useLocation()
  return <div data-testid="location">{location.pathname}</div>
}

const renderCreatePost = (authValue = makeSignedInAuthValue()) =>
  render(
    <MemoryRouter initialEntries={['/posts/new']}>
      <AuthContext.Provider value={authValue}>
        <Routes>
          <Route path="/posts/new" element={<CreatePost />} />
          <Route path="/posts/:id" element={<LocationProbe />} />
        </Routes>
      </AuthContext.Provider>
    </MemoryRouter>,
  )

describe('CreatePost', () => {
  it('shows a loading placeholder while the profile has not resolved yet', () => {
    renderCreatePost(makeSignedInAuthValue({ profile: null }))

    expect(screen.getByText('Loading…')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Create Post' })).not.toBeInTheDocument()
  })

  it('shows a blocked notice instead of the form for a blocked user', () => {
    renderCreatePost(makeSignedInAuthValue({ profile: makeProfile({ is_blocked: true }) }))

    expect(screen.getByText('Your account has been blocked from posting.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Create Post' })).not.toBeInTheDocument()
  })

  it('creates the post, attaches tags, and navigates to the new post', async () => {
    const user = userEvent.setup()
    renderCreatePost()

    await user.type(screen.getByLabelText(/Title/), 'A great gravel ride')
    await user.type(screen.getByLabelText(/Content/), 'Rode 60km today, weather was perfect for it.')
    await user.type(screen.getByLabelText('Tags'), 'gravel{Enter}')
    await user.click(screen.getByRole('button', { name: 'Create Post' }))

    expect(await screen.findByTestId('location')).toHaveTextContent('/posts/new-post')
    expect(createPostMock).toHaveBeenCalledWith('user-1', 'A great gravel ride', 'Rode 60km today, weather was perfect for it.')
    expect(attachTagsToPostMock).toHaveBeenCalledWith('new-post', ['gravel'])
  })

  it('shows an error and does not navigate when post creation fails', async () => {
    const user = userEvent.setup()
    createPostMock.mockResolvedValue({ data: null, error: { message: 'insert failed' } } as never)
    renderCreatePost()

    await user.type(screen.getByLabelText(/Title/), 'A great gravel ride')
    await user.type(screen.getByLabelText(/Content/), 'Rode 60km today, weather was perfect for it.')
    await user.click(screen.getByRole('button', { name: 'Create Post' }))

    expect(await screen.findByText('insert failed')).toBeInTheDocument()
    expect(screen.queryByTestId('location')).not.toBeInTheDocument()
  })

  it('reports a partial success when the post is created but tags fail to save', async () => {
    const user = userEvent.setup()
    attachTagsToPostMock.mockResolvedValue({ error: 'db down' })
    renderCreatePost()

    await user.type(screen.getByLabelText(/Title/), 'A great gravel ride')
    await user.type(screen.getByLabelText(/Content/), 'Rode 60km today, weather was perfect for it.')
    await user.type(screen.getByLabelText('Tags'), 'gravel{Enter}')
    await user.click(screen.getByRole('button', { name: 'Create Post' }))

    expect(await screen.findByText('Post created, but tags failed to save: db down')).toBeInTheDocument()
  })
})
