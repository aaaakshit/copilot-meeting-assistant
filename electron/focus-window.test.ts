import { describe, expect, it } from 'vitest'
import {
  areBoundsEquivalent,
  calculateFocusBounds,
  clampBoundsToWorkArea,
} from './focus-window.js'

describe('calculateFocusBounds', () => {
  it('uses the right third of a standard work area at full height', () => {
    expect(
      calculateFocusBounds({ x: 0, y: 0, width: 1920, height: 1040 }),
    ).toEqual({
      x: 1280,
      y: 0,
      width: 640,
      height: 1040,
    })
  })

  it('honors the usable minimum width on a smaller display', () => {
    expect(
      calculateFocusBounds({ x: -1366, y: 20, width: 1366, height: 728 }),
    ).toEqual({
      x: -455,
      y: 20,
      width: 455,
      height: 728,
    })
  })
})

describe('clampBoundsToWorkArea', () => {
  it('restores an off-screen window inside the current work area', () => {
    expect(
      clampBoundsToWorkArea(
        { x: 4000, y: -500, width: 570, height: 820 },
        { x: 0, y: 0, width: 1920, height: 1040 },
      ),
    ).toEqual({
      x: 1350,
      y: 0,
      width: 570,
      height: 820,
    })
  })

  describe('areBoundsEquivalent', () => {
    it('allows one-pixel native window rounding', () => {
      expect(
        areBoundsEquivalent(
          { x: 482, y: 0, width: 573, height: 816 },
          { x: 482, y: 0, width: 574, height: 816 },
        ),
      ).toBe(true)
    })

    it('rejects a materially different restored window', () => {
      expect(
        areBoundsEquivalent(
          { x: 482, y: 0, width: 573, height: 816 },
          { x: 482, y: 0, width: 600, height: 816 },
        ),
      ).toBe(false)
    })
  })
})
