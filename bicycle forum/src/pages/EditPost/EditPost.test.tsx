import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { AuthContext } from '../../auth/AuthContext'
import { makeSignedInAuthValue, makeProfile } from '../../test/testUtils'
import { getPostForEdit, updatePost } from '../../lib/posts'
import { replacePostTags } from '../../lib/tags'
import EditPost from './EditPost'

vi.mock('../../lib/posts', () => ({ getPostForEdit: vi.fn(), updatePost: vi.fn() }))
vi.mock('../../lib/tags', () => ({ replacePostTags: vi.fn() }))
vi.mock('../../lib/postImages', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/postImages')>()
  return { ...actual, replacePostImages: vi.fn(), uploadPostImage: vi.fn() }
})

const getPostForEditMock = vi.mocked(getPostForEdit)
const updatePostMock = vi.mocked(updatePost)
const replacePostTagsMock = vi.mocked(replacePostTags)

const editablePost = {
  title: 'Original title',
  content: 'Original content that is long enough.',
  authorId: 'user-1',
  tags: ['gravel'],
  images: [],
}

beforeEach(() => {
  getPostForEditMock.mockReset().mockResolvedValue(editablePost)
  updatePostMock.mockReset().mockResolvedValue({ error: null } as never)
  replacePostTagsMock.mockReset().mockResolvedValue({ error: null })
})

const LocationProbe = () => {
  const location = useLocation()
  return <div data-testid="location">{location.pathname}</div>
}

const renderEditPost = (authValue = makeSignedInAuthValue()) =>
  render(
    <MemoryRouter initialEntries={['/posts/p1/edit']}>
      <AuthContext.Provider value={authValue}>
        <Routes>
          <Route path="/posts/:id/edit" element={<EditPost />} />
          <Route path="/posts/:id" element={<LocationProbe />} />
        </Routes>
      </AuthContext.Provider>
    </MemoryRouter>,
  )

describe('EditPost', () => {
  it('shows a loading placeholder while the post fetch is in flight', () => {
    getPostForEditMock.mockReturnValue(new Promise(() => {}))
    renderEditPost()

    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('shows a not-found message when the post does not exist', async () => {
    getPostForEditMock.mockResolvedValue(null)
    renderEditPost()

    expect(await screen.findByText("This post doesn't exist.")).toBeInTheDocument()
  })

  it("refuses to edit another author's post", async () => {
    renderEditPost(makeSignedInAuthValue({ profile: makeProfile({ id: 'someone-else' }) }))

    expect(await screen.findByText('You can only edit your own posts.')).toBeInTheDocument()
  })

  it('shows a blocked notice instead of the form for a blocked user', async () => {
    renderEditPost(makeSignedInAuthValue({ profile: makeProfile({ id: 'user-1', is_blocked: true }) }))

    expect(await screen.findByText('Your account has been blocked from editing posts.')).toBeInTheDocument()
  })

  it('pre-fills the form and saves changes, then navigates back to the post', async () => {
    const user = userEvent.setup()
    renderEditPost()

    const titleInput = await screen.findByDisplayValue('Original title')
    await user.clear(titleInput)
    await user.type(titleInput, 'Updated title')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(updatePostMock).toHaveBeenCalledWith('p1', 'Updated title', 'Original content that is long enough.')
    expect(replacePostTagsMock).toHaveBeenCalledWith('p1', ['gravel'])
    expect(await screen.findByTestId('location')).toHaveTextContent('/posts/p1')
  })

  it('shows the server error and does not navigate when the update fails', async () => {
    const user = userEvent.setup()
    updatePostMock.mockResolvedValue({ error: { message: 'permission denied' } } as never)
    renderEditPost()

    await screen.findByDisplayValue('Original title')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByText('permission denied')).toBeInTheDocument()
    expect(screen.queryByTestId('location')).not.toBeInTheDocument()
  })

  it('renders a Cancel link back to the post', async () => {
    renderEditPost()

    expect(await screen.findByRole('link', { name: 'Cancel' })).toHaveAttribute('href', '/posts/p1')
  })
})
