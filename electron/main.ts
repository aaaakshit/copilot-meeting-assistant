import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  app,
  BrowserWindow,
  desktopCapturer,
  globalShortcut,
  ipcMain,
  screen,
  session,
  type Rectangle,
} from 'electron'
import { z } from 'zod'
import type { HealthResponse } from '../shared/contracts.js'
import type {
  DesktopFocusModeState,
  DesktopRuntimeInfo,
  ModelProgressPayload,
} from '../shared/desktop-contracts.js'
import { CopilotAnswerGenerator } from '../server/copilot-generator.js'
import { answerRequestSchema } from '../server/schema.js'
import {
  areBoundsEquivalent,
  calculateFocusBounds,
  clampBoundsToWorkArea,
} from './focus-window.js'
import { RendererRecoveryPolicy } from './renderer-recovery.js'
import { LocalTranscriber } from './transcriber.js'

const currentDirectory = dirname(fileURLToPath(import.meta.url))
const activeAnswers = new Map<string, AbortController>()
const isSmokeTest = process.env.MEETING_ASSISTANT_SMOKE_TEST === '1'
const rendererRecovery = new RendererRecoveryPolicy()
let mainWindow: BrowserWindow | null = null
let generator: CopilotAnswerGenerator | null = null
let transcriber: LocalTranscriber | null = null
let isQuitting = false
let isFocusMode = false
let standardWindowBounds: Rectangle | null = null
let standardAlwaysOnTop: boolean | null = null

const screenAttachmentSchema = z.object({
  data: z.string().min(100).max(8_000_000),
  mimeType: z.enum(['image/jpeg', 'image/png']),
  displayName: z.string().trim().min(1).max(120),
})

const desktopGenerateSchema = z.object({
  requestId: z.string().uuid(),
  request: answerRequestSchema,
  screen: screenAttachmentSchema.optional(),
})

app.setName('Copilot Meeting Assistant')
app.setAppUserModelId('app.copilotmeetingassistant.desktop')

const hasSingleInstanceLock = app.requestSingleInstanceLock()
if (!hasSingleInstanceLock) {
  app.quit()
} else {
  void app
    .whenReady()
    .then(initializeApplication)
    .catch((error: unknown) => {
      console.error('[desktop] Application startup failed.', error)
      app.exit(1)
    })
}

async function initializeApplication(): Promise<void> {
  configureDisplayCapture()
  registerIpcHandlers()
  await createWindow()
  if (!isSmokeTest) registerShortcuts()
}

app.on('second-instance', () => {
  if (!mainWindow) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
})

