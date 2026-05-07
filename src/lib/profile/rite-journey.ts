import { THREE_RITES_PRODUCTS } from '@/lib/beta/constants'

export type RiteStage = 'orientation' | 'perception' | 'declaration'

export interface RiteStatus {
  completed: string[]
  total: number
  isComplete: boolean
  hasAny: boolean
}

export interface RiteJourney {
  orientation: RiteStatus
  perception: RiteStatus
  declaration: RiteStatus
  currentStage: RiteStage | 'complete' | 'none'
}

export function computeRiteJourney(
  accessRows: { product_slug: string; completed_at: string | null }[]
): RiteJourney {
  const completedSlugs = new Set(
    accessRows
      .filter((r) => r.completed_at != null)
      .map((r) => r.product_slug)
  )

  const build = (slugs: readonly string[]): RiteStatus => {
    const completed = slugs.filter((s) => completedSlugs.has(s))
    return {
      completed,
      total: slugs.length,
      isComplete: completed.length === slugs.length,
      hasAny: completed.length > 0,
    }
  }

  const orientation = build(THREE_RITES_PRODUCTS.ORIENTATION)
  const perception = build(THREE_RITES_PRODUCTS.PERCEPTION)
  const declaration = build(THREE_RITES_PRODUCTS.DECLARATION)

  let currentStage: RiteJourney['currentStage'] = 'none'
  if (declaration.isComplete) {
    currentStage = 'complete'
  } else if (declaration.hasAny || perception.isComplete) {
    currentStage = 'declaration'
  } else if (perception.hasAny || orientation.isComplete) {
    currentStage = 'perception'
  } else if (orientation.hasAny) {
    currentStage = 'orientation'
  }

  return { orientation, perception, declaration, currentStage }
}

export function riteStageLocked(
  stage: RiteStage,
  journey: RiteJourney
): boolean {
  if (stage === 'orientation') return false
  if (stage === 'perception') return !journey.orientation.hasAny
  if (stage === 'declaration') return !journey.perception.hasAny
  return false
}
