import { forwardRef, useImperativeHandle } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { AuthContext } from '../../auth/AuthContext'
import { makeSignedInAuthValue, makeProfile } from '../../test/testUtils'
import type { SupabaseMock } from '../../test/mockSupabase'
import { supabase } from '../../lib/supabaseClient'
import { updateProfileBio, updateProfileName, uploadAvatar } from '../../lib/profile'
import { clearStorageFolder } from '../../lib/storageCleanup'
import type { AvatarCropperHandle } from '../../components/AvatarCropper/AvatarCropper'
import Profile from './Profile'

vi.mock('../../lib/supabaseClient', async () => {
  const { createSupabaseMock } = await import('../../test/mockSupabase')
  return { supabase: createSupabaseMock() }
})
vi.mock('../../lib/profile', () => ({ updateProfileBio: vi.fn(), updateProfileName: vi.fn(), uploadAvatar: vi.fn() }))
vi.mock('../../lib/storageCleanup', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/storageCleanup')>()
  return { ...actual, clearStorageFolder: vi.fn() }
})
// AvatarCropper drives real canvas/pointer geometry that jsdom can't
// exercise meaningfully - stub it down to just exposing a fixed blob
// through the same imperative handle Profile.tsx calls, so the
// upload-avatar flow around it can still be tested end to end.
vi.mock('../../components/AvatarCropper/AvatarCropper', () => ({
  default: forwardRef<AvatarCropperHandle, { file: File }>((_props, ref) => {
    useImperativeHandle(ref, () => ({ getCroppedBlob: async () => new Blob(['x'], { type: 'image/jpeg' }) }))
    return <div data-testid="avatar-cropper-stub" />
  }),
}))

const supabaseMock = supabase as unknown as SupabaseMock
const updateProfileNameMock = vi.mocked(updateProfileName)
const updateProfileBioMock = vi.mocked(updateProfileBio)
const uploadAvatarMock = vi.mocked(uploadAvatar)
const clearStorageFolderMock = vi.mocked(clearStorageFolder)

const profile = makeProfile({ id: 'user-1', username: 'alexr', email: 'alex@example.com', first_name: 'Alex', last_name: 'Rivera', bio: null })

beforeEach(() => {
  supabaseMock.auth.signInWithPassword.mockReset().mockResolvedValue({ data: {}, error: null })
  supabaseMock.auth.updateUser.mockReset().mockResolvedValue({ data: {}, error: null })
  supabaseMock.auth.signOut.mockReset().mockResolvedValue({ error: null })
  supabaseMock.rpc.mockReset().mockReturnValue(Promise.resolve({ data: null, error: null }))
  updateProfileNameMock.mockReset().mockResolvedValue({ error: null } as never)
  updateProfileBioMock.mockReset().mockResolvedValue({ error: null } as never)
  uploadAvatarMock.mockReset().mockResolvedValue({ url: 'https://cdn.test/avatar.jpg' })
  clearStorageFolderMock.mockReset().mockResolvedValue(undefined)
})

const LocationProbe = () => {
  const location = useLocation()
  return <div data-testid="location">{location.pathname}</div>
}

const renderProfile = (authValue = makeSignedInAuthValue({ profile, refreshProfile: vi.fn(async () => {}) })) =>
  render(
    <MemoryRouter initialEntries={['/profile']}>
      <AuthContext.Provider value={authValue}>
        <Routes>
          <Route path="/profile" element={<Profile />} />
          <Route path="/" element={<LocationProbe />} />
        </Routes>
      </AuthContext.Provider>
    </MemoryRouter>,
  )

