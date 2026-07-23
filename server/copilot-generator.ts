import { homedir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  CopilotClient,
  type CopilotSession,
} from '@github/copilot-sdk'
import type {
  AnswerRequest,
  HealthResponse,
  InterviewMode,
} from '../shared/contracts.js'
import type { ScreenAttachment } from '../shared/desktop-contracts.js'
import type { AnswerGenerator } from './answer-generator.js'
import { buildAnswerPrompt, COACH_INSTRUCTIONS } from './prompt.js'

export class CopilotAuthenticationError extends Error {
  constructor(message = 'GitHub Copilot authentication is required.') {
    super(message)
    this.name = 'CopilotAuthenticationError'
  }
}

export class GenerationAbortedError extends Error {
  constructor() {
    super('Answer generation was stopped.')
    this.name = 'GenerationAbortedError'
  }
}

export class CopilotAnswerGenerator implements AnswerGenerator {
  private readonly client: CopilotClient
  private readonly model: string
  private readonly sessions = new Map<InterviewMode, CopilotSession>()
  private readonly sessionTurns = new Map<InterviewMode, number>()
  private readonly modeQueues = new Map<InterviewMode, Promise<void>>()
  private startPromise: Promise<void> | undefined
  private closing = false

  constructor() {
    this.model = process.env.MEETING_ASSISTANT_MODEL?.trim() || 'auto'
    this.client = new CopilotClient({
      mode: 'empty',
      baseDirectory: process.env.COPILOT_HOME || join(homedir(), '.copilot'),
      workingDirectory: process.cwd(),
      useLoggedInUser: true,
      logLevel: resolveLogLevel(process.env.COPILOT_LOG_LEVEL),
      env: copilotRuntimeEnvironment(),
    })
  }

  async getStatus(): Promise<HealthResponse> {
    try {
      await this.ensureStarted()
      const [auth, runtime] = await Promise.all([
        this.client.getAuthStatus(),
        this.client.getStatus(),
      ])

      if (!auth.isAuthenticated) {
        return {
          status: 'needs-auth',
          authenticated: false,
          model: this.model,
          runtimeVersion: runtime.version,
          message:
            auth.statusMessage ||
            'Sign in with GitHub Copilot or provide a supported GitHub token.',
        }
      }

      return {
        status: 'ready',
        authenticated: true,
        model: this.model,
        login: auth.login,
        runtimeVersion: runtime.version,
        message: auth.login
          ? `Connected as @${auth.login}`
          : 'GitHub Copilot is connected.',
      }
    } catch (error) {
      console.error('[copilot] Runtime status check failed.', error)
      return {
        status: 'unavailable',
        authenticated: false,
        model: this.model,
        message: statusFailureMessage(error),
      }
    }
  }

  async generate(
    request: AnswerRequest,
    onDelta: (content: string) => void,
    signal: AbortSignal,
    screen?: ScreenAttachment,
  ): Promise<void> {
    await this.ensureStarted()
    const auth = await this.client.getAuthStatus()

    if (!auth.isAuthenticated) {
      throw new CopilotAuthenticationError(auth.statusMessage)
    }

    const mode = request.mode ?? 'general'
    await this.runExclusive(mode, () =>
      this.generateInSession(request, onDelta, signal, mode, screen),
    )
  }

  async close(): Promise<void> {
    if (!this.startPromise) return

    this.closing = true
    try {
      await this.startPromise
      const activeQueues = [...this.modeQueues.values()]
      const errors = await this.client.stop()
      await Promise.allSettled(activeQueues)
      if (errors.length > 0) {
        throw new AggregateError(errors, 'Copilot did not shut down cleanly.')
      }
    } finally {
      this.sessions.clear()
      this.sessionTurns.clear()
      this.modeQueues.clear()
      this.startPromise = undefined
      this.closing = false
    }
  }

  private async ensureStarted(): Promise<void> {
    if (this.closing) throw new Error('The Copilot runtime is shutting down.')

    if (!this.startPromise) {
      this.startPromise = this.client.start().catch((error: unknown) => {
        this.startPromise = undefined
        throw error
      })
    }

    await this.startPromise
  }

