import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockQuery } from '../test/mockSupabase'
import type { SupabaseMock } from '../test/mockSupabase'
import { supabase } from './supabaseClient'
import { updateProfileBio, updateProfileName, uploadAvatar } from './profile'

vi.mock('./supabaseClient', async () => {
  const { createSupabaseMock } = await import('../test/mockSupabase')
  return { supabase: createSupabaseMock() }
})

const supabaseMock = supabase as unknown as SupabaseMock

beforeEach(() => {
  supabaseMock.from.mockReset()
})

const makeImageFile = (size = 1024) => new File([new Uint8Array(size)], 'me.jpg', { type: 'image/jpeg' })

describe('updateProfileName', () => {
  it('updates first_name/last_name for the given user', async () => {
    supabaseMock.from.mockReturnValue(mockQuery(null))

    await updateProfileName('u1', 'Alex', 'Rivera')

    expect(supabaseMock.from).toHaveBeenCalledWith('profiles')
  })
})

describe('updateProfileBio', () => {
  it('updates the bio column', async () => {
    supabaseMock.from.mockReturnValue(mockQuery(null))

    await updateProfileBio('u1', 'I ride gravel bikes.')

    expect(supabaseMock.from).toHaveBeenCalledWith('profiles')
  })
})

describe('uploadAvatar', () => {
  it('rejects a non-image file without touching storage', async () => {
    const uploadMock = vi.fn()
    supabaseMock.storage.from.mockReturnValue({ upload: uploadMock, remove: vi.fn(), list: vi.fn(), getPublicUrl: vi.fn() })

    const result = await uploadAvatar('u1', new File(['x'], 'doc.pdf', { type: 'application/pdf' }))

    expect('error' in result && result.error).toBe('Please choose an image file.')
    expect(uploadMock).not.toHaveBeenCalled()
  })

  it('rejects a file over the 2MB limit', async () => {
    const result = await uploadAvatar('u1', makeImageFile(2 * 1024 * 1024 + 1))

    expect('error' in result && result.error).toBe('Image must be 2MB or smaller.')
  })

  it('uploads, updates the profile row, then clears any stale previous avatar', async () => {
    const uploadMock = vi.fn(async () => ({ data: { path: 'u1/avatar.jpg' }, error: null }))
    const getPublicUrlMock = vi.fn(() => ({ data: { publicUrl: 'https://cdn.test/u1/avatar.jpg' } }))
    const listMock = vi.fn(async () => ({ data: [] }))
    supabaseMock.storage.from.mockReturnValue({ upload: uploadMock, remove: vi.fn(), list: listMock, getPublicUrl: getPublicUrlMock })
    supabaseMock.from.mockReturnValue(mockQuery(null))

    const result = await uploadAvatar('u1', makeImageFile())

    expect('url' in result && result.url).toMatch(/^https:\/\/cdn\.test\/u1\/avatar\.jpg\?v=\d+$/)
    expect(uploadMock).toHaveBeenCalled()
    expect(supabaseMock.from).toHaveBeenCalledWith('profiles')
    expect(listMock).toHaveBeenCalled()
  })

  it('surfaces a profile update error without attempting cleanup', async () => {
    const uploadMock = vi.fn(async () => ({ data: { path: 'u1/avatar.jpg' }, error: null }))
    const listMock = vi.fn()
    supabaseMock.storage.from.mockReturnValue({ upload: uploadMock, remove: vi.fn(), list: listMock, getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'https://cdn.test/u1/avatar.jpg' } })) })
    supabaseMock.from.mockReturnValue(mockQuery(null, { message: 'row not found' }))

    const result = await uploadAvatar('u1', makeImageFile())

    expect('error' in result && result.error).toBe('row not found')
    expect(listMock).not.toHaveBeenCalled()
  })
})