describe('Profile', () => {
  it('saves an updated name and shows a confirmation dialog', async () => {
    const user = userEvent.setup()
    renderProfile()

    const firstNameInput = screen.getByLabelText('First name')
    await user.clear(firstNameInput)
    await user.type(firstNameInput, 'Alexander')
    await user.click(screen.getByRole('button', { name: 'Save name' }))

    expect(updateProfileNameMock).toHaveBeenCalledWith('user-1', 'Alexander', 'Rivera')
    expect(await screen.findByText('Name saved')).toBeInTheDocument()
  })

  it('rejects a first name shorter than 4 characters', async () => {
    const user = userEvent.setup()
    renderProfile()

    const firstNameInput = screen.getByLabelText('First name')
    await user.clear(firstNameInput)
    await user.type(firstNameInput, 'Al')
    await user.click(screen.getByRole('button', { name: 'Save name' }))

    expect(screen.getByText('First name must be 4-32 characters.')).toBeInTheDocument()
    expect(updateProfileNameMock).not.toHaveBeenCalled()
  })

  it('saves the bio', async () => {
    const user = userEvent.setup()
    renderProfile()

    await user.type(screen.getByLabelText('Profile description'), 'I ride gravel.')
    await user.click(screen.getByRole('button', { name: 'Save description' }))

    expect(updateProfileBioMock).toHaveBeenCalledWith('user-1', 'I ride gravel.')
    expect(await screen.findByText('Description saved')).toBeInTheDocument()
  })

  it('validates the new password before submitting', async () => {
    const user = userEvent.setup()
    renderProfile()

    await user.type(screen.getByLabelText('New password'), 'short')
    await user.type(screen.getByLabelText('Confirm new password'), 'short')
    await user.click(screen.getByRole('button', { name: 'Update password' }))

    expect(screen.getByText('Password must be at least 6 characters.')).toBeInTheDocument()
  })

  it('flags mismatched password confirmation', async () => {
    const user = userEvent.setup()
    renderProfile()

    await user.type(screen.getByLabelText('New password'), 'password123')
    await user.type(screen.getByLabelText('Confirm new password'), 'different123')
    await user.click(screen.getByRole('button', { name: 'Update password' }))

    expect(screen.getByText('Passwords do not match.')).toBeInTheDocument()
  })

  it('updates the password successfully', async () => {
    const user = userEvent.setup()
    renderProfile()

    await user.type(screen.getByLabelText('New password'), 'password123')
    await user.type(screen.getByLabelText('Confirm new password'), 'password123')
    await user.click(screen.getByRole('button', { name: 'Update password' }))

    expect(supabaseMock.auth.updateUser).toHaveBeenCalledWith({ password: 'password123' })
    expect(await screen.findByText('Password updated')).toBeInTheDocument()
  })

  it('uploads a cropped avatar', async () => {
    const user = userEvent.setup()
    renderProfile()

    const file = new File(['x'], 'me.jpg', { type: 'image/jpeg' })
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(fileInput, file)

    expect(await screen.findByText('Adjust your photo')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(uploadAvatarMock).toHaveBeenCalledWith('user-1', expect.any(File))
    expect(screen.queryByText('Adjust your photo')).not.toBeInTheDocument()
  })

  it('requires a password before deleting the account, then re-authenticates and cleans up', async () => {
    const user = userEvent.setup()
    renderProfile()

    await user.click(screen.getByRole('button', { name: 'Delete profile' }))
    expect(screen.getByRole('button', { name: 'Delete my account' })).toBeDisabled()

    await user.type(screen.getByLabelText('Password'), 'hunter2')
    await user.click(screen.getByRole('button', { name: 'Delete my account' }))

    expect(supabaseMock.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'alex@example.com', password: 'hunter2' })
    expect(supabaseMock.rpc).toHaveBeenCalledWith('delete_own_account')
    expect(clearStorageFolderMock).toHaveBeenCalledWith('avatars', 'user-1')
    expect(clearStorageFolderMock).toHaveBeenCalledWith('post-images', 'user-1')
    expect(await screen.findByTestId('location')).toHaveTextContent('/')
  })

  it('shows an error and does not delete when the password is wrong', async () => {
    const user = userEvent.setup()
    supabaseMock.auth.signInWithPassword.mockResolvedValue({ data: {}, error: { message: 'Invalid login credentials' } })
    renderProfile()

    await user.click(screen.getByRole('button', { name: 'Delete profile' }))
    await user.type(screen.getByLabelText('Password'), 'wrongpass')
    await user.click(screen.getByRole('button', { name: 'Delete my account' }))

    expect(await screen.findByText('Incorrect password.')).toBeInTheDocument()
    expect(supabaseMock.rpc).not.toHaveBeenCalledWith('delete_own_account')
  })

  it('logs out via the danger-zone button', async () => {
    const user = userEvent.setup()
    const authValue = makeSignedInAuthValue({ profile, refreshProfile: vi.fn(async () => {}) })
    renderProfile(authValue)

    await user.click(screen.getByRole('button', { name: 'Log out' }))

    expect(authValue.signOut).toHaveBeenCalled()
  })
})
