import {
  CornerDownLeft,
  Mic,
  MicOff,
  Send,
  Square,
} from 'lucide-react'
import type {
  AnswerPreferences,
  AnswerLength,
  AnswerTone,
} from '../../shared/contracts'
import { useSpeechRecognition } from '../lib/useSpeechRecognition'

const sampleQuestions = [
  'Tell me about yourself.',
  'Describe a difficult technical decision.',
  'Why are you interested in this role?',
]

interface QuestionComposerProps {
  question: string
  onQuestionChange: (question: string) => void
  preferences: AnswerPreferences
  onPreferencesChange: (preferences: AnswerPreferences) => void
  isGenerating: boolean
  canGenerate: boolean
  hasEvidence: boolean
  serviceReady: boolean
  onGenerate: () => void
  onStop: () => void
}

export function QuestionComposer({
  question,
  onQuestionChange,
  preferences,
  onPreferencesChange,
  isGenerating,
  canGenerate,
  hasEvidence,
  serviceReady,
  onGenerate,
  onStop,
}: QuestionComposerProps) {
  const speech = useSpeechRecognition(onQuestionChange)

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (canGenerate) onGenerate()
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter' && canGenerate) {
      event.preventDefault()
      onGenerate()
    }
  }

  const disabledReason = !serviceReady
    ? 'Connect GitHub Copilot to generate.'
    : !hasEvidence
      ? 'Add resume highlights or an evidence story first.'
      : question.trim().length < 3
        ? 'Enter the interview question.'
        : ''

  return (
    <form className="question-card" onSubmit={submit}>
      <div className="panel-heading question-heading">
        <div>
          <p className="section-kicker">Step 2</p>
          <h2>Capture the question</h2>
        </div>
        <span className="shortcut">
          <CornerDownLeft size={13} aria-hidden="true" />
          Ctrl/⌘ + Enter
        </span>
      </div>

      <div className={`question-input-wrap ${speech.isListening ? 'is-listening' : ''}`}>
        <textarea
          value={question}
          rows={4}
          maxLength={2_000}
          placeholder="Type the interviewer’s question here..."
          aria-label="Interview question"
          onChange={(event) => onQuestionChange(event.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          className={`mic-button ${speech.isListening ? 'mic-active' : ''}`}
          type="button"
          disabled={!speech.supported || isGenerating}
          aria-label={speech.isListening ? 'Stop listening' : 'Capture question by voice'}
          title={
            speech.supported
              ? 'Use browser speech recognition'
              : 'Speech recognition is unavailable in this browser'
          }
          onClick={speech.isListening ? speech.stop : speech.start}
        >
          {speech.isListening ? (
            <MicOff size={18} aria-hidden="true" />
          ) : (
            <Mic size={18} aria-hidden="true" />
          )}
        </button>
      </div>

      <div className="question-meta">
        <span>
          {speech.isListening
            ? 'Listening… speak the complete question.'
            : speech.error || 'Voice capture depends on your browser.'}
        </span>
        <span>{question.length}/2,000</span>
      </div>

      <div className="sample-questions" aria-label="Example questions">
        {sampleQuestions.map((sample) => (
          <button
            type="button"
            key={sample}
            disabled={isGenerating}
            onClick={() => onQuestionChange(sample)}
          >
            {sample}
          </button>
        ))}
      </div>

      <div className="composer-footer">
        <div className="preference-controls">
          <label>
            <span>Length</span>
            <select
              value={preferences.length}
              disabled={isGenerating}
              onChange={(event) =>
                onPreferencesChange({
                  ...preferences,
                  length: event.target.value as AnswerLength,
                })
              }
            >
              <option value="concise">Concise</option>
              <option value="standard">Standard</option>
              <option value="detailed">Detailed</option>
            </select>
          </label>
          <label>
            <span>Tone</span>
            <select
              value={preferences.tone}
              disabled={isGenerating}
              onChange={(event) =>
                onPreferencesChange({
                  ...preferences,
                  tone: event.target.value as AnswerTone,
                })
              }
            >
              <option value="conversational">Conversational</option>
              <option value="confident">Confident</option>
              <option value="technical">Technical</option>
            </select>
          </label>
        </div>

        {isGenerating ? (
          <button className="stop-button" type="button" onClick={onStop}>
            <Square size={15} fill="currentColor" aria-hidden="true" />
            Stop
          </button>
        ) : (
          <button
            className="primary-button"
            type="submit"
            disabled={!canGenerate}
            title={disabledReason}
          >
            Generate answer
            <Send size={16} aria-hidden="true" />
          </button>
        )}
      </div>
    </form>
  )
}
