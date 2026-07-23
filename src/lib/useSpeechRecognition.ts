import { useCallback, useEffect, useRef, useState } from 'react'

interface SpeechAlternative {
  transcript: string
}

interface SpeechResult {
  readonly length: number
  [index: number]: SpeechAlternative
}

interface SpeechResultList {
  readonly length: number
  [index: number]: SpeechResult
}

interface SpeechResultEvent extends Event {
  resultIndex: number
  results: SpeechResultList
}

interface SpeechErrorEvent extends Event {
  error: string
}

interface SpeechRecognitionInstance {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((event: SpeechResultEvent) => void) | null
  onerror: ((event: SpeechErrorEvent) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance
}

type SpeechWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor
  webkitSpeechRecognition?: SpeechRecognitionConstructor
}

export function useSpeechRecognition(
  onTranscript: (transcript: string) => void,
) {
  const recognition = useRef<SpeechRecognitionInstance | null>(null)
  const [isListening, setIsListening] = useState(false)
  const [error, setError] = useState('')
  const speechWindow = window as SpeechWindow
  const Recognition =
    speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition
  const supported = Boolean(Recognition)

  const stop = useCallback(() => {
    recognition.current?.stop()
    setIsListening(false)
  }, [])

  const start = useCallback(() => {
    if (!Recognition || recognition.current) return

    const instance = new Recognition()
    instance.continuous = false
    instance.interimResults = true
    instance.lang = 'en-US'
    instance.onresult = (event) => {
      let transcript = ''
      for (let index = 0; index < event.results.length; index += 1) {
        transcript += event.results[index]?.[0]?.transcript || ''
      }
      onTranscript(transcript.trim())
    }
    instance.onerror = (event) => {
      setError(speechErrorMessage(event.error))
      setIsListening(false)
    }
    instance.onend = () => {
      recognition.current = null
      setIsListening(false)
    }

    recognition.current = instance
    setError('')
    setIsListening(true)
    instance.start()
  }, [Recognition, onTranscript])

  useEffect(
    () => () => {
      recognition.current?.abort()
      recognition.current = null
    },
    [],
  )

  return { supported, isListening, error, start, stop }
}

function speechErrorMessage(error: string): string {
  switch (error) {
    case 'not-allowed':
      return 'Microphone permission was denied.'
    case 'no-speech':
      return 'No speech was detected. Try again or type the question.'
    case 'network':
      return 'Browser speech recognition could not connect.'
    default:
      return 'Voice capture stopped. You can continue by typing.'
  }
}
