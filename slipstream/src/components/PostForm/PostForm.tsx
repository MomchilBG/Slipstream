import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent, KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { ALLOWED_POST_IMAGE_LABEL, ALLOWED_POST_IMAGE_TYPES, MAX_POST_IMAGES, validatePostImage } from '../../lib/postImages'
import '../../pages/auth.css'
import './PostForm.css'

const TITLE_PATTERN = /^.{4,64}$/
const CONTENT_PATTERN = /^[\s\S]{16,8192}$/
const ALLOWED_POST_IMAGE_TYPES_ACCEPT = ALLOWED_POST_IMAGE_TYPES.join(',')

type ImageItem = { key: string; kind: 'existing'; url: string } | { key: string; kind: 'new'; file: File }

// A standalone component (not inlined in PostForm) so its object-URL
// lifecycle - create on mount/file change, revoke on unmount - is scoped to
// one thumbnail rather than juggled as an array in the parent.
const ImageThumb = ({ item, onRemove }: { item: ImageItem; onRemove: () => void }) => {
  // `item` is a fresh object literal every render (PostForm rebuilds
  // imageItems from scratch each time), so memoizing on it directly would
  // re-run this on every keystroke elsewhere in the form and needlessly
  // recreate the blob URL - depend on the stable File reference instead.
  const newFile = item.kind === 'new' ? item.file : null
  const objectUrl = useMemo(() => (newFile ? URL.createObjectURL(newFile) : null), [newFile])
  useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [objectUrl])

  return (
    <li className="post-image-thumb">
      <img src={item.kind === 'existing' ? item.url : objectUrl!} alt="" />
      <button type="button" onClick={onRemove} aria-label="Remove image">
        <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
          <line x1="4" y1="4" x2="20" y2="20" />
          <line x1="20" y1="4" x2="4" y2="20" />
        </svg>
      </button>
    </li>
  )
}

export interface PostImagesChange {
  // Existing images to keep, in order.
  keepUrls: string[]
  // New files to upload, appended after keepUrls.
  newFiles: File[]
}

export interface PostFormProps {
  heading: string
  initialTitle?: string
  initialContent?: string
  initialTags?: string[]
  initialImageUrls?: string[]
  submitLabel: string
  submittingLabel: string
  cancelHref?: string
  onSubmit: (title: string, content: string, tags: string[], images: PostImagesChange) => Promise<{ error: string | null }>
}

