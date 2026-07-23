import { resolve } from 'node:path'
import { createApp } from './app.js'
import { CopilotAnswerGenerator } from './copilot-generator.js'

const port = parsePort(process.env.PORT)
const generator = new CopilotAnswerGenerator()
const app = createApp(generator, resolve(process.cwd(), 'dist'))
const server = app.listen(port, () => {
  console.log(`Meeting Assistant is running at http://localhost:${port}`)
})

let shuttingDown = false

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return
  shuttingDown = true
  console.log(`\nReceived ${signal}; shutting down.`)

  server.close()

  try {
    await generator.close()
    process.exitCode = 0
  } catch (error) {
    console.error('[server] Shutdown failed.', error)
    process.exitCode = 1
  }
}

process.once('SIGINT', () => void shutdown('SIGINT'))
process.once('SIGTERM', () => void shutdown('SIGTERM'))

function parsePort(value: string | undefined): number {
  if (!value) return 8787

  const port = Number(value)
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`PORT must be an integer between 1 and 65535; received "${value}".`)
  }

  return port
}
