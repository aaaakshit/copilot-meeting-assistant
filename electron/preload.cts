import type { IpcRendererEvent } from 'electron'
import type {
  AnswerDeltaPayload,
  DesktopBridge,
  DesktopGenerateRequest,
  DesktopShortcut,
  ModelProgressPayload,
} from '../shared/desktop-contracts.js'

const { contextBridge, ipcRenderer } = require('electron') as typeof import('electron')

function subscribe<T>(channel: string, listener: (payload: T) => void): () => void {
  const handler = (_event: IpcRendererEvent, payload: T) => {
    listener(payload)
  }
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.off(channel, handler)
}

const bridge: DesktopBridge = {
  isDesktop: true,
  getCopilotStatus: () => ipcRenderer.invoke('copilot:status'),
  getRuntimeInfo: () => ipcRenderer.invoke('desktop:runtime-info'),
  generateAnswer: (payload: DesktopGenerateRequest) =>
    ipcRenderer.invoke('copilot:generate', payload),
  abortAnswer: (requestId: string) =>
    ipcRenderer.invoke('copilot:abort', requestId),
  transcribeAudio: (samples: ArrayBuffer) =>
    ipcRenderer.invoke('transcription:run', samples),
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  toggleAlwaysOnTop: () => ipcRenderer.invoke('window:toggle-always-on-top'),
  setFocusMode: (enabled: boolean) =>
    ipcRenderer.invoke('window:set-focus-mode', enabled),
  onAnswerDelta: (listener: (payload: AnswerDeltaPayload) => void) =>
    subscribe('copilot:delta', listener),
  onModelProgress: (listener: (payload: ModelProgressPayload) => void) =>
    subscribe('transcription:progress', listener),
  onShortcut: (listener: (shortcut: DesktopShortcut) => void) =>
    subscribe('desktop:shortcut', listener),
}

contextBridge.exposeInMainWorld('meetingAssistantDesktop', bridge)
