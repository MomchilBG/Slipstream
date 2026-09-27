import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders, makeSignedInAuthValue, makeProfile } from '../../test/testUtils'
import { searchAdminUsers, setUserBlocked } from '../../lib/admin'
import AdminUsers from './AdminUsers'

vi.mock('../../lib/admin', () => ({ searchAdminUsers: vi.fn(), setUserBlocked: vi.fn() }))

const searchAdminUsersMock = vi.mocked(searchAdminUsers)
const setUserBlockedMock = vi.mocked(setUserBlocked)

const viewerProfile = makeProfile({ id: 'admin-1', username: 'root', role: 'admin' })

beforeEach(() => {
  searchAdminUsersMock.mockReset()
  setUserBlockedMock.mockReset().mockResolvedValue({ error: null } as never)
})

const renderAdminUsers = () => renderWithProviders(<AdminUsers />, { authValue: makeSignedInAuthValue({ profile: viewerProfile }) })

describe('AdminUsers', () => {
  it('prompts to search before any results are shown', () => {
    renderAdminUsers()

    expect(screen.getByText('Type a username, email, or name above to find a user.')).toBeInTheDocument()
  })

  it('runs a search and lists matching users', async () => {
    const user = userEvent.setup()
    searchAdminUsersMock.mockResolvedValue([
      { id: 'u1', username: 'alexr', firstName: 'Alex', lastName: null, email: 'alex@example.com', isBlocked: false, createdAt: '2024-01-01T00:00:00.000Z' },
    ])
    renderAdminUsers()

    await user.type(screen.getByLabelText('Search users'), 'alex')
    await user.click(screen.getByRole('button', { name: 'Search' }))

    expect(await screen.findByRole('link', { name: 'alexr' })).toBeInTheDocument()
    expect(searchAdminUsersMock).toHaveBeenCalledWith('alex')
  })

  it('shows empty-state copy when nothing matches', async () => {
    const user = userEvent.setup()
    searchAdminUsersMock.mockResolvedValue([])
    renderAdminUsers()

    await user.type(screen.getByLabelText('Search users'), 'ghost')
    await user.click(screen.getByRole('button', { name: 'Search' }))

    expect(await screen.findByText('No users match that search.')).toBeInTheDocument()
  })

  it('blocks a user through the confirm dialog', async () => {
    const user = userEvent.setup()
    searchAdminUsersMock.mockResolvedValue([
      { id: 'u1', username: 'alexr', firstName: 'Alex', lastName: null, email: 'alex@example.com', isBlocked: false, createdAt: '2024-01-01T00:00:00.000Z' },
    ])
    renderAdminUsers()

    await user.type(screen.getByLabelText('Search users'), 'alex')
    await user.click(screen.getByRole('button', { name: 'Search' }))
    await user.click(await screen.findByRole('button', { name: 'Block' }))

    const dialog = screen.getByText('Block user').closest<HTMLElement>('.modal-card')!
    await user.click(within(dialog).getByRole('button', { name: 'Block' }))

    expect(setUserBlockedMock).toHaveBeenCalledWith('u1', true)
    expect(await screen.findByText('Blocked')).toBeInTheDocument()
  })

  it('unblocks a user immediately, with no confirmation', async () => {
    const user = userEvent.setup()
    searchAdminUsersMock.mockResolvedValue([
      { id: 'u2', username: 'blockedguy', firstName: 'Blocked', lastName: null, email: 'b@example.com', isBlocked: true, createdAt: '2024-01-01T00:00:00.000Z' },
    ])
    renderAdminUsers()

    await user.type(screen.getByLabelText('Search users'), 'blocked')
    await user.click(screen.getByRole('button', { name: 'Search' }))
    await user.click(await screen.findByRole('button', { name: 'Unblock' }))

    expect(setUserBlockedMock).toHaveBeenCalledWith('u2', false)
    expect(await screen.findByRole('button', { name: 'Block' })).toBeInTheDocument()
    expect(screen.queryByText('Blocked')).not.toBeInTheDocument()
  })

  it('disables the Block button on the admin\'s own row', async () => {
    const user = userEvent.setup()
    searchAdminUsersMock.mockResolvedValue([
      { id: 'admin-1', username: 'root', firstName: 'Root', lastName: null, email: 'root@example.com', isBlocked: false, createdAt: '2024-01-01T00:00:00.000Z' },
    ])
    renderAdminUsers()

    await user.type(screen.getByLabelText('Search users'), 'root')
    await user.click(screen.getByRole('button', { name: 'Search' }))

    expect(await screen.findByRole('button', { name: 'Block' })).toBeDisabled()
  })
})
