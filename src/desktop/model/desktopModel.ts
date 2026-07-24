import type { CSSProperties } from 'react'
import type {
  AnswerPreferences,
  CandidateContext,
  CodingLanguage,
  HealthResponse,
  InterviewMode,
} from '../../../shared/contracts'
import type { ModelProgressPayload } from '../../../shared/desktop-contracts'

export type DesktopPage = 'live' | 'profile'
export type CaptureState = 'idle' | 'starting' | 'listening' | 'error'
export type AnswerState =
  | 'idle'
  | 'capturing'
  | 'generating'
  | 'complete'
  | 'error'

export interface DesktopStyle extends CSSProperties {
  '--overlay-alpha': string
  '--panel-alpha': string
}

export interface CodingLanguageOption {
  value: CodingLanguage
  label: string
}

export interface DesktopViewModel {
  page: DesktopPage
  context: CandidateContext
  preferences: AnswerPreferences
  autoAnswer: boolean
  interviewMode: InterviewMode
  codingLanguage: CodingLanguage
  codingLanguages: CodingLanguageOption[]
  health: HealthResponse | null
  runtimeReady: boolean
  alwaysOnTop: boolean
  focusMode: boolean
  showAppearance: boolean
  glassLevel: number
  style: DesktopStyle
  captureState: CaptureState
  captureError: string
  audioLevel: number
  transcript: string
  latestTranscript: string
  question: string
  answer: string
  answerWords: number
  answerState: AnswerState
  answerError: string
  screenAttached: boolean
  modelProgress: ModelProgressPayload | null
  transcribing: boolean
  copied: boolean
  hasEvidence: boolean
  canGenerate: boolean
  modeSwitchDisabled: boolean
}

export interface DesktopActions {
  setPage(page: DesktopPage): void
  toggleAppearance(): void
  setGlassLevel(level: number): void
  toggleAlwaysOnTop(): Promise<void>
  minimizeWindow(): Promise<void>
  closeWindow(): Promise<void>
  refreshStatus(): Promise<void>
  selectInterviewMode(mode: InterviewMode): void
  setCodingLanguage(language: CodingLanguage): void
  startCapture(): Promise<void>
  stopCapture(): Promise<void>
  answerFromScreen(): Promise<void>
  setAutoAnswer(enabled: boolean): void
  useLatestTranscript(): void
  setQuestion(question: string): void
  generateAnswer(): Promise<void>
  stopAnswer(): Promise<void>
  copyAnswer(): Promise<void>
  clearAnswer(): void
  setContext(context: CandidateContext): void
  setPreferences(preferences: AnswerPreferences): void
  loadDemo(): void
  saveProfile(): void
}

export interface DesktopPresenter {
  model: DesktopViewModel
  actions: DesktopActions
}

export const SCREEN_QUESTIONS: Record<InterviewMode, string> = {
  general:
    'Read the attached meeting screen, identify the most prominent interview question currently visible, and answer it. If no question is visible, say that clearly.',
  coding:
    'Read the attached meeting screen, identify the coding problem, constraints, examples, and requested language, then solve it. State any missing assumptions clearly.',
}

export const CODING_LANGUAGES: CodingLanguageOption[] = [
  { value: 'auto', label: 'Auto-detect' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'csharp', label: 'C#' },
  { value: 'cpp', label: 'C++' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'sql', label: 'SQL' },
]

export function hasCandidateEvidence(context: CandidateContext): boolean {
  return Boolean(
    context.resumeHighlights.trim() || context.evidence.trim(),
  )
}

export function canAnswerInMode(
  mode: InterviewMode,
  context: CandidateContext,
): boolean {
  return mode === 'coding' || hasCandidateEvidence(context)
}

export function createDesktopStyle(glassLevel: number): {
  level: number
  style: DesktopStyle
} {
  const level = Math.min(98, Math.max(30, glassLevel))
  return {
    level,
    style: {
      '--overlay-alpha': String(level / 100),
      '--panel-alpha': String(Math.min(1, (level + 10) / 100)),
    },
  }
}

export function errorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback
  return error.message.replace(
    /^Error invoking remote method '[^']+': Error: /,
    '',
  )
}