const PostForm = ({
  heading,
  initialTitle = '',
  initialContent = '',
  initialTags = [],
  initialImageUrls = [],
  submitLabel,
  submittingLabel,
  cancelHref,
  onSubmit,
}: PostFormProps) => {
  const [title, setTitle] = useState(initialTitle)
  const [content, setContent] = useState(initialContent)
  const [tagInput, setTagInput] = useState('')
  const [tags, setTags] = useState<string[]>(initialTags)
  const [tagError, setTagError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [existingImageUrls, setExistingImageUrls] = useState<string[]>(initialImageUrls)
  const [newImageFiles, setNewImageFiles] = useState<File[]>([])
  const [imageError, setImageError] = useState<string | null>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)

  const imageItems: ImageItem[] = [
    ...existingImageUrls.map((url): ImageItem => ({ key: url, kind: 'existing', url })),
    ...newImageFiles.map((file, index): ImageItem => ({ key: `new-${index}-${file.name}-${file.size}`, kind: 'new', file })),
  ]
  const imageSlotsLeft = MAX_POST_IMAGES - imageItems.length

  const handleImageFilesChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (files.length === 0) return

    if (imageSlotsLeft <= 0) {
      setImageError(`You can add up to ${MAX_POST_IMAGES} images.`)
      return
    }

    const accepted: File[] = []
    let validationError: string | null = null
    for (const file of files) {
      const error = validatePostImage(file)
      if (error) {
        validationError = error
        continue
      }
      accepted.push(file)
    }

    const skipped = accepted.length - imageSlotsLeft
    const toAdd = accepted.slice(0, imageSlotsLeft)

    setImageError(
      validationError ?? (skipped > 0 ? `Added ${toAdd.length}; skipped ${skipped} - a post can have at most ${MAX_POST_IMAGES} images.` : null),
    )
    if (toAdd.length > 0) setNewImageFiles((current) => [...current, ...toAdd])
  }

  const removeImageItem = (item: ImageItem) => {
    setImageError(null)
    if (item.kind === 'existing') {
      setExistingImageUrls((current) => current.filter((url) => url !== item.url))
    } else {
      setNewImageFiles((current) => current.filter((file) => file !== item.file))
    }
  }

  const addTag = () => {
    // Underscores are reserved as the navbar search box's stand-in for a
    // space in a multi-word #tag (see lib/search.ts) - normalize them away
    // here so a tag can never contain one for real, which would otherwise
    // make it permanently unfindable via its own "click to search" link.
    const trimmed = tagInput.replace(/[_\s]+/g, ' ').trim()
    if (!trimmed) return

    if (trimmed.length > 32) {
      setTagError('Tags must be 32 characters or fewer.')
      return
    }
    if (tags.includes(trimmed)) {
      setTagError('That tag is already added.')
      setTagInput('')
      return
    }

    setTags((current) => [...current, trimmed])
    setTagInput('')
    setTagError(null)
  }

  const removeTag = (tag: string) => {
    setTags((current) => current.filter((existing) => existing !== tag))
  }

  const handleTagKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      addTag()
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError(null)

    const trimmedTitle = title.trim()
    const trimmedContent = content.trim()

    if (!TITLE_PATTERN.test(trimmedTitle)) {
      setFormError('Title must be 4-64 characters.')
      return
    }
    if (!CONTENT_PATTERN.test(trimmedContent)) {
      setFormError('Content must be 16-8192 characters.')
      return
    }

    setSubmitting(true)
    const { error } = await onSubmit(trimmedTitle, trimmedContent, tags, { keepUrls: existingImageUrls, newFiles: newImageFiles })
    setSubmitting(false)

    if (error) setFormError(error)
  }

  return (
    <section id="post-form-page">
      <form id="post-form-card" onSubmit={handleSubmit} noValidate>
        <h1>{heading}</h1>

        <div className="auth-field">
          <label htmlFor="title">
            Title
            <span className="auth-required-mark"> *</span>
          </label>
          <input
            id="title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="4-64 characters"
            maxLength={64}
          />
        </div>

        <div className="auth-field">
          <label htmlFor="content">
            Content
            <span className="auth-required-mark"> *</span>
          </label>
          <textarea
            id="content"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="16-8192 characters"
            rows={10}
            maxLength={8192}
          />
        </div>

        <div className="auth-field">
          <label htmlFor="postImages">
            Images ({imageItems.length}/{MAX_POST_IMAGES})
          </label>
          <div id="post-image-field">
            {imageItems.length > 0 && (
              <ul id="post-image-list">
                {imageItems.map((item) => (
                  <ImageThumb key={item.key} item={item} onRemove={() => removeImageItem(item)} />
                ))}
              </ul>
            )}
            <div id="post-image-actions">
              <input
                ref={imageInputRef}
                id="postImages"
                type="file"
                accept={ALLOWED_POST_IMAGE_TYPES_ACCEPT}
                multiple
                onChange={handleImageFilesChange}
                hidden
              />
              <button
                type="button"
                className="button"
                onClick={() => imageInputRef.current?.click()}
                disabled={imageSlotsLeft <= 0}
              >
                Add image{imageItems.length > 0 ? 's' : ''}
              </button>
            </div>
            <p id="post-image-hint">
              {ALLOWED_POST_IMAGE_LABEL} | 5MB per image
            </p>
            {imageError && <span className="auth-error">{imageError}</span>}
          </div>
        </div>

        <div className="auth-field">
          <label htmlFor="tagInput">Tags</label>
          <div id="tag-input-row">
            <input
              id="tagInput"
              value={tagInput}
              onChange={(event) => {
                setTagInput(event.target.value.toLowerCase())
                setTagError(null)
              }}
              onKeyDown={handleTagKeyDown}
              placeholder="Add a tag"
              maxLength={32}
            />
            <button type="button" className="button" onClick={addTag}>
              Add tag
            </button>
          </div>
          {tagError && <span className="auth-error">{tagError}</span>}
          {tags.length > 0 && (
            <ul id="tag-bubble-list">
              {tags.map((tag) => (
                <li key={tag} className="tag-bubble">
                  <span>{tag}</span>
                  <button type="button" onClick={() => removeTag(tag)} aria-label={`Remove tag ${tag}`}>
                    <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                      <line x1="4" y1="4" x2="20" y2="20" />
                      <line x1="20" y1="4" x2="4" y2="20" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {formError && <p className="auth-form-error">{formError}</p>}

        <div id="post-form-actions">
          {cancelHref && (
            <Link to={cancelHref} className="button">
              Cancel
            </Link>
          )}
          <button type="submit" className="button primary" disabled={submitting}>
            {submitting ? submittingLabel : submitLabel}
          </button>
        </div>
      </form>
    </section>
  )
}

export default PostForm
