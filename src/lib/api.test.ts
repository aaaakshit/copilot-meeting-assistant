import { describe, expect, it } from 'vitest'
import { parseAnswerStreamLine } from './api'

describe('parseAnswerStreamLine', () => {
  it('parses supported answer stream events', () => {
    expect(
      parseAnswerStreamLine('{"type":"delta","content":"Hello"}'),
    ).toEqual({
      type: 'delta',
      content: 'Hello',
    })
    expect(parseAnswerStreamLine('{"type":"done"}')).toEqual({ type: 'done' })
  })

  it('rejects malformed and unknown events', () => {
    expect(() => parseAnswerStreamLine('{"type":"delta"}')).toThrow(
      'unsupported stream event',
    )
    expect(() => parseAnswerStreamLine('[]')).toThrow('invalid stream event')
  })
})
