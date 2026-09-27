// Renders an ISO timestamp in the viewer's own timezone (Intl defaults to it
// when no `timeZone` option is given), from year down to minutes.
export const formatDateTime = (iso: string): string => new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })

// Same as formatDateTime() but date-only, for contexts (like a profile's
// "Joined" line) where the time of day isn't meaningful.
export const formatDate = (iso: string): string => new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
