import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { AuthContext } from '../../auth/AuthContext'
import { makeSignedInAuthValue, makeAuthValue, makeProfile } from '../../test/testUtils'
import { castVote, createComment, deleteComment, getComments, getPostDetail, updateComment } from '../../lib/postDetail'
import type { CommentItem, PostDetail } from '../../lib/postDetail'
import { deletePost } from '../../lib/posts'
import { savePost, unsavePost } from '../../lib/savedPosts'
import PostView from './PostView'

vi.mock('../../lib/postDetail', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/postDetail')>()
  return {
    ...actual,
    getPostDetail: vi.fn(),
    getComments: vi.fn(),
    createComment: vi.fn(),
    updateComment: vi.fn(),
    deleteComment: vi.fn(),
    castVote: vi.fn(),
  }
})
vi.mock('../../lib/posts', () => ({ deletePost: vi.fn() }))
vi.mock('../../lib/savedPosts', () => ({ savePost: vi.fn(), unsavePost: vi.fn() }))

const getPostDetailMock = vi.mocked(getPostDetail)
const getCommentsMock = vi.mocked(getComments)
const createCommentMock = vi.mocked(createComment)
const updateCommentMock = vi.mocked(updateComment)
const deleteCommentMock = vi.mocked(deleteComment)
const castVoteMock = vi.mocked(castVote)
const deletePostMock = vi.mocked(deletePost)
const savePostMock = vi.mocked(savePost)
const unsavePostMock = vi.mocked(unsavePost)

const author = {
  id: 'author-1',
  username: 'alexr',
  firstName: 'Alex',
  lastName: 'Rivera',
  avatarUrl: null,
  reputation: 5,
  role: 'user' as const,
  isBlocked: false,
}

const makePostDetail = (overrides: Partial<PostDetail> = {}): PostDetail => ({
  id: 'p1',
  title: 'Tubeless setup tips',
  content: 'Here is how I set mine up.',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  upvoteCount: 5,
  downvoteCount: 1,
  images: [],
  author,
  authorBadges: [],
  tags: ['gravel'],
  myVote: null,
  isSaved: false,
  ...overrides,
})

const makeComment = (overrides: Partial<CommentItem> = {}): CommentItem => ({
  id: 'c1',
  content: 'Nice writeup!',
  createdAt: '2024-01-01T01:00:00.000Z',
  updatedAt: '2024-01-01T01:00:00.000Z',
  author: { ...author, id: 'commenter-1', username: 'commenter' },
  badges: [],
  parentCommentId: null,
  isDeleted: false,
  ...overrides,
})

beforeEach(() => {
  getPostDetailMock.mockReset().mockResolvedValue(makePostDetail())
  getCommentsMock.mockReset().mockResolvedValue([])
  createCommentMock.mockReset().mockResolvedValue({ error: null } as never)
  updateCommentMock.mockReset().mockResolvedValue({ error: null } as never)
  deleteCommentMock.mockReset().mockResolvedValue({ error: null })
  castVoteMock.mockReset().mockResolvedValue({ error: null } as never)
  deletePostMock.mockReset().mockResolvedValue({ error: null })
  savePostMock.mockReset().mockResolvedValue({ error: null } as never)
  unsavePostMock.mockReset().mockResolvedValue({ error: null } as never)
})

const LocationProbe = () => {
  const location = useLocation()
  return <div data-testid="location">{location.pathname}</div>
}

const renderPostView = (authValue = makeSignedInAuthValue({ profile: makeProfile({ id: 'viewer-1', username: 'viewer' }) })) =>
  render(
    <MemoryRouter initialEntries={['/posts/p1']}>
      <AuthContext.Provider value={authValue}>
        <Routes>
          <Route path="/posts/:id" element={<PostView />} />
          <Route path="/users/:username" element={<LocationProbe />} />
        </Routes>
      </AuthContext.Provider>
    </MemoryRouter>,
  )

