import type { ScreenAttachment } from '../../../shared/desktop-contracts'

const TARGET_SAMPLE_RATE = 16_000

export interface SystemCaptureCallbacks {
  onAudioSegment: (samples: Float32Array) => void
  onLevel: (level: number) => void
  onEnded: () => void
}

export class SystemCapture {
  private readonly callbacks: SystemCaptureCallbacks
  private stream: MediaStream | null = null
  private audioContext: AudioContext | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private processor: ScriptProcessorNode | null = null
  private silentSink: GainNode | null = null
  private video: HTMLVideoElement | null = null
  private segmenter: SpeechSegmenter | null = null
  private stopping = false

  constructor(callbacks: SystemCaptureCallbacks) {
    this.callbacks = callbacks
  }

  get active(): boolean {
    return this.stream !== null
  }

  async start(): Promise<void> {
    if (this.stream) return

    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        width: { ideal: 1_920 },
        height: { ideal: 1_080 },
        frameRate: { ideal: 5, max: 10 },
      },
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    })

    if (stream.getAudioTracks().length === 0) {
      for (const track of stream.getTracks()) track.stop()
      throw new Error(
        'System audio was not available. On Windows, play the interview through the default output device and retry.',
      )
    }

    this.stream = stream
    this.video = document.createElement('video')
    this.video.srcObject = stream
    this.video.muted = true
    this.video.playsInline = true
    await this.video.play()

    const AudioContextClass =
      window.AudioContext ||
      (
        window as Window & {
          webkitAudioContext?: typeof AudioContext
        }
      ).webkitAudioContext

    if (!AudioContextClass) {
      await this.stop()
      throw new Error('Web Audio is unavailable in this desktop runtime.')
    }

    this.audioContext = new AudioContextClass({ latencyHint: 'interactive' })
    await this.audioContext.resume()
    this.segmenter = new SpeechSegmenter(
      this.audioContext.sampleRate,
      this.callbacks.onAudioSegment,
    )
    this.source = this.audioContext.createMediaStreamSource(stream)
    this.processor = this.audioContext.createScriptProcessor(4_096, 2, 1)
    this.silentSink = this.audioContext.createGain()
    this.silentSink.gain.value = 0

    this.processor.onaudioprocess = (event) => {
      const samples = mixToMono(event.inputBuffer)
      this.callbacks.onLevel(Math.min(1, rootMeanSquare(samples) * 18))
      this.segmenter?.process(samples)
    }

    this.source.connect(this.processor)
    this.processor.connect(this.silentSink)
    this.silentSink.connect(this.audioContext.destination)

    for (const track of stream.getTracks()) {
      track.addEventListener('ended', () => {
        if (!this.stopping) void this.stop()
      })
    }
  }

  async captureScreen(): Promise<ScreenAttachment> {
    if (!this.video || !this.stream) {
      throw new Error('Start screen capture before reading the screen.')
    }

    await waitForVideoFrame(this.video)
    const maxWidth = 1_600
    const scale = Math.min(1, maxWidth / this.video.videoWidth)
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(this.video.videoWidth * scale))
    canvas.height = Math.max(1, Math.round(this.video.videoHeight * scale))
    const context = canvas.getContext('2d', { alpha: false })

    if (!context) {
      throw new Error('Could not create a screen capture canvas.')
    }

    context.drawImage(this.video, 0, 0, canvas.width, canvas.height)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.76)
    const data = dataUrl.split(',')[1]

    if (!data) throw new Error('Screen capture returned no image data.')

    return {
      data,
      mimeType: 'image/jpeg',
      displayName: 'current-interview-screen.jpg',
    }
  }

  async stop(): Promise<void> {
    if (this.stopping) return
    this.stopping = true

    this.segmenter?.flush()
    this.processor?.disconnect()
    this.source?.disconnect()
    this.silentSink?.disconnect()
    for (const track of this.stream?.getTracks() ?? []) track.stop()

    if (this.audioContext && this.audioContext.state !== 'closed') {
      await this.audioContext.close()
    }
    if (this.video) this.video.srcObject = null

    this.stream = null
    this.audioContext = null
    this.source = null
    this.processor = null
    this.silentSink = null
    this.video = null
    this.segmenter = null
    this.stopping = false
    this.callbacks.onLevel(0)
    this.callbacks.onEnded()
  }
}

export class SpeechSegmenter {
  private readonly sampleRate: number
  private readonly onSegment: (samples: Float32Array) => void
  private readonly threshold = 0.009
  private readonly silenceLimit: number
  private readonly maxSegmentLength: number
  private readonly minVoicedSamples: number
  private readonly preRollLimit: number
  private preRoll: Float32Array[] = []
  private preRollSamples = 0
  private chunks: Float32Array[] = []
  private totalSamples = 0
  private voicedSamples = 0
  private silentSamples = 0
  private speaking = false

