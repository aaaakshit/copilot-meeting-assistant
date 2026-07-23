import type {
  AnswerRequest,
  HealthResponse,
} from './contracts.js'

export interface ScreenAttachment {
  data: string
  mimeType: 'image/jpeg' | 'image/png'
  displayName: string
}

export interface DesktopGenerateRequest {
  requestId: string
  request: AnswerRequest
  screen?: ScreenAttachment
}

export interface AnswerDeltaPayload {
  requestId: string
  content: string
}

export interface ModelProgressPayload {
  status: 'loading' | 'downloading' | 'ready'
  file?: string
  progress?: number
}

export interface TranscriptionResult {
  text: string
  inferenceMs: number
}

export interface DesktopRuntimeInfo {
  platform: 'win32' | 'darwin' | 'linux' | 'other'
  appVersion: string
  alwaysOnTop: boolean
}

export type DesktopShortcut = 'toggle-overlay' | 'answer-screen'

export interface DesktopBridge {
  readonly isDesktop: true
  getCopilotStatus(): Promise<HealthResponse>
  getRuntimeInfo(): Promise<DesktopRuntimeInfo>
  generateAnswer(payload: DesktopGenerateRequest): Promise<void>
  abortAnswer(requestId: string): Promise<void>
  transcribeAudio(samples: ArrayBuffer): Promise<TranscriptionResult>
  minimizeWindow(): Promise<void>
  closeWindow(): Promise<void>
  toggleAlwaysOnTop(): Promise<boolean>
  onAnswerDelta(listener: (payload: AnswerDeltaPayload) => void): () => void
  onModelProgress(listener: (payload: ModelProgressPayload) => void): () => void
  onShortcut(listener: (shortcut: DesktopShortcut) => void): () => void
}
