import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { createPost } from '../../lib/posts'
import { attachTagsToPost } from '../../lib/tags'
import { replacePostImages, uploadPostImage } from '../../lib/postImages'
import PostForm from '../../components/PostForm/PostForm'
import type { PostImagesChange } from '../../components/PostForm/PostForm'

const CreatePost = () => {
  const navigate = useNavigate()
  const { profile } = useAuth()

  // profile lags session by one fetch - guard against submitting before it
  // resolves, rather than force-unwrapping it below.
  if (!profile) {
    return (
      <section id="post-form-page">
        <p>Loading…</p>
      </section>
    )
  }

  if (profile.is_blocked) {
    return (
      <section id="post-form-page">
        <p className="auth-form-error">Your account has been blocked from posting.</p>
      </section>
    )
  }

  const authorId = profile.id

  const handleSubmit = async (title: string, content: string, tags: string[], images: PostImagesChange): Promise<{ error: string | null }> => {
    const { data, error } = await createPost(authorId, title, content)

    if (error || !data) {
      return { error: error?.message ?? 'Something went wrong creating your post.' }
    }

    if (tags.length > 0) {
      const { error: tagAttachError } = await attachTagsToPost(data.id, tags)
      if (tagAttachError) {
        return { error: `Post created, but tags failed to save: ${tagAttachError}` }
      }
    }

    if (images.newFiles.length > 0) {
      const uploadResults = await Promise.all(images.newFiles.map((file) => uploadPostImage(authorId, file)))
      const failed = uploadResults.find((result) => 'error' in result)
      if (failed && 'error' in failed) {
        return { error: `Post created, but an image failed to upload: ${failed.error}` }
      }

      const urls = uploadResults.map((result) => (result as { url: string }).url)
      const { error: imagesError } = await replacePostImages(data.id, urls)
      if (imagesError) {
        return { error: `Post created, but images failed to save: ${imagesError}` }
      }
    }

    navigate(`/posts/${data.id}`)
    return { error: null }
  }

  return <PostForm heading="New post" submitLabel="Create Post" submittingLabel="Creating…" onSubmit={handleSubmit} />
}

export default CreatePost
