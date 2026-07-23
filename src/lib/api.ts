import type {
  AnswerRequest,
  AnswerStreamEvent,
  HealthResponse,
} from '../../shared/contracts'

export async function getHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const response = await fetch('/api/health', { signal })

  if (!response.ok) {
    throw new Error('The local Meeting Assistant server did not respond.')
  }

  return parseHealthResponse(await response.json())
}

export async function streamAnswer(
  request: AnswerRequest,
  onEvent: (event: AnswerStreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch('/api/answer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    signal,
  })

  if (!response.ok) {
    const message = await readErrorMessage(response)
    throw new Error(message)
  }
  if (!response.body) {
    throw new Error('This browser cannot read Copilot’s streaming response.')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { value, done } = await reader.read()
    buffer += decoder.decode(value, { stream: !done })

    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (!line.trim()) continue
      const event = parseAnswerStreamLine(line)
      if (event.type === 'error') throw new Error(event.message)
      onEvent(event)
    }

    if (done) break
  }

  if (buffer.trim()) {
    const event = parseAnswerStreamLine(buffer)
    if (event.type === 'error') throw new Error(event.message)
    onEvent(event)
  }
}

export function parseAnswerStreamLine(line: string): AnswerStreamEvent {
  const value: unknown = JSON.parse(line)
  if (!isRecord(value) || typeof value.type !== 'string') {
    throw new Error('The local server returned an invalid stream event.')
  }

  if (value.type === 'done') return { type: 'done' }
  if (value.type === 'meta' && typeof value.model === 'string') {
    return { type: 'meta', model: value.model }
  }
  if (value.type === 'delta' && typeof value.content === 'string') {
    return { type: 'delta', content: value.content }
  }
  if (value.type === 'error' && typeof value.message === 'string') {
    return { type: 'error', message: value.message }
  }

  throw new Error('The local server returned an unsupported stream event.')
}

function parseHealthResponse(value: unknown): HealthResponse {
  const status = isRecord(value) ? value.status : undefined
  if (
    !isRecord(value) ||
    (status !== 'ready' &&
      status !== 'needs-auth' &&
      status !== 'unavailable') ||
    typeof value.authenticated !== 'boolean' ||
    typeof value.model !== 'string' ||
    typeof value.message !== 'string'
  ) {
    throw new Error('The local server returned an invalid health response.')
  }

  return {
    status,
    authenticated: value.authenticated,
    model: value.model,
    message: value.message,
    login: typeof value.login === 'string' ? value.login : undefined,
    runtimeVersion:
      typeof value.runtimeVersion === 'string' ? value.runtimeVersion : undefined,
  }
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const value: unknown = await response.json()
    if (isRecord(value) && typeof value.error === 'string') return value.error
  } catch (error) {
    console.error('Could not parse the local server error response.', error)
  }

  return `The local server rejected the request (${response.status}).`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