  constructor(
    sampleRate: number,
    onSegment: (samples: Float32Array) => void,
  ) {
    this.sampleRate = sampleRate
    this.onSegment = onSegment
    this.silenceLimit = Math.round(sampleRate * 0.9)
    this.maxSegmentLength = Math.round(sampleRate * 18)
    this.minVoicedSamples = Math.round(sampleRate * 0.45)
    this.preRollLimit = Math.round(sampleRate * 0.25)
  }

  process(input: Float32Array): void {
    const samples = input.slice()
    const voiced = rootMeanSquare(samples) >= this.threshold

    if (!this.speaking) {
      this.pushPreRoll(samples)
      if (!voiced) return

      this.speaking = true
      this.chunks = this.preRoll
      this.totalSamples = this.preRollSamples
      this.voicedSamples = samples.length
      this.preRoll = []
      this.preRollSamples = 0
      return
    }

    this.chunks.push(samples)
    this.totalSamples += samples.length

    if (voiced) {
      this.voicedSamples += samples.length
      this.silentSamples = 0
    } else {
      this.silentSamples += samples.length
    }

    if (
      this.silentSamples >= this.silenceLimit ||
      this.totalSamples >= this.maxSegmentLength
    ) {
      this.finishSegment()
    }
  }

  flush(): void {
    if (this.speaking) this.finishSegment()
  }

  private pushPreRoll(samples: Float32Array): void {
    this.preRoll.push(samples)
    this.preRollSamples += samples.length

    while (
      this.preRollSamples > this.preRollLimit &&
      this.preRoll.length > 1
    ) {
      const removed = this.preRoll.shift()
      if (removed) this.preRollSamples -= removed.length
    }
  }

  private finishSegment(): void {
    if (this.voicedSamples >= this.minVoicedSamples) {
      const merged = concatenate(this.chunks, this.totalSamples)
      this.onSegment(
        resampleAudio(merged, this.sampleRate, TARGET_SAMPLE_RATE),
      )
    }

    this.chunks = []
    this.totalSamples = 0
    this.voicedSamples = 0
    this.silentSamples = 0
    this.speaking = false
  }
}

export function resampleAudio(
  input: Float32Array,
  inputRate: number,
  outputRate: number,
): Float32Array {
  if (inputRate === outputRate) return input.slice()
  if (input.length === 0) return new Float32Array()

  const outputLength = Math.max(
    1,
    Math.round((input.length * outputRate) / inputRate),
  )
  const output = new Float32Array(outputLength)

  if (inputRate < outputRate) {
    const ratio = inputRate / outputRate
    for (let index = 0; index < outputLength; index += 1) {
      const position = index * ratio
      const lower = Math.floor(position)
      const upper = Math.min(input.length - 1, lower + 1)
      const mix = position - lower
      output[index] = input[lower]! * (1 - mix) + input[upper]! * mix
    }
    return output
  }

  const ratio = inputRate / outputRate
  for (let index = 0; index < outputLength; index += 1) {
    const start = Math.floor(index * ratio)
    const end = Math.min(input.length, Math.floor((index + 1) * ratio))
    let sum = 0
    for (let sourceIndex = start; sourceIndex < end; sourceIndex += 1) {
      sum += input[sourceIndex]!
    }
    output[index] = end > start ? sum / (end - start) : input[start] ?? 0
  }

  return output
}

function mixToMono(buffer: AudioBuffer): Float32Array {
  const mono = new Float32Array(buffer.length)
  const channelCount = Math.max(1, buffer.numberOfChannels)

  for (let channel = 0; channel < channelCount; channel += 1) {
    const source = buffer.getChannelData(channel)
    for (let index = 0; index < buffer.length; index += 1) {
      mono[index] = (mono[index] ?? 0) + source[index]! / channelCount
    }
  }

  return mono
}

function rootMeanSquare(samples: Float32Array): number {
  let sum = 0
  for (const sample of samples) sum += sample * sample
  return Math.sqrt(sum / Math.max(1, samples.length))
}

function concatenate(
  chunks: Float32Array[],
  totalLength: number,
): Float32Array {
  const result = new Float32Array(totalLength)
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.length
  }
  return result
}

async function waitForVideoFrame(video: HTMLVideoElement): Promise<void> {
  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth) {
    return
  }

  await new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(
      () => reject(new Error('Timed out waiting for a screen frame.')),
      5_000,
    )
    video.addEventListener(
      'loadeddata',
      () => {
        window.clearTimeout(timeout)
        resolve()
      },
      { once: true },
    )
  })
}
