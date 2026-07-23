import type { DesktopBridge } from '../../shared/desktop-contracts'

declare global {
  interface Window {
    meetingAssistantDesktop?: DesktopBridge
  }
}

export {}
