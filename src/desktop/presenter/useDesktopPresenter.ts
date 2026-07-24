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
import { CaptureSessionGate } from '../model/CaptureSessionGate'
import { GenerationGate } from '../model/GenerationGate'
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
  const [runtimeReady, setRuntimeReady] = useState(false)
  const [alwaysOnTop, setAlwaysOnTop] = useState(true)
  const [focusMode, setFocusMode] = useState(false)
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
  const captureSessionGateRef = useRef(new CaptureSessionGate())
  const generationGateRef = useRef(new GenerationGate())
  const contextRef = useRef(context)
  const answerRef = useRef(answer)
  const autoAnswerRef = useRef(autoAnswer)
  const healthRef = useRef(health)
  const interviewModeRef = useRef(interviewMode)
  const smokeTestRef = useRef(false)
  const questionDetectorRef = useRef(
    new RollingQuestionDetector(interviewMode),
  )

  contextRef.current = context
  answerRef.current = answer
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
      setFocusMode(runtime.focusMode)
      smokeTestRef.current = runtime.smokeTest
      setRuntimeReady(true)
    } catch (error) {
      setRuntimeReady(false)
      setHealth({
        status: 'unavailable',
        authenticated: false,
        model: 'auto',
        message: errorMessage(error, 'Copilot is unavailable.'),
      })
    }
  }, [bridge])

  const updateFocusMode = useCallback(
    async (enabled: boolean) => {
      const state = await bridge.setFocusMode(enabled)
      setFocusMode(state.active)
      setAlwaysOnTop(state.alwaysOnTop)
      return state.active
    },
    [bridge],
  )

  const cancelActiveGeneration = useCallback(async () => {
    generationGateRef.current.cancel()
    const requestId = requestIdRef.current
    requestIdRef.current = null
    if (requestId) await bridge.abortAnswer(requestId)
  }, [bridge])

  useEffect(() => {
    document.documentElement.classList.add('desktop-root')
    document.body.classList.add('desktop-body')
    void refreshStatus()

    const captureSessionGate = captureSessionGateRef.current
    const generationGate = generationGateRef.current
    const questionDetector = questionDetectorRef.current
    const capture = new SystemCapture({
      onAudioSegment: (samples) => {
        const captureSession = captureSessionGate.current()
        if (!captureSessionGate.accepts(captureSession)) return

        transcriptionQueueRef.current = transcriptionQueueRef.current
          .then(async () => {
            setTranscribing(true)
            const transferable = new ArrayBuffer(samples.byteLength)
            new Float32Array(transferable).set(samples)
            const result = await bridge.transcribeAudio(transferable)
            if (!captureSessionGate.accepts(captureSession)) {
              return
            }
            const text = cleanTranscript(result.text)
            if (!text) return

            setTranscript((current) => appendTranscript(current, text))
            const detectedQuestion = questionDetector.push(text)
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
      onEnded: () => {
        captureSessionGate.stop()
        questionDetector.reset()
        void cancelActiveGeneration().catch((error: unknown) => {
          console.error(
            '[desktop] Failed to stop generation after capture ended.',
            error,
          )
        })
        setCaptureState('idle')
        setAnswerState((current) =>
          current === 'capturing' || current === 'generating'
            ? answerRef.current
              ? 'complete'
              : 'idle'
            : current,
        )
        setPage('live')
        void updateFocusMode(false).catch((error: unknown) => {
          console.error('[desktop] Failed to leave focus mode.', error)
        })
      },
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
      captureSessionGate.stop()
      generationGate.cancel()
      questionDetector.reset()
      void capture.stop().catch((error: unknown) => {
        console.error('[desktop] Failed to stop capture during cleanup.', error)
      })
    }
  }, [
    bridge,
    cancelActiveGeneration,
    refreshStatus,
    updateFocusMode,
  ])

  const startCapture = useCallback(async () => {
    if (captureRef.current?.active) return
    setCaptureState('starting')
    setCaptureError('')

    try {
      questionDetectorRef.current.reset()
      captureSessionGateRef.current.start()
      if (!smokeTestRef.current) await captureRef.current?.start()
      await updateFocusMode(true)
      setCaptureState('listening')
    } catch (error) {
      captureSessionGateRef.current.stop()
      if (captureRef.current?.active) {
        await captureRef.current.stop().catch((stopError: unknown) => {
          console.error(
            '[desktop] Failed to clean up capture after startup failure.',
            stopError,
          )
        })
      }
      await updateFocusMode(false).catch((focusError: unknown) => {
        console.error(
          '[desktop] Failed to restore the window after startup failure.',
          focusError,
        )
      })
      setCaptureState('error')
      setCaptureError(errorMessage(error, 'Screen and audio capture failed.'))
    }
  }, [updateFocusMode])

  const stopCapture = useCallback(async () => {
    try {
      captureSessionGateRef.current.stop()
      questionDetectorRef.current.reset()
      await cancelActiveGeneration()
      if (!smokeTestRef.current) await captureRef.current?.stop()
      await updateFocusMode(false)
      setCaptureState('idle')
      setAnswerState(answer ? 'complete' : 'idle')
      setPage('live')
    } catch (error) {
      await updateFocusMode(false).catch((focusError: unknown) => {
        console.error(
          '[desktop] Failed to restore the window after capture stopped.',
          focusError,
        )
      })
      setCaptureState('error')
      setCaptureError(errorMessage(error, 'Could not stop screen capture.'))
    }
  }, [answer, cancelActiveGeneration, updateFocusMode])

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

      const generation = generationGateRef.current.begin()
      const previousRequest = requestIdRef.current
      if (previousRequest) await bridge.abortAnswer(previousRequest)
      if (!generationGateRef.current.isCurrent(generation)) return

      setAnswer('')
      setAnswerError('')
      setAnswerState(includeScreen ? 'capturing' : 'generating')

      let screen: ScreenAttachment | undefined
      if (includeScreen) {
        try {
          if (!captureRef.current?.active) await startCapture()
          if (!generationGateRef.current.isCurrent(generation)) return
          if (captureRef.current?.active) {
            screen = await captureRef.current.captureScreen()
            if (!generationGateRef.current.isCurrent(generation)) return
            setScreenFrame(screen)
          }
        } catch (error) {
          setCaptureError(
            errorMessage(error, 'Screen capture failed; answering from text only.'),
          )
        }
      }

      if (!generationGateRef.current.isCurrent(generation)) return
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
    await cancelActiveGeneration()
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
      runtimeReady,
      alwaysOnTop,
      focusMode,
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
