import { supabase } from './supabaseClient'

const getOrCreateTagId = async (name: string): Promise<{ id: string | null; error: string | null }> => {
  const { data: existing } = await supabase.from('tags').select('id').eq('name', name).maybeSingle()
  if (existing) return { id: existing.id, error: null }

  const { data: created, error } = await supabase.from('tags').insert({ name }).select('id').single()
  if (!error) return { id: created.id, error: null }

  // Race: someone else created the same tag between our lookup and insert -
  // look it up again instead of treating the unique-constraint hit as a failure.
  const { data: retry } = await supabase.from('tags').select('id').eq('name', name).maybeSingle()
  if (retry) return { id: retry.id, error: null }

  return { id: null, error: error.message }
}

// Dedupe defensively (callers already do this too) and resolve concurrently -
// each lookup/insert is independent of the others.
const resolveTagIds = async (tagNames: string[]): Promise<{ ids: string[] | null; error: string | null }> => {
  const uniqueNames = [...new Set(tagNames)]
  const results = await Promise.all(
    uniqueNames.map(async (name) => ({ name, ...(await getOrCreateTagId(name)) })),
  )

  const tagIds: string[] = []
  for (const result of results) {
    if (!result.id) return { ids: null, error: `Couldn't save tag "${result.name}": ${result.error}` }
    tagIds.push(result.id)
  }

  return { ids: tagIds, error: null }
}

export const attachTagsToPost = async (postId: string, tagNames: string[]): Promise<{ error: string | null }> => {
  const { ids: tagIds, error: resolveError } = await resolveTagIds(tagNames)
  if (resolveError) return { error: resolveError }
  if (!tagIds || tagIds.length === 0) return { error: null }

  const { error } = await supabase.from('post_tags').insert(tagIds.map((tagId) => ({ post_id: postId, tag_id: tagId })))
  return { error: error?.message ?? null }
}

export const getTagsForPost = async (postId: string): Promise<string[]> => {
  const { data: postTagRows } = await supabase.from('post_tags').select('tag_id').eq('post_id', postId)

  const tagIds = (postTagRows ?? []).map((row) => row.tag_id)
  if (tagIds.length === 0) return []

  const { data: tagRows } = await supabase.from('tags').select('name').in('id', tagIds)
  return (tagRows ?? []).map((row) => row.name).sort()
}

// Admins can only remove a tag from a post, never add one (see migration 26)
// - post_tags INSERT is author-only now, so this can't go through
// replacePostTags()'s clear-and-reattach strategy, which would need to
// re-insert every tag the admin *didn't* remove. A single targeted DELETE
// only needs the (author-or-admin) post_tags DELETE policy instead.
export const removeTagFromPost = async (postId: string, tagName: string): Promise<{ error: string | null }> => {
  const { data: tag } = await supabase.from('tags').select('id').eq('name', tagName).maybeSingle()
  if (!tag) return { error: null }

  const { error } = await supabase.from('post_tags').delete().eq('post_id', postId).eq('tag_id', tag.id)
  return { error: error?.message ?? null }
}

// Editing a post's tags: simplest correct approach is to clear the existing
// links and reattach the new list, rather than diffing old vs new - post tag
// lists are small, so the extra round trip isn't a real cost. Resolve the new
// tag ids *before* deleting the old links, so a failure there (a bad name, a
// network blip) leaves the post's existing tags untouched instead of wiping
// them out with nothing to replace them.
export const replacePostTags = async (postId: string, tagNames: string[]): Promise<{ error: string | null }> => {
  const { ids: tagIds, error: resolveError } = await resolveTagIds(tagNames)
  if (resolveError) return { error: resolveError }

  const { error: deleteError } = await supabase.from('post_tags').delete().eq('post_id', postId)
  if (deleteError) return { error: deleteError.message }

  if (!tagIds || tagIds.length === 0) return { error: null }

  const { error } = await supabase.from('post_tags').insert(tagIds.map((tagId) => ({ post_id: postId, tag_id: tagId })))
  return { error: error?.message ?? null }
}
