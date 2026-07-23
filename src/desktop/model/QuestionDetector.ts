import type { InterviewMode } from '../../../shared/contracts'

const generalPromptPattern =
  /^(?:(?:tell|show|give)\s+(?:me|us)\b|(?:walk|talk|take)\s+(?:me|us)\b|describe\b|explain\b|why\b|how\b|what\b|when\b|where\b|who\b|which\b|can\s+you\b|could\s+you\b|would\s+you\b|will\s+you\b|have\s+you\b|do\s+you\b|did\s+you\b|are\s+you\b|introduce\s+yourself\b|share\s+(?:an?\s+)?example\b|discuss\b|talk\s+about\b)/i

const codingPromptPattern =
  /^(?:write\b|implement\b|design\b|solve\b|find\b|reverse\b|build\b|create\b|debug\b|optimi[sz]e\b|given\b|suppose\b|imagine\b|develop\b|code\b|calculate\b|determine\b)/i

const leadInPattern =
  /^(?:(?:thanks for that|my next question is|let(?:'s| us) move on|thank you|okay|ok|so|well|now|next|please|alright|right|then|um|uh|and|but|great|good|thanks)[\s,;:.-]+)+/i

const incompleteEndingPattern =
  /\b(?:a|an|the|to|of|for|with|when|where|why|how|that|which|and|or|but|about|through|your|me|us|in|on|at|by|from|as|if|while|during)\s*$/i

const smallTalkPattern =
  /^(?:how are you|how(?:'s| is) it going|what(?:'s| is) up|can you hear me|could you hear me|do you hear me|are you ready(?: to (?:begin|start))?)\??$/i

const MAX_SEGMENTS = 4
const MAX_WORDS = 100
const DUPLICATE_WINDOW_MS = 45_000

export function cleanTranscript(value: string): string {
  return value
    .replace(/\[(?:blank_audio|music|silence)\]/gi, '')
    .replace(/\((?:silence|music|inaudible)\)/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function looksLikeInterviewQuestion(
  value: string,
  mode: InterviewMode = 'general',
): boolean {
  return extractInterviewQuestion(value, mode) !== null
}

export function extractInterviewQuestion(
  value: string,
  mode: InterviewMode = 'general',
): string | null {
  const text = cleanTranscript(value)
  if (!text) return null

  for (const window of candidateWindows(text)) {
    const candidate = window.replace(leadInPattern, '').trim()
    const words = candidate.split(/\s+/).filter(Boolean)
    if (words.length < 3 || words.length > MAX_WORDS) continue
    if (smallTalkPattern.test(candidate)) continue

    const recognizedPrompt =
      generalPromptPattern.test(candidate) ||
      (mode === 'coding' && codingPromptPattern.test(candidate))
    if (!candidate.endsWith('?') && !recognizedPrompt) continue
    if (!candidate.endsWith('?') && incompleteEndingPattern.test(candidate)) {
      continue
    }

    return candidate
  }

  return null
}

export function appendTranscript(current: string, next: string): string {
  const cleaned = cleanTranscript(next)
  if (!cleaned) return current

  const normalizedCurrent = current.trim().toLowerCase()
  if (normalizedCurrent.endsWith(cleaned.toLowerCase())) return current
  return current.trim() ? `${current.trim()}\n${cleaned}` : cleaned
}

export class RollingQuestionDetector {
  private mode: InterviewMode
  private segments: string[] = []
  private lastQuestionKey = ''
  private lastQuestionAt = 0

  constructor(mode: InterviewMode = 'general') {
    this.mode = mode
  }

  setMode(mode: InterviewMode): void {
    if (mode === this.mode) return
    this.mode = mode
    this.segments = []
  }

  push(value: string, now = Date.now()): string | null {
    const segment = cleanTranscript(value)
    if (!segment) return null

    this.segments.push(segment)
    this.segments = this.segments.slice(-MAX_SEGMENTS)

    for (let start = this.segments.length - 1; start >= 0; start -= 1) {
      const question = extractInterviewQuestion(
        this.segments.slice(start).join(' '),
        this.mode,
      )
      if (!question) continue

      this.segments = []
      const key = normalizeQuestionKey(question)
      if (
        key === this.lastQuestionKey &&
        now - this.lastQuestionAt < DUPLICATE_WINDOW_MS
      ) {
        return null
      }

      this.lastQuestionKey = key
      this.lastQuestionAt = now
      return question
    }

    return null
  }

  reset(): void {
    this.segments = []
  }
}

function candidateWindows(text: string): string[] {
  const windows = [text]
  const boundaryPattern = /[.!?]\s+/g
  let match: RegExpExecArray | null

  while ((match = boundaryPattern.exec(text))) {
    const suffix = text.slice(match.index + match[0].length).trim()
    if (suffix) windows.unshift(suffix)
  }

  return windows
}

function normalizeQuestionKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}
