import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const electronPath = require('electron')
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const readyMarker = 'MEETING_ASSISTANT_SMOKE_READY'
const timeoutMs = 30_000

const child = spawn(electronPath, ['.'], {
  cwd: repositoryRoot,
  env: {
    ...process.env,
    MEETING_ASSISTANT_SMOKE_TEST: '1',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
})

let output = ''
let ready = false
let timedOut = false

const collect = (chunk) => {
  const text = chunk.toString()
  output += text
  if (text.includes(readyMarker)) ready = true
}

child.stdout.on('data', collect)
child.stderr.on('data', collect)

const timeout = setTimeout(() => {
  timedOut = true
  child.kill()
}, timeoutMs)

child.on('error', (error) => {
  clearTimeout(timeout)
  console.error('Electron smoke test could not start.', error)
  process.exitCode = 1
})

child.on('close', (code, signal) => {
  clearTimeout(timeout)

  if (timedOut) {
    console.error(`Electron smoke test timed out after ${timeoutMs}ms.`)
    console.error(output.trim())
    process.exitCode = 1
    return
  }
  if (code !== 0 || signal || !ready) {
    console.error(
      `Electron smoke test failed (code=${String(code)}, signal=${String(signal)}).`,
    )
    console.error(output.trim())
    process.exitCode = 1
    return
  }

  console.log('Electron smoke test passed.')
})
