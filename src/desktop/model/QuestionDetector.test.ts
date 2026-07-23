import { describe, expect, it } from 'vitest'
import {
  appendTranscript,
  cleanTranscript,
  extractInterviewQuestion,
  looksLikeInterviewQuestion,
  RollingQuestionDetector,
} from './QuestionDetector'

describe('question detection', () => {
  it('detects common interview prompts without punctuation', () => {
    expect(
      looksLikeInterviewQuestion(
        'Tell me about a difficult technical decision you made',
      ),
    ).toBe(true)
    expect(
      looksLikeInterviewQuestion('How do you prioritize competing deadlines'),
    ).toBe(true)
    expect(looksLikeInterviewQuestion('What is polymorphism')).toBe(true)
    expect(
      looksLikeInterviewQuestion(
        'Thanks for that, could you tell us about a production incident',
      ),
    ).toBe(true)
  })

  it('ignores short acknowledgements and Whisper silence markers', () => {
    expect(looksLikeInterviewQuestion('Thank you.')).toBe(false)
    expect(looksLikeInterviewQuestion('How are you')).toBe(false)
    expect(looksLikeInterviewQuestion('Can you hear me?')).toBe(false)
    expect(cleanTranscript('[BLANK_AUDIO]')).toBe('')
  })

  it('does not append duplicate transcript segments', () => {
    expect(appendTranscript('How do you test code?', 'How do you test code?')).toBe(
      'How do you test code?',
    )
  })

  it('assembles questions split across Whisper segments', () => {
    const detector = new RollingQuestionDetector()

    expect(detector.push('Could you tell me')).toBeNull()
    expect(detector.push('about a difficult project you led')).toBe(
      'Could you tell me about a difficult project you led',
    )
  })

  it('recognizes coding prompts only in coding mode', () => {
    const prompt =
      'Given an array of integers return the indices of two values that sum to a target'

    expect(extractInterviewQuestion(prompt, 'general')).toBeNull()
    expect(extractInterviewQuestion(prompt, 'coding')).toBe(prompt)
  })

  it('ignores ordinary statements and recent duplicate questions', () => {
    const detector = new RollingQuestionDetector()

    expect(detector.push('We will spend the next hour discussing the role')).toBeNull()
    expect(detector.push('How do you review production changes', 1_000)).toBe(
      'How do you review production changes',
    )
    expect(detector.push('How do you review production changes', 2_000)).toBeNull()
    expect(detector.push('How do you review production changes', 50_000)).toBe(
      'How do you review production changes',
    )
  })

  it('clears partial speech when the interview mode changes', () => {
    const detector = new RollingQuestionDetector()

    expect(detector.push('Could you tell me')).toBeNull()
    detector.setMode('coding')
    expect(detector.push('about a project you led')).toBeNull()
    expect(
      detector.push(
        'Implement a function that returns the first repeated character',
      ),
    ).toBe('Implement a function that returns the first repeated character')
  })
})
