import { existsSync } from 'node:fs'
import { join } from 'node:path'
import express from 'express'
import type { ErrorRequestHandler, Response } from 'express'
import type { AnswerStreamEvent } from '../shared/contracts.js'
import type { AnswerGenerator } from './answer-generator.js'
import {
  CopilotAuthenticationError,
  GenerationAbortedError,
} from './copilot-generator.js'
import { answerRequestSchema } from './schema.js'

export function createApp(
  generator: AnswerGenerator,
  clientDistPath?: string,
): express.Express {
  const app = express()
  app.disable('x-powered-by')
  app.use(express.json({ limit: '64kb' }))

  app.get('/api/health', async (_request, response) => {
    response.json(await generator.getStatus())
  })

  app.post('/api/answer', async (request, response) => {
    const parsed = answerRequestSchema.safeParse(request.body)

    if (!parsed.success) {
      response.status(400).json({
        error: parsed.error.issues[0]?.message || 'Invalid answer request.',
        issues: parsed.error.issues.map((issue) => ({
          message: issue.message,
          path: issue.path.join('.'),
        })),
      })
      return
    }

    response.status(200)
    response.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8')
    response.setHeader('Cache-Control', 'no-cache, no-transform')
    response.setHeader('X-Accel-Buffering', 'no')
    response.flushHeaders()

    const controller = new AbortController()
    const handleClose = () => {
      if (!response.writableEnded) controller.abort()
    }
    response.on('close', handleClose)

    writeEvent(response, {
      type: 'meta',
      model: process.env.MEETING_ASSISTANT_MODEL?.trim() || 'auto',
    })

    try {
      await generator.generate(
        parsed.data,
        (content) => writeEvent(response, { type: 'delta', content }),
        controller.signal,
      )
      writeEvent(response, { type: 'done' })
    } catch (error) {
      if (!(error instanceof GenerationAbortedError)) {
        console.error('[answer] Generation failed.', error)
        writeEvent(response, {
          type: 'error',
          message: publicGenerationError(error),
        })
      }
    } finally {
      response.off('close', handleClose)
      if (!response.writableEnded) response.end()
    }
  })

  if (clientDistPath && existsSync(join(clientDistPath, 'index.html'))) {
    app.use(express.static(clientDistPath))
    app.use((request, response, next) => {
      if (
        request.method !== 'GET' ||
        request.path.startsWith('/api/') ||
        !request.accepts('html')
      ) {
        next()
        return
      }

      response.sendFile(join(clientDistPath, 'index.html'))
    })
  }

  const errorHandler: ErrorRequestHandler = (error, _request, response, next) => {
    if (error instanceof SyntaxError && 'body' in error) {
      response.status(400).json({ error: 'Request body must be valid JSON.' })
      return
    }

    if (response.headersSent) {
      next(error)
      return
    }

    console.error('[server] Unhandled request error.', error)
    response.status(500).json({ error: 'The local server could not process the request.' })
  }
  app.use(errorHandler)

  return app
}

function writeEvent(response: Response, event: AnswerStreamEvent): void {
  if (response.destroyed || response.writableEnded) return
  response.write(`${JSON.stringify(event)}\n`)
}

function publicGenerationError(error: unknown): string {
  if (error instanceof CopilotAuthenticationError) {
    return 'GitHub Copilot is not authenticated. Sign in, then retry the connection.'
  }

  return 'Copilot could not generate an answer. Check the local server output and retry.'
}
