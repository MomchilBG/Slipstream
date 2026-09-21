import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockQuery } from '../test/mockSupabase'
import type { SupabaseMock } from '../test/mockSupabase'
import { supabase } from './supabaseClient'
import { computeBadgeProgress, getAllBadges } from './badges'
import type { BadgeDefinition } from './badges'

vi.mock('./supabaseClient', async () => {
  const { createSupabaseMock } = await import('../test/mockSupabase')
  return { supabase: createSupabaseMock() }
})

const supabaseMock = supabase as unknown as SupabaseMock

beforeEach(() => {
  supabaseMock.from.mockReset()
})

const badges: BadgeDefinition[] = [
  { id: 'b1', code: 'first_post', name: 'First Post', description: '', criteriaType: 'post_count', threshold: 1 },
  { id: 'b2', code: 'prolific', name: 'Prolific Poster', description: '', criteriaType: 'post_count', threshold: 10 },
  { id: 'b3', code: 'legend', name: 'Legend', description: '', criteriaType: 'post_count', threshold: 100 },
]

describe('getAllBadges', () => {
  it('maps criteria_type/threshold columns to camelCase', async () => {
    supabaseMock.from.mockReturnValue(mockQuery([{ id: 'b1', code: 'first_post', name: 'First Post', description: 'Made a post', criteria_type: 'post_count', threshold: 1 }]))

    const result = await getAllBadges()

    expect(supabaseMock.from).toHaveBeenCalledWith('badges')
    expect(result).toEqual([{ id: 'b1', code: 'first_post', name: 'First Post', description: 'Made a post', criteriaType: 'post_count', threshold: 1 }])
  })

  it('returns an empty list when the query fails', async () => {
    supabaseMock.from.mockReturnValue(mockQuery(null, { message: 'boom' }))

    expect(await getAllBadges()).toEqual([])
  })
})

describe('computeBadgeProgress', () => {
  it('fills from 0 toward the first threshold before anything is earned', () => {
    const progress = computeBadgeProgress('post_count', 0, badges)

    expect(progress.earnedTopBadge).toBeNull()
    expect(progress.nextBadge?.code).toBe('first_post')
    expect(progress.percent).toBe(0)
  })

  it('fills from the last earned threshold toward the next one', () => {
    const progress = computeBadgeProgress('post_count', 5, badges)

    expect(progress.earnedTopBadge?.code).toBe('first_post')
    expect(progress.nextBadge?.code).toBe('prolific')
    // (5 - 1) / (10 - 1) * 100
    expect(progress.percent).toBeCloseTo((4 / 9) * 100)
  })

  it('reports full with no next badge once every tier is cleared', () => {
    const progress = computeBadgeProgress('post_count', 500, badges)

    expect(progress.earnedTopBadge?.code).toBe('legend')
    expect(progress.nextBadge).toBeNull()
    expect(progress.percent).toBe(100)
  })

  it('ignores badges from other criteria types', () => {
    const progress = computeBadgeProgress('reputation', 50, badges)

    expect(progress.earnedTopBadge).toBeNull()
    expect(progress.nextBadge).toBeNull()
    expect(progress.percent).toBe(100)
  })
})
