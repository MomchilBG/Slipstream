import { Fragment } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

// Mirrors the username pattern enforced at registration (3-32 chars:
// lowercase letters, numbers, underscores) - see Register.tsx's
// USERNAME_PATTERN and the notify_on_comment_insert() trigger that scans
// comment content for the same shape to generate mention notifications.
const MENTION_PATTERN = /@([A-Za-z0-9_]{3,32})/g

// Renders comment/reply content as plain text, except each "@username"
// token becomes a link to that user's profile - used wherever comment
// content is shown to a signed-in reader (not the admin moderation view,
// which shows raw content on purpose).
const MentionText = ({ text }: { text: string }) => {
  const nodes: ReactNode[] = []
  let lastIndex = 0

  for (const match of text.matchAll(MENTION_PATTERN)) {
    const index = match.index ?? 0
    if (index > lastIndex) nodes.push(<Fragment key={nodes.length}>{text.slice(lastIndex, index)}</Fragment>)

    const username = match[1].toLowerCase()
    nodes.push(
      <Link key={nodes.length} to={`/users/${username}`} className="mention-link">
        {match[0]}
      </Link>,
    )
    lastIndex = index + match[0].length
  }

  if (lastIndex < text.length) nodes.push(<Fragment key={nodes.length}>{text.slice(lastIndex)}</Fragment>)

  return <>{nodes}</>
}

export default MentionText
