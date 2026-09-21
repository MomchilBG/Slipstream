import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { searchPosts } from '../../lib/search'
import { deletePost } from '../../lib/posts'
import { deleteComment, getComments } from '../../lib/postDetail'
import type { CommentItem } from '../../lib/postDetail'
import { getTagsForPost, removeTagFromPost } from '../../lib/tags'
import AdminPosts from './AdminPosts'

vi.mock('../../lib/search', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/search')>()
  return { ...actual, searchPosts: vi.fn() }
})
vi.mock('../../lib/posts', () => ({ deletePost: vi.fn() }))
vi.mock('../../lib/postDetail', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/postDetail')>()
  return { ...actual, getComments: vi.fn(), deleteComment: vi.fn() }
})
vi.mock('../../lib/tags', () => ({ getTagsForPost: vi.fn(), removeTagFromPost: vi.fn() }))

const searchPostsMock = vi.mocked(searchPosts)
const deletePostMock = vi.mocked(deletePost)
const getCommentsMock = vi.mocked(getComments)
const deleteCommentMock = vi.mocked(deleteComment)
const getTagsForPostMock = vi.mocked(getTagsForPost)
const removeTagFromPostMock = vi.mocked(removeTagFromPost)

const post = { id: 'p1', title: 'Tubeless setup tips', author: 'alexr', commentCount: 2, createdAt: '2024-01-01T00:00:00.000Z', score: 4 }

const makeComment = (overrides: Partial<CommentItem> = {}): CommentItem => ({
  id: 'c1',
  content: 'Nice post!',
  createdAt: '2024-01-01T01:00:00.000Z',
  updatedAt: '2024-01-01T01:00:00.000Z',
  author: { id: 'u2', username: 'commenter', firstName: 'C', lastName: null, avatarUrl: null, reputation: 0, role: 'user', isBlocked: false },
  badges: [],
  parentCommentId: null,
  isDeleted: false,
  ...overrides,
})

beforeEach(() => {
  searchPostsMock.mockReset().mockResolvedValue({ posts: [post], totalCount: 1 })
  deletePostMock.mockReset().mockResolvedValue({ error: null })
  getCommentsMock.mockReset().mockResolvedValue([])
  deleteCommentMock.mockReset().mockResolvedValue({ error: null })
  getTagsForPostMock.mockReset().mockResolvedValue([])
  removeTagFromPostMock.mockReset().mockResolvedValue({ error: null })
})

const renderAdminPosts = () => render(<AdminPosts />, { wrapper: MemoryRouter })

describe('AdminPosts', () => {
  it('loads the unfiltered, most-recent post list on mount', async () => {
    renderAdminPosts()

    expect(await screen.findByText('Tubeless setup tips')).toBeInTheDocument()
    expect(searchPostsMock).toHaveBeenCalledWith({ words: [], tags: [], users: [] }, 'recent', 0)
  })

  it('shows empty-state copy when nothing matches', async () => {
    searchPostsMock.mockResolvedValue({ posts: [], totalCount: 0 })
    renderAdminPosts()

    expect(await screen.findByText('No posts match.')).toBeInTheDocument()
  })

  it('deletes a post through the confirm dialog and removes it from the list', async () => {
    const user = userEvent.setup()
    renderAdminPosts()
    await screen.findByText('Tubeless setup tips')

    await user.click(screen.getByRole('button', { name: 'Delete' }))
    const dialog = screen.getByText('Delete post').closest<HTMLElement>('.modal-card')!
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))

    expect(deletePostMock).toHaveBeenCalledWith('p1')
    expect(await screen.findByText('No posts match.')).toBeInTheDocument()
  })

  it('opens the tags modal and removes a tag', async () => {
    const user = userEvent.setup()
    getTagsForPostMock.mockResolvedValue(['gravel', 'commuting'])
    renderAdminPosts()
    await screen.findByText('Tubeless setup tips')

    await user.click(screen.getByRole('button', { name: 'Remove tags' }))
    expect(await screen.findByText('gravel')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Remove tag gravel' }))

    expect(removeTagFromPostMock).toHaveBeenCalledWith('p1', 'gravel')
    await waitFor(() => expect(screen.queryByText('gravel')).not.toBeInTheDocument())
    expect(screen.getByText('commuting')).toBeInTheDocument()
  })

  it('opens the comments modal and deletes a comment', async () => {
    const user = userEvent.setup()
    getCommentsMock.mockResolvedValue([makeComment()])
    renderAdminPosts()
    await screen.findByText('Tubeless setup tips')

    await user.click(screen.getByRole('button', { name: 'Comments' }))
    const commentsModal = (await screen.findByText('Nice post!')).closest<HTMLElement>('.admin-comments-modal')!

    await user.click(within(commentsModal).getByRole('button', { name: 'Delete' }))
    const dialog = screen.getByText('Delete comment').closest<HTMLElement>('.modal-card')!
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))

    expect(deleteCommentMock).toHaveBeenCalledWith('c1')
    expect(await screen.findByText('[deleted]')).toBeInTheDocument()
  })

  it('shows a "Load more" button and fetches the next page', async () => {
    const user = userEvent.setup()
    searchPostsMock.mockResolvedValueOnce({ posts: [post], totalCount: 2 })
    renderAdminPosts()
    await screen.findByText('Tubeless setup tips')

    searchPostsMock.mockResolvedValueOnce({ posts: [{ ...post, id: 'p2', title: 'Second post' }], totalCount: 2 })
    await user.click(screen.getByRole('button', { name: 'Load more (1 left)' }))

    expect(await screen.findByText('Second post')).toBeInTheDocument()
  })

  it('switches sort and re-runs the search', async () => {
    const user = userEvent.setup()
    renderAdminPosts()
    await screen.findByText('Tubeless setup tips')

    await user.click(screen.getByRole('button', { name: 'Top score' }))

    expect(searchPostsMock).toHaveBeenLastCalledWith({ words: [], tags: [], users: [] }, 'score', 0)
  })
})
