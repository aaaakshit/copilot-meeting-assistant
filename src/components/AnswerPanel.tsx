import { useMemo, useState } from 'react'
import { Check, Clipboard, RotateCcw, ShieldCheck, Sparkles } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

interface AnswerPanelProps {
  answer: string
  phase: 'idle' | 'generating' | 'complete' | 'error'
  error: string
  model: string
  onClear: () => void
}

export function AnswerPanel({
  answer,
  phase,
  error,
  model,
  onClear,
}: AnswerPanelProps) {
  const [copied, setCopied] = useState(false)
  const wordCount = useMemo(
    () => answer.trim().split(/\s+/).filter(Boolean).length,
    [answer],
  )

  const copyAnswer = async () => {
    try {
      await navigator.clipboard.writeText(answer)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1_800)
    } catch (copyError) {
      console.error('Could not copy the answer.', copyError)
    }
  }

  return (
    <section className="answer-card" aria-live="polite" aria-busy={phase === 'generating'}>
      <div className="answer-toolbar">
        <div>
          <p className="section-kicker">Step 3</p>
          <h2>Copilot answer</h2>
        </div>
        {answer && (
          <div className="answer-actions">
            <span className="answer-stat">{wordCount} words</span>
            <button type="button" onClick={() => void copyAnswer()}>
              {copied ? (
                <Check size={15} aria-hidden="true" />
              ) : (
                <Clipboard size={15} aria-hidden="true" />
              )}
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button type="button" onClick={onClear}>
              <RotateCcw size={15} aria-hidden="true" />
              Clear
            </button>
          </div>
        )}
      </div>

      {phase === 'idle' && !answer && (
        <div className="answer-empty">
          <span className="empty-icon">
            <ShieldCheck size={26} aria-hidden="true" />
          </span>
          <h3>Your grounded answer will appear here</h3>
          <p>
            Copilot will separate the speakable answer from its evidence and
            flag anything your context cannot support.
          </p>
          <div className="answer-features">
            <span>Speakable draft</span>
            <span>Evidence map</span>
            <span>Honesty check</span>
          </div>
        </div>
      )}

      {phase === 'generating' && !answer && (
        <div className="answer-loading">
          <div className="loading-label">
            <Sparkles className="sparkle-pulse" size={17} aria-hidden="true" />
            Copilot is grounding your response
          </div>
          <div className="skeleton-line skeleton-wide" />
          <div className="skeleton-line" />
          <div className="skeleton-line skeleton-short" />
          <div className="skeleton-block" />
        </div>
      )}

      {answer && (
        <div className={`answer-content ${phase === 'generating' ? 'is-streaming' : ''}`}>
          <ReactMarkdown>{answer}</ReactMarkdown>
          {phase === 'generating' && <span className="stream-cursor" aria-hidden="true" />}
        </div>
      )}

      {phase === 'error' && (
        <div className="answer-error" role="alert">
          <strong>Answer generation stopped</strong>
          <p>{error}</p>
        </div>
      )}

      <div className="answer-footer">
        <span className="model-chip">
          <Sparkles size={13} aria-hidden="true" />
          GitHub Copilot · {model}
        </span>
        <span>Review and personalize before speaking.</span>
      </div>
    </section>
  )
}
