import request from 'supertest'
import { describe, expect, it } from 'vitest'
import type {
  AnswerRequest,
  HealthResponse,
} from '../shared/contracts.js'
import type { AnswerGenerator } from './answer-generator.js'
import { createApp } from './app.js'

const readyStatus: HealthResponse = {
  status: 'ready',
  authenticated: true,
  model: 'auto',
  login: 'octocat',
  runtimeVersion: '1.0.0',
  message: 'Connected as @octocat',
}

const validRequest: AnswerRequest = {
  question: 'Tell me about yourself.',
  mode: 'general',
  context: {
    targetRole: 'Product Engineer',
    resumeHighlights: 'Five years building developer tools.',
    jobDescription: 'Build reliable product experiences.',
    evidence: 'Led a migration that cut build time by 40%.',
  },
  preferences: {
    length: 'standard',
    tone: 'conversational',
  },
}

class FakeGenerator implements AnswerGenerator {
  async getStatus(): Promise<HealthResponse> {
    return readyStatus
  }

  async generate(
    _request: AnswerRequest,
    onDelta: (content: string) => void,
    _signal: AbortSignal,
  ): Promise<void> {
    onDelta('Grounded ')
    onDelta('answer')
  }

  async close(): Promise<void> {}
}

describe('Meeting Assistant API', () => {
  const app = createApp(new FakeGenerator())

  it('reports Copilot health', async () => {
    const response = await request(app).get('/api/health').expect(200)

    expect(response.body).toEqual(readyStatus)
  })

  it('streams answer events as NDJSON', async () => {
    const response = await request(app)
      .post('/api/answer')
      .send(validRequest)
      .expect('Content-Type', /application\/x-ndjson/)
      .expect(200)

    const events = response.text
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as { type: string; content?: string })

    expect(events.map((event) => event.type)).toEqual([
      'meta',
      'delta',
      'delta',
      'done',
    ])
    expect(events[1]?.content + events[2]?.content).toBe('Grounded answer')
  })

  it('rejects requests without candidate evidence', async () => {
    const response = await request(app)
      .post('/api/answer')
      .send({
        ...validRequest,
        context: {
          ...validRequest.context,
          resumeHighlights: '',
          evidence: '',
        },
      })
      .expect(400)

    expect(response.body.error).toContain('resume highlights')
  })

  it('accepts coding requests without candidate evidence', async () => {
    const response = await request(app)
      .post('/api/answer')
      .send({
        ...validRequest,
        mode: 'coding',
        codingLanguage: 'python',
        question: 'Implement a queue using two stacks.',
        context: {
          ...validRequest.context,
          resumeHighlights: '',
          evidence: '',
        },
      })
      .expect(200)

    expect(response.text).toContain('"type":"done"')
  })
})
