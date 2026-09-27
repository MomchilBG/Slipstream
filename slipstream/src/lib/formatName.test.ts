import { describe, expect, it } from 'vitest'
import { formatFullName } from './formatName'

describe('formatFullName', () => {
  it('joins first and last name with a space', () => {
    expect(formatFullName('Alex', 'Rivera')).toBe('Alex Rivera')
  })

  it('omits the trailing space when last name is null', () => {
    expect(formatFullName('Alex', null)).toBe('Alex')
  })

  it('omits the trailing space when last name is empty', () => {
    expect(formatFullName('Alex', '')).toBe('Alex')
  })
})