describe('PostView', () => {
  it('shows a loading state, then not-found copy for a missing post', async () => {
    getPostDetailMock.mockResolvedValue(null)
    renderPostView()

    expect(screen.getByText('Loading…')).toBeInTheDocument()
    expect(await screen.findByText("This post doesn't exist.")).toBeInTheDocument()
  })

  it('renders the post, its tags, and author info', async () => {
    renderPostView()

    expect(await screen.findByText('Tubeless setup tips')).toBeInTheDocument()
    expect(screen.getByText('gravel')).toBeInTheDocument()
    expect(screen.getByText('@alexr')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument() // upvotes - downvotes
  })

  it('prompts signed-out visitors to log in instead of showing vote/comment controls', async () => {
    renderPostView(makeAuthValue())

    await screen.findByText('Tubeless setup tips')
    expect(screen.getByText('Log in to vote.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Log in' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Upvote' })).toBeDisabled()
  })

  it("disables voting on the viewer's own post", async () => {
    renderPostView(makeSignedInAuthValue({ profile: makeProfile({ id: 'author-1', username: 'alexr' }) }))

    await screen.findByText('Tubeless setup tips')
    expect(screen.getByRole('button', { name: 'Upvote' })).toBeDisabled()
    expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/posts/p1/edit')
  })

  it('casts an upvote and refreshes the post', async () => {
    const user = userEvent.setup()
    renderPostView()
    await screen.findByText('Tubeless setup tips')

    getPostDetailMock.mockResolvedValue(makePostDetail({ myVote: 1, upvoteCount: 6 }))
    await user.click(screen.getByRole('button', { name: 'Upvote' }))

    expect(castVoteMock).toHaveBeenCalledWith('p1', 'viewer-1', 1)
    expect(await screen.findByText('5')).toBeInTheDocument()
  })

  it('toggles the save/bookmark button', async () => {
    const user = userEvent.setup()
    renderPostView()
    await screen.findByText('Tubeless setup tips')

    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(savePostMock).toHaveBeenCalledWith('viewer-1', 'p1')
    expect(await screen.findByRole('button', { name: 'Saved' })).toBeInTheDocument()
  })

  it('submits a top-level comment and clears the composer', async () => {
    const user = userEvent.setup()
    getCommentsMock.mockResolvedValueOnce([]).mockResolvedValueOnce([makeComment()])
    renderPostView()
    await screen.findByText('Tubeless setup tips')

    const textarea = screen.getByPlaceholderText('Write a comment…')
    await user.type(textarea, 'Great post!')
    await user.click(screen.getByRole('button', { name: 'Comment' }))

    expect(createCommentMock).toHaveBeenCalledWith('p1', 'viewer-1', 'Great post!')
    expect(await screen.findByText('Nice writeup!')).toBeInTheDocument()
    expect(textarea).toHaveValue('')
  })

  it('replies to a top-level comment', async () => {
    const user = userEvent.setup()
    getCommentsMock.mockResolvedValue([makeComment()])
    renderPostView()
    await screen.findByText('Nice writeup!')

    await user.click(screen.getByRole('button', { name: 'Reply' }))
    const replyForm = screen.getByPlaceholderText('Reply to commenter…').closest<HTMLFormElement>('.reply-form')!
    await user.type(within(replyForm).getByPlaceholderText('Reply to commenter…'), 'Thanks!')
    await user.click(within(replyForm).getByRole('button', { name: 'Reply' }))

    expect(createCommentMock).toHaveBeenCalledWith('p1', 'viewer-1', 'Thanks!', 'c1')
  })

  it("lets a comment's own author edit it inline", async () => {
    const user = userEvent.setup()
    getCommentsMock.mockResolvedValue([makeComment({ author: { ...author, id: 'viewer-1', username: 'viewer' } })])
    renderPostView()
    await screen.findByText('Nice writeup!')

    await user.click(screen.getByRole('button', { name: 'Edit' }))
    const editForm = document.querySelector<HTMLFormElement>('.comment-edit-form')!
    const editBox = within(editForm).getByRole('textbox')
    await user.clear(editBox)
    await user.type(editBox, 'Updated comment text')
    await user.click(within(editForm).getByRole('button', { name: 'Save' }))

    expect(updateCommentMock).toHaveBeenCalledWith('c1', 'Updated comment text')
  })

  it('deletes a comment through the confirm dialog', async () => {
    const user = userEvent.setup()
    getCommentsMock.mockResolvedValue([makeComment({ author: { ...author, id: 'viewer-1', username: 'viewer' } })])
    renderPostView()
    await screen.findByText('Nice writeup!')

    await user.click(screen.getByRole('button', { name: 'Delete' }))
    const dialog = screen.getByText('Delete comment').closest<HTMLElement>('.modal-card')!
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))

    expect(deleteCommentMock).toHaveBeenCalledWith('c1')
    expect(await screen.findByText('[deleted]')).toBeInTheDocument()
  })

  it('deletes the post through the confirm dialog and navigates to the author profile', async () => {
    const user = userEvent.setup()
    renderPostView(makeSignedInAuthValue({ profile: makeProfile({ id: 'author-1', username: 'alexr' }) }))
    await screen.findByText('Tubeless setup tips')

    await user.click(screen.getByRole('button', { name: 'Delete' }))
    const dialog = screen.getByText('Delete this post?').closest<HTMLElement>('.modal-card')!
    await user.click(within(dialog).getByRole('button', { name: 'Delete post' }))

    expect(deletePostMock).toHaveBeenCalledWith('p1')
    expect(await screen.findByTestId('location')).toHaveTextContent('/users/alexr')
  })

  it('shows a blocked-from-commenting notice for a blocked user', async () => {
    renderPostView(makeSignedInAuthValue({ profile: makeProfile({ id: 'viewer-1', is_blocked: true }) }))

    await screen.findByText('Tubeless setup tips')
    expect(screen.getByText("You've been blocked from commenting.")).toBeInTheDocument()
  })
})
