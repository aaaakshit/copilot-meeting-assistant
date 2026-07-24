import { describe, expect, it } from 'vitest'
import { CaptureSessionGate } from './CaptureSessionGate'

describe('CaptureSessionGate', () => {
  it('invalidates queued work immediately when capture stops', () => {
    const gate = new CaptureSessionGate()
    const session = gate.start()

    expect(gate.accepts(session)).toBe(true)
    gate.stop()
    expect(gate.accepts(session)).toBe(false)
  })

  it('does not accept work from an earlier capture session', () => {
    const gate = new CaptureSessionGate()
    const firstSession = gate.start()
    gate.stop()
    const secondSession = gate.start()

    expect(gate.accepts(firstSession)).toBe(false)
    expect(gate.accepts(secondSession)).toBe(true)
  })

  it('rejects flushed segments after capture has stopped', () => {
    const gate = new CaptureSessionGate()
    gate.start()
    gate.stop()

    expect(gate.accepts(gate.current())).toBe(false)
  })
})
