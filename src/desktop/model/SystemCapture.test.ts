import { describe, expect, it } from 'vitest'
import { SpeechSegmenter, resampleAudio } from './SystemCapture'

describe('resampleAudio', () => {
  it('downsamples audio to the Whisper sample rate', () => {
    const input = Float32Array.from({ length: 48_000 }, (_, index) =>
      Math.sin((index / 48_000) * Math.PI * 440),
    )

    const output = resampleAudio(input, 48_000, 16_000)

    expect(output).toHaveLength(16_000)
    expect(output.some((sample) => sample !== 0)).toBe(true)
  })
})

describe('SpeechSegmenter', () => {
  it('emits one segment after speech followed by silence', () => {
    const segments: Float32Array[] = []
    const segmenter = new SpeechSegmenter(16_000, (samples) => {
      segments.push(samples)
    })

    for (let index = 0; index < 4; index += 1) {
      segmenter.process(new Float32Array(1_600))
    }
    for (let index = 0; index < 10; index += 1) {
      segmenter.process(new Float32Array(1_600).fill(0.08))
    }
    for (let index = 0; index < 10; index += 1) {
      segmenter.process(new Float32Array(1_600))
    }

    expect(segments).toHaveLength(1)
    expect(segments[0]!.length).toBeGreaterThan(16_000)
  })

  it('ignores short noise bursts', () => {
    const segments: Float32Array[] = []
    const segmenter = new SpeechSegmenter(16_000, (samples) => {
      segments.push(samples)
    })

    segmenter.process(new Float32Array(1_600).fill(0.08))
    for (let index = 0; index < 10; index += 1) {
      segmenter.process(new Float32Array(1_600))
    }

    expect(segments).toHaveLength(0)
  })
})
