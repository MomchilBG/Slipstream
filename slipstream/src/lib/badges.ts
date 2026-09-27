import { supabase } from './supabaseClient'

export type BadgeCriteriaType = 'post_count' | 'comment_count' | 'reputation' | 'tenure_days'

export interface BadgeDefinition {
  id: string
  code: string
  name: string
  description: string
  criteriaType: BadgeCriteriaType
  threshold: number
}

export const getAllBadges = async (): Promise<BadgeDefinition[]> => {
  const { data } = await supabase.from('badges').select('id, code, name, description, criteria_type, threshold').order('threshold')

  return (data ?? []).map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    criteriaType: row.criteria_type as BadgeCriteriaType,
    threshold: row.threshold,
  }))
}

export interface BadgeProgress {
  criteriaType: BadgeCriteriaType
  current: number
  // The highest badge in this category already earned, or null if none yet.
  earnedTopBadge: BadgeDefinition | null
  // The next not-yet-reached badge in this category, or null once every
  // badge in it has been earned.
  nextBadge: BadgeDefinition | null
  // 0-100, filling from the last earned threshold (0 if none) up to
  // nextBadge's threshold - so the bar reads as progress within the
  // current tier rather than from an arbitrary zero once a badge is earned.
  percent: number
}

export const computeBadgeProgress = (criteriaType: BadgeCriteriaType, current: number, allBadges: BadgeDefinition[]): BadgeProgress => {
  const tierBadges = allBadges.filter((badge) => badge.criteriaType === criteriaType).sort((a, b) => a.threshold - b.threshold)

  const earnedTopBadge = [...tierBadges].reverse().find((badge) => badge.threshold <= current) ?? null
  const nextBadge = tierBadges.find((badge) => badge.threshold > current) ?? null

  const floor = earnedTopBadge?.threshold ?? 0
  const percent = nextBadge ? Math.max(0, Math.min(100, ((current - floor) / (nextBadge.threshold - floor)) * 100)) : 100

  return { criteriaType, current, earnedTopBadge, nextBadge, percent }
}
