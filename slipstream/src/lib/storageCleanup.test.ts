import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseMock } from '../test/mockSupabase'
import { supabase } from './supabaseClient'
import { clearStorageFolder, extractStoragePath } from './storageCleanup'

vi.mock('./supabaseClient', async () => {
  const { createSupabaseMock } = await import('../test/mockSupabase')
  return { supabase: createSupabaseMock() }
})

const supabaseMock = supabase as unknown as SupabaseMock

describe('extractStoragePath', () => {
  it('pulls the bucket-relative path out of a public storage URL', () => {
    const url = 'https://project.supabase.co/storage/v1/object/public/avatars/user-1/avatar.jpg'
    expect(extractStoragePath('avatars', url)).toBe('user-1/avatar.jpg')
  })

  it('decodes URL-encoded characters in the path', () => {
    const url = 'https://project.supabase.co/storage/v1/object/public/post-images/user-1/a%20file.png'
    expect(extractStoragePath('post-images', url)).toBe('user-1/a file.png')
  })

  it('returns null when the URL does not reference the given bucket', () => {
    const url = 'https://project.supabase.co/storage/v1/object/public/avatars/user-1/avatar.jpg'
    expect(extractStoragePath('post-images', url)).toBeNull()
  })
})

describe('clearStorageFolder', () => {
  const listMock = vi.fn()
  const removeMock = vi.fn(async () => ({ data: [], error: null }))

  beforeEach(() => {
    listMock.mockReset()
    removeMock.mockReset().mockResolvedValue({ data: [], error: null })
    supabaseMock.storage.from.mockReturnValue({ upload: vi.fn(), remove: removeMock, list: listMock, getPublicUrl: vi.fn() })
  })

  it('removes every listed file under the prefix', async () => {
    listMock.mockResolvedValueOnce({ data: [{ name: 'avatar.jpg' }, { name: 'avatar.png' }] })

    await clearStorageFolder('avatars', 'user-1')

    expect(removeMock).toHaveBeenCalledWith(['user-1/avatar.jpg', 'user-1/avatar.png'])
  })

  it('does nothing when the folder is already empty', async () => {
    listMock.mockResolvedValueOnce({ data: [] })

    await clearStorageFolder('avatars', 'user-1')

    expect(removeMock).not.toHaveBeenCalled()
  })

  it('excludes the given path from removal', async () => {
    listMock.mockResolvedValueOnce({ data: [{ name: 'avatar.jpg' }, { name: 'avatar.png' }] })

    await clearStorageFolder('avatars', 'user-1', 'user-1/avatar.png')

    expect(removeMock).toHaveBeenCalledWith(['user-1/avatar.jpg'])
  })

  it('pages through more than 100 files, re-listing from the top each time', async () => {
    const fullPage = Array.from({ length: 100 }, (_, i) => ({ name: `file-${i}.jpg` }))
    listMock.mockResolvedValueOnce({ data: fullPage }).mockResolvedValueOnce({ data: [{ name: 'file-100.jpg' }] })

    await clearStorageFolder('post-images', 'user-1')

    expect(listMock).toHaveBeenCalledTimes(2)
    expect(removeMock).toHaveBeenCalledTimes(2)
  })
})
