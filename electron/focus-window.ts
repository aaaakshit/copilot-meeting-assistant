export interface WindowRectangle {
  x: number
  y: number
  width: number
  height: number
}

const DEFAULT_MINIMUM_WIDTH = 430

export function calculateFocusBounds(
  workArea: WindowRectangle,
  minimumWidth = DEFAULT_MINIMUM_WIDTH,
): WindowRectangle {
  const width = Math.min(
    workArea.width,
    Math.max(minimumWidth, Math.round(workArea.width / 3)),
  )

  return {
    x: workArea.x + workArea.width - width,
    y: workArea.y,
    width,
    height: workArea.height,
  }
}

export function clampBoundsToWorkArea(
  bounds: WindowRectangle,
  workArea: WindowRectangle,
): WindowRectangle {
  const width = Math.min(bounds.width, workArea.width)
  const height = Math.min(bounds.height, workArea.height)

  return {
    x: clamp(bounds.x, workArea.x, workArea.x + workArea.width - width),
    y: clamp(bounds.y, workArea.y, workArea.y + workArea.height - height),
    width,
    height,
  }
}

export function areBoundsEquivalent(
  expected: WindowRectangle,
  actual: WindowRectangle,
  tolerance = 1,
): boolean {
  return (
    Math.abs(expected.x - actual.x) <= tolerance &&
    Math.abs(expected.y - actual.y) <= tolerance &&
    Math.abs(expected.width - actual.width) <= tolerance &&
    Math.abs(expected.height - actual.height) <= tolerance
  )
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}
