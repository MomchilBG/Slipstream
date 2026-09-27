import { supabase } from './supabaseClient'

const LIST_PAGE_SIZE = 100

// Removes every object directly under `${prefix}/` in the given bucket -
// used to blank out a user's whole folder (their avatar, or every image
// across all of their posts) rather than track individual paths. Storage
// objects must be removed through this API, not by deleting rows from
// storage.objects directly via SQL - that only deletes the metadata row
// and leaves the underlying file orphaned in the bucket.
//
// list() defaults to a 100-item page, so a single call silently misses
// anything past the first 100 files in a folder - loop it instead. Always
// re-list from the top rather than paging with an offset: since each
// iteration also deletes what it just listed, the "next page" is already
// at the front once the current one is gone.
//
// `exclude`, when given, is a single bucket-relative path to leave alone -
// used when a caller already uploaded a fresh file at that path and only
// wants to clear out anything *else* left over in the folder.
export const clearStorageFolder = async (bucket: string, prefix: string, exclude?: string): Promise<void> => {
  while (true) {
    const { data } = await supabase.storage.from(bucket).list(prefix, { limit: LIST_PAGE_SIZE })
    if (!data || data.length === 0) return

    const paths = data.map((file) => `${prefix}/${file.name}`).filter((path) => path !== exclude)
    if (paths.length > 0) await supabase.storage.from(bucket).remove(paths)

    if (data.length < LIST_PAGE_SIZE) return
  }
}

// Public storage URLs look like
// https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>
// - this pulls the bucket-relative path back out so it can be passed to
// remove().
export const extractStoragePath = (bucket: string, url: string): string | null => {
  const marker = `/object/public/${bucket}/`
  const index = url.indexOf(marker)
  if (index === -1) return null
  return decodeURIComponent(url.slice(index + marker.length))
}
