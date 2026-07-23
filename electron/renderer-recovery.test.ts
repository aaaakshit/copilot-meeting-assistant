import { describe, expect, it } from 'vitest'
import { RendererRecoveryPolicy } from './renderer-recovery.js'

describe('RendererRecoveryPolicy', () => {
  it('allows one controlled recovery for a renderer crash', () => {
    const policy = new RendererRecoveryPolicy()

    expect(policy.shouldRecover('crashed')).toBe(true)
    expect(policy.shouldRecover('crashed')).toBe(false)
    expect(policy.attemptCount).toBe(1)
  })

  it('does not recover expected renderer exits', () => {
    const policy = new RendererRecoveryPolicy()

    expect(policy.shouldRecover('clean-exit')).toBe(false)
    expect(policy.shouldRecover('killed')).toBe(false)
    expect(policy.attemptCount).toBe(0)
  })

  it('supports an explicit recovery budget', () => {
    const policy = new RendererRecoveryPolicy(2)

    expect(policy.shouldRecover('launch-failed')).toBe(true)
    expect(policy.shouldRecover('memory-eviction')).toBe(true)
    expect(policy.shouldRecover('integrity-failure')).toBe(false)
  })
})
