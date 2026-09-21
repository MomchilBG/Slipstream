import { describe, expect, it } from 'vitest'
import { formatDate, formatDateTime } from './formatDate'

describe('formatDateTime', () => {
  it('renders year, month, day, hour and minute', () => {
    const result = formatDateTime('2024-03-15T14:30:00.000Z')

    expect(result).toContain('2024')
    expect(result).toMatch(/\d{1,2}:\d{2}/)
  })
})

describe('formatDate', () => {
  it('renders a date-only string with no time component', () => {
    const result = formatDate('2024-03-15T14:30:00.000Z')

    expect(result).toContain('2024')
    expect(result).not.toMatch(/\d{1,2}:\d{2}/)
  })
})