  private async generateInSession(
    request: AnswerRequest,
    onDelta: (content: string) => void,
    signal: AbortSignal,
    mode: InterviewMode,
    screen?: ScreenAttachment,
  ): Promise<void> {
    if (signal.aborted) throw new GenerationAbortedError()

    const session = await this.getSession(mode)
    let streamedContent = ''
    let sessionError: Error | undefined
    let discardSession = false
    let abortPromise: Promise<void> | undefined

    const unsubscribeDelta = session.on('assistant.message_delta', (event) => {
      if (event.agentId) return
      streamedContent += event.data.deltaContent
      onDelta(event.data.deltaContent)
    })
    const unsubscribeError = session.on('session.error', (event) => {
      sessionError = new Error(event.data.message)
    })
    const abortGeneration = () => {
      discardSession = true
      if (this.sessions.get(mode) === session) {
        this.sessions.delete(mode)
        this.sessionTurns.delete(mode)
      }
      abortPromise ??= session.abort().catch((error: unknown) => {
        console.error('[copilot] Failed to abort the active session.', error)
      })
    }

    signal.addEventListener('abort', abortGeneration, { once: true })

    try {
      if (signal.aborted) throw new GenerationAbortedError()

      const response = await session.sendAndWait(
        {
          prompt: screen
            ? `${buildAnswerPrompt(request)}\n\nA current screen capture is attached. Use it according to the system instructions.`
            : buildAnswerPrompt(request),
          attachments: screen
            ? [
                {
                  type: 'blob',
                  data: screen.data,
                  mimeType: screen.mimeType,
                  displayName: screen.displayName,
                },
              ]
            : undefined,
        },
        120_000,
      )

      if (signal.aborted) throw new GenerationAbortedError()
      if (sessionError) throw sessionError
      if (!response) {
        throw new Error('Copilot completed without returning an answer.')
      }
      if (!streamedContent) onDelta(response.data.content)
      this.sessionTurns.set(mode, (this.sessionTurns.get(mode) ?? 0) + 1)
    } catch (error) {
      discardSession = true
      throw error
    } finally {
      signal.removeEventListener('abort', abortGeneration)
      unsubscribeDelta()
      unsubscribeError()
      await abortPromise
      if (discardSession || sessionError) {
        await this.discardSession(mode, session)
      }
    }
  }

  private async getSession(mode: InterviewMode): Promise<CopilotSession> {
    const currentSession = this.sessions.get(mode)
    if (currentSession && (this.sessionTurns.get(mode) ?? 0) < 12) {
      return currentSession
    }
    if (currentSession) await this.discardSession(mode, currentSession)

    if (this.closing) throw new Error('The Copilot runtime is shutting down.')

    const session = await this.client.createSession({
      clientName: `Meeting Assistant ${mode}`,
      model: this.model,
      streaming: true,
      availableTools: [],
      enableConfigDiscovery: false,
      systemMessage: {
        mode: 'append',
        content: COACH_INSTRUCTIONS,
      },
      onPermissionRequest: () => ({
        kind: 'reject',
        feedback: 'Meeting Assistant does not permit tool execution.',
      }),
    })

    if (this.closing) {
      try {
        await session.disconnect()
      } catch (error) {
        console.error(
          '[copilot] Failed to close a session created during shutdown.',
          error,
        )
      }
      throw new Error('The Copilot runtime is shutting down.')
    }

    this.sessions.set(mode, session)
    this.sessionTurns.set(mode, 0)
    return session
  }

  private async discardSession(
    mode: InterviewMode,
    session: CopilotSession,
  ): Promise<void> {
    if (this.sessions.get(mode) === session) {
      this.sessions.delete(mode)
      this.sessionTurns.delete(mode)
    }

    try {
      await session.disconnect()
    } catch (error) {
      console.error('[copilot] Failed to reset the interview session.', error)
    }
  }

  private async runExclusive<T>(
    mode: InterviewMode,
    operation: () => Promise<T>,
  ): Promise<T> {
    if (this.closing) throw new Error('The Copilot runtime is shutting down.')

    const previous = this.modeQueues.get(mode) ?? Promise.resolve()
    let release = () => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const queue = previous.catch(() => {}).then(() => gate)
    this.modeQueues.set(mode, queue)

    await previous.catch(() => {})
    try {
      if (this.closing) {
        throw new Error('The Copilot runtime is shutting down.')
      }
      return await operation()
    } finally {
      release()
      if (this.modeQueues.get(mode) === queue) {
        this.modeQueues.delete(mode)
      }
    }
  }
}

function resolveLogLevel(
  value: string | undefined,
): 'none' | 'error' | 'warning' | 'info' | 'debug' | 'all' {
  switch (value) {
    case 'none':
    case 'warning':
    case 'info':
    case 'debug':
    case 'all':
      return value
    default:
      return 'error'
  }
}

function copilotRuntimeEnvironment():
  | Record<string, string | undefined>
  | undefined {
  if (!('electron' in process.versions)) return undefined

  return {
    ...process.env,
    COPILOT_CLI_PATH: unpackedElectronPath(
      fileURLToPath(
        import.meta.resolve(
          `@github/copilot-${process.platform}-${process.arch}`,
        ),
      ),
    ),
  }
}

function unpackedElectronPath(value: string): string {
  return value.replace(
    /([\\/])app\.asar([\\/])/,
    '$1app.asar.unpacked$2',
  )
}

function statusFailureMessage(error: unknown): string {
  const message = error instanceof Error ? error.message.toLowerCase() : ''

  if (
    message.includes('auth') ||
    message.includes('credential') ||
    message.includes('login')
  ) {
    return 'Copilot could not authenticate. Sign in and retry the connection.'
  }

  return 'The Copilot runtime could not start. Check the local server output for details.'
}
