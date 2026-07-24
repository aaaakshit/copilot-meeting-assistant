import { describe, expect, it } from 'vitest'
import { GenerationGate } from './GenerationGate'

describe('GenerationGate', () => {
  it('invalidates work that was waiting when Stop is selected', () => {
    const gate = new GenerationGate()
    const pendingGeneration = gate.begin()

    gate.cancel()

    expect(gate.isCurrent(pendingGeneration)).toBe(false)
  })

  it('accepts only the latest overlapping generation', () => {
    const gate = new GenerationGate()
    const first = gate.begin()
    const second = gate.begin()

    expect(gate.isCurrent(first)).toBe(false)
    expect(gate.isCurrent(second)).toBe(true)
  })
})
