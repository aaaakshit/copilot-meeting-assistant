import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type {
  AnswerPreferences,
  CandidateContext,
  CodingLanguage,
  HealthResponse,
  InterviewMode,
} from '../../../shared/contracts'
import type {
  ModelProgressPayload,
  ScreenAttachment,
} from '../../../shared/desktop-contracts'
import {
  DEFAULT_CONTEXT,
  DEFAULT_PREFERENCES,
  DEMO_CONTEXT,
} from '../../lib/defaults'
import { usePersistedState } from '../../lib/usePersistedState'
import {
  appendTranscript,
  cleanTranscript,
  RollingQuestionDetector,
} from '../model/QuestionDetector'
import { SystemCapture } from '../model/SystemCapture'
import {
  canAnswerInMode,
  CODING_LANGUAGES,
  createDesktopStyle,
  errorMessage,
  hasCandidateEvidence,
  SCREEN_QUESTIONS,
  type AnswerState,
  type CaptureState,
  type DesktopPage,
  type DesktopPresenter,
} from '../model/desktopModel'

export function useDesktopPresenter(): DesktopPresenter {
  const bridge = window.meetingAssistantDesktop!
  const [page, setPage] = useState<DesktopPage>('live')
  const [context, setContext] = usePersistedState<CandidateContext>(
    'meeting-assistant.context',
    DEFAULT_CONTEXT,
  )
  const [preferences, setPreferences] = usePersistedState<AnswerPreferences>(
    'meeting-assistant.preferences',
    DEFAULT_PREFERENCES,
  )
  const [autoAnswer, setAutoAnswer] = usePersistedState(
    'meeting-assistant.autoAnswer',
    true,
  )
  const [interviewMode, setInterviewMode] = usePersistedState<InterviewMode>(
    'meeting-assistant.interviewMode',
    'general',
  )
  const [codingLanguage, setCodingLanguage] =
    usePersistedState<CodingLanguage>(
      'meeting-assistant.codingLanguage',
      'auto',
    )
  const [glassLevel, setGlassLevel] = usePersistedState(
    'meeting-assistant.glassLevel',
    72,
  )
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [alwaysOnTop, setAlwaysOnTop] = useState(true)
  const [showAppearance, setShowAppearance] = useState(false)
  const [captureState, setCaptureState] = useState<CaptureState>('idle')
  const [captureError, setCaptureError] = useState('')
  const [audioLevel, setAudioLevel] = useState(0)
  const [transcript, setTranscript] = useState('')
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [answerState, setAnswerState] = useState<AnswerState>('idle')
  const [answerError, setAnswerError] = useState('')
  const [screenFrame, setScreenFrame] = useState<ScreenAttachment | null>(null)
  const [modelProgress, setModelProgress] =
    useState<ModelProgressPayload | null>(null)
  const [transcribing, setTranscribing] = useState(false)
  const [copied, setCopied] = useState(false)

  const captureRef = useRef<SystemCapture | null>(null)
  const requestIdRef = useRef<string | null>(null)
  const generationRef = useRef<(question: string) => Promise<void>>(async () => {})
  const answerScreenRef = useRef<() => Promise<void>>(async () => {})
  const transcriptionQueueRef = useRef(Promise.resolve())
  const contextRef = useRef(context)
  const autoAnswerRef = useRef(autoAnswer)
  const healthRef = useRef(health)
  const interviewModeRef = useRef(interviewMode)
  const questionDetectorRef = useRef(
    new RollingQuestionDetector(interviewMode),
  )

  contextRef.current = context
  autoAnswerRef.current = autoAnswer
  healthRef.current = health
  interviewModeRef.current = interviewMode
  questionDetectorRef.current.setMode(interviewMode)

  const refreshStatus = useCallback(async () => {
    try {
      const [status, runtime] = await Promise.all([
        bridge.getCopilotStatus(),
        bridge.getRuntimeInfo(),
      ])
      setHealth(status)
      setAlwaysOnTop(runtime.alwaysOnTop)
    } catch (error) {
      setHealth({
        status: 'unavailable',
        authenticated: false,
        model: 'auto',
        message: errorMessage(error, 'Copilot is unavailable.'),
      })
    }
  }, [bridge])

  useEffect(() => {
    document.documentElement.classList.add('desktop-root')
    document.body.classList.add('desktop-body')
    void refreshStatus()

    const capture = new SystemCapture({
      onAudioSegment: (samples) => {
        transcriptionQueueRef.current = transcriptionQueueRef.current
          .then(async () => {
            setTranscribing(true)
            const transferable = new ArrayBuffer(samples.byteLength)
            new Float32Array(transferable).set(samples)
            const result = await bridge.transcribeAudio(transferable)
            const text = cleanTranscript(result.text)
            if (!text) return

            setTranscript((current) => appendTranscript(current, text))
            const detectedQuestion = questionDetectorRef.current.push(text)
            if (!detectedQuestion) return

            setQuestion(detectedQuestion)
            if (
              autoAnswerRef.current &&
              healthRef.current?.status === 'ready' &&
              canAnswerInMode(interviewModeRef.current, contextRef.current)
            ) {
              void generationRef.current(detectedQuestion)
            }
          })
          .catch((error: unknown) => {
            setCaptureError(errorMessage(error, 'Local transcription failed.'))
          })
          .finally(() => setTranscribing(false))
      },
      onLevel: setAudioLevel,
      onEnded: () => setCaptureState('idle'),
    })
    captureRef.current = capture

    const unsubscribeDelta = bridge.onAnswerDelta((payload) => {
      if (payload.requestId === requestIdRef.current) {
        setAnswer((current) => current + payload.content)
      }
    })
    const unsubscribeProgress = bridge.onModelProgress(setModelProgress)
    const unsubscribeShortcut = bridge.onShortcut((shortcut) => {
      if (shortcut === 'answer-screen') void answerScreenRef.current()
    })

    return () => {
      document.documentElement.classList.remove('desktop-root')
      document.body.classList.remove('desktop-body')
      unsubscribeDelta()
      unsubscribeProgress()
      unsubscribeShortcut()
      captureRef.current = null
      void capture.stop().catch((error: unknown) => {
        console.error('[desktop] Failed to stop capture during cleanup.', error)
      })
    }
  }, [bridge, refreshStatus])

  const startCapture = useCallback(async () => {
    if (captureRef.current?.active) return
    setCaptureState('starting')
    setCaptureError('')

    try {
      await captureRef.current?.start()
      setCaptureState('listening')
    } catch (error) {
      setCaptureState('error')
      setCaptureError(errorMessage(error, 'Screen and audio capture failed.'))
    }
  }, [])

  const stopCapture = useCallback(async () => {
    try {
      await captureRef.current?.stop()
      setCaptureState('idle')
    } catch (error) {
      setCaptureState('error')
      setCaptureError(errorMessage(error, 'Could not stop screen capture.'))
    }
  }, [])

  const selectInterviewMode = (mode: InterviewMode) => {
    if (
      mode === interviewMode ||
      answerState === 'capturing' ||
      answerState === 'generating'
    ) {
      return
    }

    questionDetectorRef.current.setMode(mode)
    setInterviewMode(mode)
    setTranscript('')
    setQuestion('')
    setAnswer('')
    setAnswerError('')
    setAnswerState('idle')
    setScreenFrame(null)
  }

  const generate = useCallback(
    async (prompt: string, includeScreen = true) => {
      if (!canAnswerInMode(interviewMode, context)) {
        setPage('profile')
        setAnswerError('Add resume highlights or an evidence story first.')
        setAnswerState('error')
        return
      }
      if (health?.status !== 'ready') {
        setAnswerError('Connect GitHub Copilot before generating an answer.')
        setAnswerState('error')
        return
      }

      const previousRequest = requestIdRef.current
      if (previousRequest) await bridge.abortAnswer(previousRequest)

      setAnswer('')
      setAnswerError('')
      setAnswerState(includeScreen ? 'capturing' : 'generating')

      let screen: ScreenAttachment | undefined
      if (includeScreen) {
        try {
          if (!captureRef.current?.active) await startCapture()
          if (captureRef.current?.active) {
            screen = await captureRef.current.captureScreen()
            setScreenFrame(screen)
          }
        } catch (error) {
          setCaptureError(
            errorMessage(error, 'Screen capture failed; answering from text only.'),
          )
        }
      }

      const requestId = crypto.randomUUID()
      requestIdRef.current = requestId
      setAnswerState('generating')

      try {
        await bridge.generateAnswer({
          requestId,
          request: {
            question: prompt,
            mode: interviewMode,
            codingLanguage,
            context,
            preferences,
          },
          screen,
        })
        if (requestIdRef.current === requestId) setAnswerState('complete')
      } catch (error) {
        if (requestIdRef.current !== requestId) return
        setAnswerError(errorMessage(error, 'Copilot could not generate an answer.'))
        setAnswerState('error')
        void refreshStatus()
      } finally {
        if (requestIdRef.current === requestId) requestIdRef.current = null
      }
    },
    [
      bridge,
      codingLanguage,
      context,
      health?.status,
      interviewMode,
      preferences,
      refreshStatus,
      startCapture,
    ],
  )

  generationRef.current = (prompt) => generate(prompt, true)

  const answerFromScreen = useCallback(async () => {
    const prompt = SCREEN_QUESTIONS[interviewMode]
    setQuestion(prompt)
    await generate(prompt, true)
  }, [generate, interviewMode])

  answerScreenRef.current = answerFromScreen

  const stopAnswer = async () => {
    const requestId = requestIdRef.current
    if (!requestId) return
    requestIdRef.current = null
    await bridge.abortAnswer(requestId)
    setAnswerState(answer ? 'complete' : 'idle')
  }

  const copyAnswer = async () => {
    try {
      await navigator.clipboard.writeText(answer)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1_500)
    } catch (error) {
      setAnswerError(errorMessage(error, 'Could not copy the answer.'))
    }
  }

  const clearAnswer = () => {
    setAnswer('')
    setAnswerError('')
    setAnswerState('idle')
  }

  const answerWords = useMemo(
    () => answer.trim().split(/\s+/).filter(Boolean).length,
    [answer],
  )
  const latestTranscript = useMemo(() => {
    const segments = transcript.split('\n').map((segment) => segment.trim())
    return segments.filter(Boolean).pop() ?? ''
  }, [transcript])
  const desktopStyle = createDesktopStyle(glassLevel)
  const hasEvidence = hasCandidateEvidence(context)
  const modeSwitchDisabled =
    answerState === 'capturing' || answerState === 'generating'

  return {
    model: {
      page,
      context,
      preferences,
      autoAnswer,
      interviewMode,
      codingLanguage,
      codingLanguages: CODING_LANGUAGES,
      health,
      alwaysOnTop,
      showAppearance,
      glassLevel: desktopStyle.level,
      style: desktopStyle.style,
      captureState,
      captureError,
      audioLevel,
      transcript,
      latestTranscript,
      question,
      answer,
      answerWords,
      answerState,
      answerError,
      screenAttached: screenFrame !== null,
      modelProgress,
      transcribing,
      copied,
      hasEvidence,
      canGenerate:
        question.trim().length >= 3 &&
        !modeSwitchDisabled &&
        (interviewMode === 'coding' || hasEvidence) &&
        health?.status === 'ready',
      modeSwitchDisabled,
    },
    actions: {
      setPage,
      toggleAppearance: () => setShowAppearance((current) => !current),
      setGlassLevel,
      toggleAlwaysOnTop: async () => {
        try {
          setAlwaysOnTop(await bridge.toggleAlwaysOnTop())
        } catch (error) {
          setAnswerError(errorMessage(error, 'Could not change window pinning.'))
        }
      },
      minimizeWindow: () => bridge.minimizeWindow(),
      closeWindow: () => bridge.closeWindow(),
      refreshStatus,
      selectInterviewMode,
      setCodingLanguage,
      startCapture,
      stopCapture,
      answerFromScreen,
      setAutoAnswer,
      useLatestTranscript: () => setQuestion(latestTranscript),
      setQuestion,
      generateAnswer: () => generate(question, true),
      stopAnswer,
      copyAnswer,
      clearAnswer,
      setContext,
      setPreferences,
      loadDemo: () => setContext(DEMO_CONTEXT),
      saveProfile: () => setPage('live'),
    },
  }
}