app.on('activate', () => {
  if (
    hasSingleInstanceLock &&
    !isSmokeTest &&
    BrowserWindow.getAllWindows().length === 0
  ) {
    void createWindow().catch((error: unknown) => {
      console.error('[desktop] Failed to recreate the application window.', error)
    })
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

app.on('before-quit', (event) => {
  if (isQuitting) return

  event.preventDefault()
  isQuitting = true
  for (const controller of activeAnswers.values()) controller.abort()

  void closeServices().finally(() => app.quit())
})

async function createWindow(): Promise<void> {
  const preloadPath = join(currentDirectory, 'preload.cjs')
  const window = new BrowserWindow({
    width: 570,
    height: 820,
    minWidth: 430,
    minHeight: 580,
    show: false,
    frame: false,
    alwaysOnTop: true,
    transparent: true,
    backgroundColor: '#00000000',
    title: 'Copilot Meeting Assistant',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  mainWindow = window

  window.setAlwaysOnTop(true, 'floating')
  window.setContentProtection(true)
  window.setMenuBarVisibility(false)
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.once('ready-to-show', () => {
    if (!isSmokeTest) window.show()
  })
  window.on('show', () => window.setContentProtection(true))
  window.webContents.on('render-process-gone', (_event, details) => {
    console.error('[desktop] Renderer process exited.', details)
    if (
      !isQuitting &&
      rendererRecovery.shouldRecover(details.reason)
    ) {
      for (const controller of activeAnswers.values()) controller.abort()
      if (isFocusMode) {
        try {
          setWindowFocusMode(false)
        } catch (error) {
          console.error(
            '[desktop] Failed to restore the window after renderer exit.',
            error,
          )
        }
      }
      window.webContents.reload()
    }
  })
  window.webContents.on('unresponsive', () => {
    console.error('[desktop] Renderer process became unresponsive.')
  })
  window.webContents.on(
    'did-fail-load',
    (_event, errorCode, errorDescription, validatedUrl, isMainFrame) => {
      if (!isMainFrame || isQuitting) return
      console.error('[desktop] Renderer failed to load.', {
        errorCode,
        errorDescription,
        validatedUrl,
      })
    },
  )

  const rendererUrl = process.env.ELECTRON_RENDERER_URL
  if (rendererUrl) {
    await window.loadURL(`${rendererUrl}?desktop=1`)
  } else {
    await window.loadFile(join(app.getAppPath(), 'dist', 'index.html'), {
      query: { desktop: '1' },
    })
  }

  window.on('closed', () => {
    if (mainWindow === window) {
      mainWindow = null
      isFocusMode = false
      standardWindowBounds = null
      standardAlwaysOnTop = null
    }
  })

  if (isSmokeTest) await completeSmokeTest(window)
}

async function completeSmokeTest(window: BrowserWindow): Promise<void> {
  const deadline = Date.now() + 10_000
  const initialBounds = window.getBounds()
  let enteredFocus = false

  while (Date.now() < deadline) {
    const state = (await window.webContents.executeJavaScript(`
      (() => ({
        brand: document.querySelector('.desktop-brand')?.textContent || '',
        runtimeReady:
          document.querySelector('.desktop-app')?.getAttribute('data-runtime-ready'),
        buttons: Array.from(document.querySelectorAll('button'))
          .map((button) => button.textContent?.trim() || '')
      }))()
    `)) as {
      brand: string
      runtimeReady: string | null
      buttons: string[]
    }

    if (
      state.brand.includes('Meeting Assistant') &&
      state.runtimeReady === 'true' &&
      state.buttons.includes('Interview') &&
      state.buttons.includes('Coding') &&
      state.buttons.includes('Start listening')
    ) {
      await window.webContents.executeJavaScript(`
        Array.from(document.querySelectorAll('button'))
          .find((button) => button.textContent?.trim() === 'Start listening')
          ?.click()
      `)
      break
    }

    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  const focusDeadline = Date.now() + 5_000
  while (Date.now() < focusDeadline) {
    const state = (await window.webContents.executeJavaScript(`
      (() => ({
        focusVisible: Boolean(document.querySelector('.desktop-focus-content')),
        stopVisible: Array.from(document.querySelectorAll('button'))
          .some((button) => button.textContent?.trim() === 'Stop listening')
      }))()
    `)) as { focusVisible: boolean; stopVisible: boolean }

    if (state.focusVisible && state.stopVisible) {
      const display = screen.getDisplayMatching(window.getBounds())
      const expectedBounds = calculateFocusBounds(display.workArea)
      const actualBounds = window.getBounds()
      if (!areBoundsEquivalent(expectedBounds, actualBounds)) {
        throw new Error(
          `Focus bounds mismatch: expected ${JSON.stringify(expectedBounds)}, received ${JSON.stringify(actualBounds)}.`,
        )
      }

      await window.webContents.executeJavaScript(`
        Array.from(document.querySelectorAll('button'))
          .find((button) => button.textContent?.trim() === 'Stop listening')
          ?.click()
      `)
      enteredFocus = true
      break
    }

    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  if (!enteredFocus) {
    throw new Error('The desktop renderer never entered focus mode.')
  }

  const restoreDisplay = screen.getDisplayMatching(initialBounds)
  const expectedRestoredBounds = clampBoundsToWorkArea(
    initialBounds,
    restoreDisplay.workArea,
  )
  const restoreDeadline = Date.now() + 5_000
  let lastRestoreState = {
    restored: false,
    focusMode: isFocusMode,
    bounds: window.getBounds(),
  }
  while (Date.now() < restoreDeadline) {
    const restored = (await window.webContents.executeJavaScript(`
      Boolean(
        document.querySelector('.desktop-tabs') &&
        Array.from(document.querySelectorAll('button'))
          .some((button) => button.textContent?.trim() === 'Start listening')
      )
    `)) as boolean

    const actualBounds = window.getBounds()
    const boundsRestored = areBoundsEquivalent(
      expectedRestoredBounds,
      actualBounds,
    )
    lastRestoreState = {
      restored,
      focusMode: isFocusMode,
      bounds: actualBounds,
    }

    if (restored && !isFocusMode && boundsRestored) {
      console.log('MEETING_ASSISTANT_SMOKE_READY')
      setTimeout(() => app.quit(), 100)
      return
    }

    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  throw new Error(
    `The desktop focus workflow did not restore during smoke testing. Expected bounds ${JSON.stringify(expectedRestoredBounds)}; last state ${JSON.stringify(lastRestoreState)}.`,
  )
}

function configureDisplayCapture(): void {
  session.defaultSession.setDisplayMediaRequestHandler(
    async (_request, callback) => {
      try {
        const sources = await desktopCapturer.getSources({
          types: ['screen'],
          thumbnailSize: { width: 0, height: 0 },
        })
        const primaryId = String(screen.getPrimaryDisplay().id)
        const source =
          sources.find((candidate) => candidate.display_id === primaryId) ??
          sources[0]

        if (!source) {
          callback({})
          return
        }

        callback({
          video: source,
          audio: process.platform === 'win32' ? 'loopback' : undefined,
          enableLocalEcho: true,
        })
      } catch (error) {
        console.error('[desktop] Display capture failed.', error)
        callback({})
      }
    },
    { useSystemPicker: false },
  )
}

function registerIpcHandlers(): void {
  ipcMain.handle('desktop:runtime-info', (): DesktopRuntimeInfo => ({
    platform: desktopPlatform(),
    appVersion: app.getVersion(),
    alwaysOnTop: mainWindow?.isAlwaysOnTop() ?? false,
    focusMode: isFocusMode,
    smokeTest: isSmokeTest,
  }))

  ipcMain.handle('window:minimize', () => mainWindow?.minimize())
  ipcMain.handle('window:close', () => mainWindow?.close())
  ipcMain.handle('window:toggle-always-on-top', () => {
    if (!mainWindow) return false
    const nextValue = !mainWindow.isAlwaysOnTop()
    mainWindow.setAlwaysOnTop(nextValue, 'floating')
    return nextValue
  })
  ipcMain.handle('window:set-focus-mode', (_event, enabled: unknown) => {
    if (typeof enabled !== 'boolean') {
      throw new TypeError('Focus mode requires a boolean value.')
    }
    return setWindowFocusMode(enabled)
  })

  ipcMain.handle('copilot:status', async (): Promise<HealthResponse> => {
    if (isSmokeTest) {
      return {
        status: 'unavailable',
        authenticated: false,
        model: 'auto',
        message: 'Copilot status is skipped during the desktop smoke test.',
      }
    }
    return getGenerator().getStatus()
  })

  ipcMain.handle(
    'copilot:generate',
    async (event, rawPayload: unknown): Promise<void> => {
      const payload = desktopGenerateSchema.parse(rawPayload)
      const controller = new AbortController()
      activeAnswers.set(payload.requestId, controller)

      try {
        await getGenerator().generate(
          payload.request,
          (content) => {
            if (!event.sender.isDestroyed()) {
              event.sender.send('copilot:delta', {
                requestId: payload.requestId,
                content,
              })
            }
          },
          controller.signal,
          payload.screen,
        )
      } finally {
        activeAnswers.delete(payload.requestId)
      }
    },
  )

  ipcMain.handle('copilot:abort', (_event, requestId: unknown) => {
    if (typeof requestId !== 'string') return
    activeAnswers.get(requestId)?.abort()
  })

  ipcMain.handle(
    'transcription:run',
    async (_event, rawSamples: unknown) =>
      getTranscriber().transcribe(toFloat32Array(rawSamples)),
  )
}

function setWindowFocusMode(enabled: boolean): DesktopFocusModeState {
  if (!mainWindow || mainWindow.isDestroyed()) {
    throw new Error('The desktop window is unavailable.')
  }
  if (enabled === isFocusMode) {
    return {
      active: isFocusMode,
      alwaysOnTop: mainWindow.isAlwaysOnTop(),
    }
  }

  if (enabled) {
    standardWindowBounds = mainWindow.getBounds()
    standardAlwaysOnTop = mainWindow.isAlwaysOnTop()
    const display = screen.getDisplayMatching(standardWindowBounds)
    mainWindow.setBounds(calculateFocusBounds(display.workArea))
    mainWindow.setAlwaysOnTop(true, 'floating')
    mainWindow.setContentProtection(true)
    isFocusMode = true
    return { active: true, alwaysOnTop: true }
  }

  if (standardWindowBounds) {
    const display = screen.getDisplayMatching(standardWindowBounds)
    mainWindow.setBounds(
      clampBoundsToWorkArea(standardWindowBounds, display.workArea),
    )
  }
  if (standardAlwaysOnTop !== null) {
    mainWindow.setAlwaysOnTop(standardAlwaysOnTop, 'floating')
  }
  standardWindowBounds = null
  standardAlwaysOnTop = null
  isFocusMode = false
  return {
    active: false,
    alwaysOnTop: mainWindow.isAlwaysOnTop(),
  }
}

function registerShortcuts(): void {
  globalShortcut.register('CommandOrControl+Shift+Space', () => {
    if (!mainWindow) return
    if (mainWindow.isVisible()) {
      mainWindow.hide()
    } else {
      mainWindow.show()
      mainWindow.focus()
    }
  })

  globalShortcut.register('CommandOrControl+Shift+Enter', () => {
    if (!mainWindow) return
    mainWindow.show()
    mainWindow.webContents.send('desktop:shortcut', 'answer-screen')
  })
}

function getGenerator(): CopilotAnswerGenerator {
  generator ??= new CopilotAnswerGenerator()
  return generator
}

function getTranscriber(): LocalTranscriber {
  transcriber ??= new LocalTranscriber(
    join(app.getPath('userData'), 'models'),
    broadcastModelProgress,
  )
  return transcriber
}

function broadcastModelProgress(progress: ModelProgressPayload): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.webContents.isDestroyed()) {
      window.webContents.send('transcription:progress', progress)
    }
  }
}

function toFloat32Array(value: unknown): Float32Array {
  if (value instanceof ArrayBuffer) return new Float32Array(value)
  if (ArrayBuffer.isView(value)) {
    const bytes = new Uint8Array(
      value.buffer,
      value.byteOffset,
      value.byteLength,
    )
    return new Float32Array(bytes.slice().buffer)
  }

  throw new Error('Transcription requires a Float32 audio buffer.')
}

function desktopPlatform(): DesktopRuntimeInfo['platform'] {
  switch (process.platform) {
    case 'win32':
    case 'darwin':
    case 'linux':
      return process.platform
    default:
      return 'other'
  }
}

async function closeServices(): Promise<void> {
  if (!generator) return

  try {
    await generator.close()
  } catch (error) {
    console.error('[desktop] Copilot shutdown failed.', error)
  }
}
