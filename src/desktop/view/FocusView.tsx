import {
  AlertCircle,
  Check,
  Clipboard,
  LoaderCircle,
  Sparkles,
} from 'lucide-react'
import {
  useEffect,
  useRef,
} from 'react'
import ReactMarkdown from 'react-markdown'
import type {
  DesktopActions,
  DesktopViewModel,
} from '../model/desktopModel'

interface FocusViewProps {
  model: DesktopViewModel
  actions: DesktopActions
}

export function FocusView({ model, actions }: FocusViewProps) {
  const answerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (model.answerState !== 'generating') return
    const element = answerRef.current
    if (element) element.scrollTop = element.scrollHeight
  }, [model.answer, model.answerState])

  return (
    <main className="desktop-focus-content">
      <section className="desktop-focus-answer-card" aria-live="polite">
        <div className="desktop-focus-heading">
          <div>
            <Sparkles size={16} aria-hidden="true" />
            <h1>
              {model.interviewMode === 'coding'
                ? 'Coding solution'
                : 'Live answer'}
            </h1>
          </div>
          <div className="desktop-focus-tools">
            {model.answerState === 'generating' && (
              <span className="focus-generation-status">
                <LoaderCircle className="spin" size={12} aria-hidden="true" />
                Generating
              </span>
            )}
            {model.answer && (
              <>
                <span>{model.answerWords} words</span>
                <button
                  type="button"
                  onClick={() => void actions.copyAnswer()}
                >
                  {model.copied ? (
                    <Check size={13} aria-hidden="true" />
                  ) : (
                    <Clipboard size={13} aria-hidden="true" />
                  )}
                  {model.copied ? 'Copied' : 'Copy'}
                </button>
              </>
            )}
          </div>
        </div>

        {model.answer ? (
          <div ref={answerRef} className="desktop-focus-markdown">
            <ReactMarkdown>{model.answer}</ReactMarkdown>
            {model.answerState === 'generating' && (
              <span className="stream-cursor" aria-hidden="true" />
            )}
          </div>
        ) : model.answerState === 'error' ? (
          <div className="desktop-focus-error" role="alert">
            <AlertCircle size={18} aria-hidden="true" />
            <div>
              <strong>Answer generation failed</strong>
              <p>{model.answerError}</p>
            </div>
          </div>
        ) : (
          <div className="desktop-focus-empty">
            {model.answerState === 'capturing' ||
            model.answerState === 'generating' ? (
              <>
                <LoaderCircle className="spin" size={23} aria-hidden="true" />
                <strong>
                  {model.interviewMode === 'coding'
                    ? 'Copilot is solving the problem…'
                    : 'Copilot is preparing your answer…'}
                </strong>
              </>
            ) : (
              <>
                <span className="capture-dot capture-listening" />
                <strong>Listening for the next question…</strong>
                <p>
                  The transcript and setup stay hidden while answers appear
                  here.
                </p>
              </>
            )}
          </div>
        )}
      </section>
    </main>
  )
}
