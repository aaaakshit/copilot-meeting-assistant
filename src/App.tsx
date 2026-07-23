import { useCallback, useEffect, useRef, useState } from 'react'
import { ShieldCheck, Sparkles } from 'lucide-react'
import type {
  AnswerPreferences,
  CandidateContext,
  HealthResponse,
} from '../shared/contracts'
import { AnswerPanel } from './components/AnswerPanel'
import { ContextPanel } from './components/ContextPanel'
import { QuestionComposer } from './components/QuestionComposer'
import { StatusBadge } from './components/StatusBadge'
import { DesktopApp } from './desktop/DesktopApp'
import {
  DEFAULT_CONTEXT,
  DEFAULT_PREFERENCES,
  DEMO_CONTEXT,
} from './lib/defaults'
import { getHealth, streamAnswer } from './lib/api'
import { usePersistedState } from './lib/usePersistedState'
import './App.css'

type AnswerPhase = 'idle' | 'generating' | 'complete' | 'error'

function App() {
  return window.meetingAssistantDesktop?.isDesktop ? <DesktopApp /> : <BrowserApp />
}

function BrowserApp() {
  const [context, setContext] = usePersistedState<CandidateContext>(
    'meeting-assistant.context',
    DEFAULT_CONTEXT,
  )
  const [preferences, setPreferences] = usePersistedState<AnswerPreferences>(
    'meeting-assistant.preferences',
    DEFAULT_PREFERENCES,
  )
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [phase, setPhase] = useState<AnswerPhase>('idle')
  const [error, setError] = useState('')
  const [model, setModel] = useState('auto')
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [checkingHealth, setCheckingHealth] = useState(true)
  const activeRequest = useRef<AbortController | null>(null)

  const refreshHealth = useCallback(async (signal?: AbortSignal) => {
    setCheckingHealth(true)

    try {
      setHealth(await getHealth(signal))
    } catch (healthError) {
      if (isAbortError(healthError)) return

      setHealth({
        status: 'unavailable',
        authenticated: false,
        model: 'auto',
        message:
          healthError instanceof Error
            ? healthError.message
            : 'The local server is unavailable.',
      })
    } finally {
      if (!signal?.aborted) setCheckingHealth(false)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void refreshHealth(controller.signal)
    return () => controller.abort()
  }, [refreshHealth])

  const hasEvidence =
    context.resumeHighlights.trim().length > 0 ||
    context.evidence.trim().length > 0
  const canGenerate =
    question.trim().length >= 3 &&
    hasEvidence &&
    health?.status === 'ready' &&
    phase !== 'generating'

  const generateAnswer = async () => {
    if (!canGenerate) return

    const controller = new AbortController()
    activeRequest.current = controller
    setAnswer('')
    setError('')
    setPhase('generating')

    try {
      await streamAnswer(
        {
          question,
          mode: 'general',
          context,
          preferences,
        },
        (event) => {
          if (event.type === 'meta') setModel(event.model)
          if (event.type === 'delta') {
            setAnswer((current) => current + event.content)
          }
        },
        controller.signal,
      )
      setPhase('complete')
    } catch (generationError) {
      if (isAbortError(generationError)) {
        return
      }

      setError(
        generationError instanceof Error
          ? generationError.message
          : 'Copilot could not generate an answer.',
      )
      setPhase('error')
      void refreshHealth()
    } finally {
      if (activeRequest.current === controller) activeRequest.current = null
    }
  }

  const stopGeneration = () => {
    activeRequest.current?.abort()
    setPhase(answer ? 'complete' : 'idle')
  }

  const clearAnswer = () => {
    setAnswer('')
    setError('')
    setPhase('idle')
  }

  const loadDemo = () => {
    setContext(DEMO_CONTEXT)
    setQuestion('Tell me about a challenging project you led.')
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Meeting Assistant home">
          <span className="brand-mark" aria-hidden="true">
            <Sparkles size={17} strokeWidth={2.4} />
          </span>
          <span>Meeting Assistant</span>
          <span className="brand-version">MVP</span>
        </a>

        <StatusBadge
          health={health}
          checking={checkingHealth}
          onRetry={() => void refreshHealth()}
        />
      </header>

      <main className="page">
        <section className="intro" aria-labelledby="page-title">
          <div>
            <p className="eyebrow">
              <ShieldCheck size={15} aria-hidden="true" />
              Evidence-grounded interview coaching
            </p>
            <h1 id="page-title">Answer with confidence, not invention.</h1>
          </div>
          <p className="intro-copy">
            Add the facts you can defend, capture the question, and let GitHub
            Copilot shape a clear answer with an explicit honesty check.
          </p>
        </section>

        <div className="workspace">
          <ContextPanel
            context={context}
            onChange={setContext}
            onLoadDemo={loadDemo}
            onClear={() => setContext(DEFAULT_CONTEXT)}
          />

          <section className="answer-workspace" aria-label="Interview answer workspace">
            <QuestionComposer
              question={question}
              onQuestionChange={setQuestion}
              preferences={preferences}
              onPreferencesChange={setPreferences}
              isGenerating={phase === 'generating'}
              canGenerate={canGenerate}
              hasEvidence={hasEvidence}
              serviceReady={health?.status === 'ready'}
              onGenerate={() => void generateAnswer()}
              onStop={stopGeneration}
            />

            <AnswerPanel
              answer={answer}
              phase={phase}
              error={error}
              model={model}
              onClear={clearAnswer}
            />
          </section>
        </div>
      </main>

      <footer className="footer">
        <span>Profile data is saved in this browser.</span>
        <span>Answer requests are processed by GitHub Copilot.</span>
      </footer>
    </div>
  )
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

export default App
