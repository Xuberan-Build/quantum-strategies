import { describe, expect, it } from 'vitest'
import { RITE_STAGES, computeRiteJourney, riteStageLocked } from '../rite-journey'

const done = (...slugs: string[]) => slugs.map((product_slug) => ({ product_slug, completed_at: '2026-10-01T00:00:00Z' }))
const [P, O, D] = RITE_STAGES.map((r) => r.products)

describe('rite journey (canon: Perception, Orientation, Declaration)', () => {
  it('orders the Rites Perception, Orientation, Declaration', () => {
    expect(RITE_STAGES.map((r) => `${r.roman} ${r.label}`)).toEqual(['I Perception', 'II Orientation', 'III Declaration'])
  })

  it('moves through the stages in canon order', () => {
    expect(computeRiteJourney([]).currentStage).toBe('none')
    expect(computeRiteJourney(done(P[0])).currentStage).toBe('perception')
    expect(computeRiteJourney(done(...P)).currentStage).toBe('orientation')
    expect(computeRiteJourney(done(...P, O[0])).currentStage).toBe('orientation')
    expect(computeRiteJourney(done(...P, ...O)).currentStage).toBe('declaration')
    expect(computeRiteJourney(done(...P, ...O, ...D)).currentStage).toBe('complete')
  })

  it('opens each Rite once the one before it has started', () => {
    const fresh = computeRiteJourney([])
    expect(riteStageLocked('perception', fresh)).toBe(false)
    expect(riteStageLocked('orientation', fresh)).toBe(true)
    const started = computeRiteJourney(done(P[0]))
    expect(riteStageLocked('orientation', started)).toBe(false)
    expect(riteStageLocked('declaration', started)).toBe(true)
  })
})
