import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockQuery } from '../test/mockSupabase'
import type { SupabaseMock } from '../test/mockSupabase'
import { supabase } from './supabaseClient'
import { MAX_POST_IMAGE_BYTES, replacePostImages, uploadPostImage, validatePostImage } from './postImages'

vi.mock('./supabaseClient', async () => {
  const { createSupabaseMock } = await import('../test/mockSupabase')
  return { supabase: createSupabaseMock() }
})

const supabaseMock = supabase as unknown as SupabaseMock

beforeEach(() => {
  supabaseMock.from.mockReset()
})

const makeFile = (type: string, size: number): File => {
  const file = new File([new Uint8Array(size)], 'photo.png', { type })
  return file
}

describe('validatePostImage', () => {
  it('accepts an allowed type within the size limit', () => {
    expect(validatePostImage(makeFile('image/png', 1024))).toBeNull()
  })

  it('rejects a disallowed mime type', () => {
    expect(validatePostImage(makeFile('image/tiff', 1024))).toMatch(/must be one of/)
  })

  it('rejects a file over the 5MB limit', () => {
    expect(validatePostImage(makeFile('image/png', MAX_POST_IMAGE_BYTES + 1))).toBe('Image must be 5MB or smaller.')
  })
})

describe('uploadPostImage', () => {
  it('rejects an invalid file before ever touching storage', async () => {
    const uploadMock = vi.fn()
    supabaseMock.storage.from.mockReturnValue({ upload: uploadMock, remove: vi.fn(), list: vi.fn(), getPublicUrl: vi.fn() })

    const result = await uploadPostImage('u1', makeFile('image/tiff', 10))

    expect('error' in result && result.error).toMatch(/must be one of/)
    expect(uploadMock).not.toHaveBeenCalled()
  })

  it('uploads to a fresh random path under the author id and returns its public URL', async () => {
    const uploadMock = vi.fn(async (path: string) => ({ data: { path }, error: null }))
    const getPublicUrlMock = vi.fn((path: string) => ({ data: { publicUrl: `https://cdn.test/${path}` } }))
    supabaseMock.storage.from.mockReturnValue({ upload: uploadMock, remove: vi.fn(), list: vi.fn(), getPublicUrl: getPublicUrlMock })

    const result = await uploadPostImage('u1', makeFile('image/png', 10))

    expect('url' in result && result.url).toMatch(/^https:\/\/cdn\.test\/u1\//)
    const uploadedPath = uploadMock.mock.calls[0][0] as string
    expect(uploadedPath.startsWith('u1/')).toBe(true)
  })

  it('surfaces a storage upload error', async () => {
    const uploadMock = vi.fn(async () => ({ data: null, error: { message: 'quota exceeded' } }))
    supabaseMock.storage.from.mockReturnValue({ upload: uploadMock, remove: vi.fn(), list: vi.fn(), getPublicUrl: vi.fn() })

    const result = await uploadPostImage('u1', makeFile('image/png', 10))

    expect('error' in result && result.error).toBe('quota exceeded')
  })
})

describe('replacePostImages', () => {
  it('clears and reattaches images, removing storage files only for images that were actually dropped', async () => {
    const removeMock = vi.fn(async () => ({ data: [], error: null }))
    supabaseMock.storage.from.mockReturnValue({ upload: vi.fn(), remove: removeMock, list: vi.fn(), getPublicUrl: vi.fn() })

    supabaseMock.from.mockImplementation((table: string) => {
      if (table === 'post_images') {
        return mockQuery([
          { image_url: 'https://test.supabase.local/storage/v1/object/public/post-images/u1/keep.png' },
          { image_url: 'https://test.supabase.local/storage/v1/object/public/post-images/u1/drop.png' },
        ])
      }
      throw new Error(`unexpected table ${table}`)
    })

    const { error } = await replacePostImages('p1', ['https://test.supabase.local/storage/v1/object/public/post-images/u1/keep.png'])

    expect(error).toBeNull()
    expect(removeMock).toHaveBeenCalledWith(['u1/drop.png'])
  })

  it('does not touch storage when nothing was removed', async () => {
    const removeMock = vi.fn()
    supabaseMock.storage.from.mockReturnValue({ upload: vi.fn(), remove: removeMock, list: vi.fn(), getPublicUrl: vi.fn() })
    supabaseMock.from.mockReturnValue(mockQuery([{ image_url: 'https://test.supabase.local/storage/v1/object/public/post-images/u1/keep.png' }]))

    await replacePostImages('p1', ['https://test.supabase.local/storage/v1/object/public/post-images/u1/keep.png'])

    expect(removeMock).not.toHaveBeenCalled()
  })
})
