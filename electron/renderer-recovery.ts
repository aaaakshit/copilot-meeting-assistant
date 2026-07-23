export type RendererExitReason =
  | 'clean-exit'
  | 'abnormal-exit'
  | 'killed'
  | 'crashed'
  | 'oom'
  | 'memory-eviction'
  | 'launch-failed'
  | 'integrity-failure'

export class RendererRecoveryPolicy {
  private attempts = 0

  constructor(private readonly maxAttempts = 1) {}

  shouldRecover(reason: RendererExitReason): boolean {
    if (reason === 'clean-exit' || reason === 'killed') return false
    if (this.attempts >= this.maxAttempts) return false

    this.attempts += 1
    return true
  }

  get attemptCount(): number {
    return this.attempts
  }
}
