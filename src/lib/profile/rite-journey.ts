import { THREE_RITES_PRODUCTS } from '@/lib/beta/constants'

export type RiteStage = 'perception' | 'orientation' | 'declaration'

/**
 * The Three Rites in canon order: Rite I Perception, Rite II Orientation,
 * Rite III Declaration. The one place that order is defined.
 */
export const RITE_STAGES: readonly { key: RiteStage; roman: string; label: string; products: readonly string[] }[] = [
  { key: 'perception', roman: 'I', label: 'Perception', products: THREE_RITES_PRODUCTS.PERCEPTION },
  { key: 'orientation', roman: 'II', label: 'Orientation', products: THREE_RITES_PRODUCTS.ORIENTATION },
  { key: 'declaration', roman: 'III', label: 'Declaration', products: THREE_RITES_PRODUCTS.DECLARATION },
]

export interface RiteStatus {
  completed: string[]
  total: number
  isComplete: boolean
  hasAny: boolean
}

export type RiteJourney = Record<RiteStage, RiteStatus> & {
  currentStage: RiteStage | 'complete' | 'none'
}

export function computeRiteJourney(
  accessRows: { product_slug: string; completed_at: string | null }[]
): RiteJourney {
  const completedSlugs = new Set(
    accessRows.filter((r) => r.completed_at != null).map((r) => r.product_slug)
  )

  const status = (slugs: readonly string[]): RiteStatus => {
    const completed = slugs.filter((s) => completedSlugs.has(s))
    return {
      completed,
      total: slugs.length,
      isComplete: completed.length === slugs.length,
      hasAny: completed.length > 0,
    }
  }

  const statuses = Object.fromEntries(RITE_STAGES.map((r) => [r.key, status(r.products)])) as Record<RiteStage, RiteStatus>

  // The current stage is the latest Rite that's started, or the one after the
  // last Rite completed. 'none' until anything is done.
  let currentStage: RiteJourney['currentStage'] = 'none'
  RITE_STAGES.forEach(({ key }, i) => {
    const next = RITE_STAGES[i + 1]?.key
    if (statuses[key].hasAny) currentStage = key
    if (statuses[key].isComplete) currentStage = next ?? 'complete'
  })

  return { ...statuses, currentStage }
}

/** A Rite opens once the Rite before it has been started. Rite I is always open. */
export function riteStageLocked(stage: RiteStage, journey: RiteJourney): boolean {
  const i = RITE_STAGES.findIndex((r) => r.key === stage)
  return i > 0 && !journey[RITE_STAGES[i - 1].key].hasAny
}
