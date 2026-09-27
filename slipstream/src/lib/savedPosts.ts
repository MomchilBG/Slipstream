import { supabase } from './supabaseClient'
import { getPublicProfiles } from './publicProfiles'
import type { PostSummary } from './posts'

interface PostRow {
  id: string
  title: string
  created_at: string
  comment_count: number
  author_id: string
}

export const savePost = (userId: string, postId: string) => supabase.from('saved_posts').insert({ user_id: userId, post_id: postId })

export const unsavePost = (userId: string, postId: string) => supabase.from('saved_posts').delete().eq('user_id', userId).eq('post_id', postId)

export const isPostSaved = async (userId: string, postId: string): Promise<boolean> => {
  const { data } = await supabase.from('saved_posts').select('post_id').eq('user_id', userId).eq('post_id', postId).maybeSingle()
  return !!data
}

export const getSavedPostCount = async (userId: string): Promise<number> => {
  const { count } = await supabase.from('saved_posts').select('post_id', { count: 'exact', head: true }).eq('user_id', userId)
  return count ?? 0
}

export const getSavedPostsByUser = async (userId: string): Promise<PostSummary[]> => {
  const { data: saved, error } = await supabase
    .from('saved_posts')
    .select('post_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error || !saved || saved.length === 0) return []

  const postIds = saved.map((row) => row.post_id)
  const { data: posts } = await supabase.from('posts').select('id, title, created_at, comment_count, author_id').in('id', postIds)
  if (!posts || posts.length === 0) return []

  const authorIds = [...new Set(posts.map((post) => post.author_id))]
  const profiles = await getPublicProfiles(authorIds)
  const postById = new Map((posts as PostRow[]).map((post) => [post.id, post]))

  // Preserve save order (most recently saved first) rather than whatever
  // order the `posts` table lookup happened to return.
  return postIds
    .map((id) => postById.get(id))
    .filter((post): post is PostRow => post !== undefined)
    .map((post) => ({
      id: post.id,
      title: post.title,
      author: profiles.get(post.author_id)?.username ?? 'Unknown',
      commentCount: post.comment_count,
      createdAt: post.created_at,
    }))
}
