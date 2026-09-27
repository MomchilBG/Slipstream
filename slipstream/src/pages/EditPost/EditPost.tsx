import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { getPostForEdit, updatePost } from '../../lib/posts'
import type { EditablePost } from '../../lib/posts'
import { replacePostTags } from '../../lib/tags'
import { replacePostImages, uploadPostImage } from '../../lib/postImages'
import PostForm from '../../components/PostForm/PostForm'
import type { PostImagesChange } from '../../components/PostForm/PostForm'

const EditPost = () => {
  const { id } = useParams<{ id: string }>()
  if (!id) return null
  return <EditPostForId postId={id} />
}

const EditPostForId = ({ postId }: { postId: string }) => {
  const navigate = useNavigate()
  const { profile } = useAuth()

  const [post, setPost] = useState<EditablePost | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    let cancelled = false

    getPostForEdit(postId).then((result) => {
      if (cancelled) return
      setPost(result)
      setNotFound(!result)
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [postId])

  if (!profile || loading) {
    return (
      <section id="post-form-page">
        <p>Loading…</p>
      </section>
    )
  }

  if (notFound || !post) {
    return (
      <section id="post-form-page">
        <p>This post doesn&apos;t exist.</p>
      </section>
    )
  }

  if (post.authorId !== profile.id) {
    return (
      <section id="post-form-page">
        <p className="auth-form-error">You can only edit your own posts.</p>
      </section>
    )
  }

  if (profile.is_blocked) {
    return (
      <section id="post-form-page">
        <p className="auth-form-error">Your account has been blocked from editing posts.</p>
      </section>
    )
  }

  const handleSubmit = async (title: string, content: string, tags: string[], images: PostImagesChange): Promise<{ error: string | null }> => {
    const { error } = await updatePost(postId, title, content)
    if (error) return { error: error.message }

    const { error: tagError } = await replacePostTags(postId, tags)
    if (tagError) return { error: `Post updated, but tags failed to save: ${tagError}` }

    const uploadResults = await Promise.all(images.newFiles.map((file) => uploadPostImage(profile.id, file)))
    const failed = uploadResults.find((result) => 'error' in result)
    if (failed && 'error' in failed) {
      return { error: `Post updated, but an image failed to upload: ${failed.error}` }
    }

    const newUrls = uploadResults.map((result) => (result as { url: string }).url)
    const finalImages = [...images.keepUrls, ...newUrls]
    const imagesUnchanged = finalImages.length === post.images.length && finalImages.every((url, index) => url === post.images[index])

    if (!imagesUnchanged) {
      const { error: imagesError } = await replacePostImages(postId, finalImages)
      if (imagesError) return { error: `Post updated, but images failed to save: ${imagesError}` }
    }

    navigate(`/posts/${postId}`)
    return { error: null }
  }

  return (
    <PostForm
      key={postId}
      heading="Edit post"
      initialTitle={post.title}
      initialContent={post.content}
      initialTags={post.tags}
      initialImageUrls={post.images}
      submitLabel="Save changes"
      submittingLabel="Saving…"
      cancelHref={`/posts/${postId}`}
      onSubmit={handleSubmit}
    />
  )
}

export default EditPost
