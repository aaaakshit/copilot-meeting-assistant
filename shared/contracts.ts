export type AnswerLength = 'concise' | 'standard' | 'detailed'

export type AnswerTone = 'conversational' | 'confident' | 'technical'

export type InterviewMode = 'general' | 'coding'

export type CodingLanguage =
  | 'auto'
  | 'typescript'
  | 'javascript'
  | 'python'
  | 'java'
  | 'csharp'
  | 'cpp'
  | 'go'
  | 'rust'
  | 'sql'

export interface CandidateContext {
  targetRole: string
  resumeHighlights: string
  jobDescription: string
  evidence: string
}

export interface AnswerPreferences {
  length: AnswerLength
  tone: AnswerTone
}

export interface AnswerRequest {
  question: string
  context: CandidateContext
  preferences: AnswerPreferences
  mode?: InterviewMode
  codingLanguage?: CodingLanguage
}

export interface HealthResponse {
  status: 'ready' | 'needs-auth' | 'unavailable'
  authenticated: boolean
  model: string
  message: string
  login?: string
  runtimeVersion?: string
}

export type AnswerStreamEvent =
  | { type: 'meta'; model: string }
  | { type: 'delta'; content: string }
  | { type: 'done' }
  | { type: 'error'; message: string }
