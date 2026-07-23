import { env, pipeline } from '@huggingface/transformers'
import type {
  AutomaticSpeechRecognitionOutput,
  AutomaticSpeechRecognitionPipeline,
  ProgressInfo,
} from '@huggingface/transformers'
import type {
  ModelProgressPayload,
  TranscriptionResult,
} from '../shared/desktop-contracts.js'

const MODEL_ID = 'Xenova/whisper-tiny.en'
const MAX_AUDIO_SAMPLES = 16_000 * 30

export class LocalTranscriber {
  private transcriberPromise:
    | Promise<AutomaticSpeechRecognitionPipeline>
    | undefined

  constructor(
    cacheDirectory: string,
    private readonly onProgress: (progress: ModelProgressPayload) => void,
  ) {
    env.cacheDir = cacheDirectory
    env.allowRemoteModels = true
    env.allowLocalModels = true
  }

  async transcribe(samples: Float32Array): Promise<TranscriptionResult> {
    if (samples.length === 0 || samples.length > MAX_AUDIO_SAMPLES) {
      throw new Error('Audio segments must be between 1 sample and 30 seconds.')
    }

    const transcriber = await this.getTranscriber()
    const startedAt = performance.now()
    const output = await transcriber(samples, {
      return_timestamps: false,
    })

    return {
      text: readTranscriptionText(output).trim(),
      inferenceMs: Math.round(performance.now() - startedAt),
    }
  }

  private getTranscriber(): Promise<AutomaticSpeechRecognitionPipeline> {
    if (!this.transcriberPromise) {
      this.onProgress({ status: 'loading' })
      this.transcriberPromise = pipeline(
        'automatic-speech-recognition',
        MODEL_ID,
        {
          progress_callback: (progress) => {
            this.onProgress(normalizeProgress(progress))
          },
        },
      ).catch((error: unknown) => {
        this.transcriberPromise = undefined
        throw error
      })
    }

    return this.transcriberPromise
  }
}

function readTranscriptionText(
  output:
    | AutomaticSpeechRecognitionOutput
    | AutomaticSpeechRecognitionOutput[],
): string {
  return Array.isArray(output)
    ? output.map((item) => item.text).join(' ')
    : output.text
}

function normalizeProgress(progress: ProgressInfo): ModelProgressPayload {
  switch (progress.status) {
    case 'progress':
      return {
        status: 'downloading',
        file: progress.file,
        progress: Math.round(progress.progress),
      }
    case 'ready':
      return { status: 'ready' }
    default:
      return {
        status: 'loading',
        file: 'file' in progress ? progress.file : undefined,
      }
  }
}
