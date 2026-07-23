import {
  AlertCircle,
  LoaderCircle,
} from 'lucide-react'
import type { ModelProgressPayload } from '../../../../shared/desktop-contracts'

interface CaptureNoticeProps {
  error: string
  progress: ModelProgressPayload | null
}

export function CaptureNotice({
  error,
  progress,
}: CaptureNoticeProps) {
  if (error) {
    return (
      <div className="capture-notice capture-notice-error">
        <AlertCircle size={13} aria-hidden="true" />
        {error}
      </div>
    )
  }
  if (!progress || progress.status === 'ready') return null

  return (
    <div className="capture-notice">
      <LoaderCircle className="spin" size={13} aria-hidden="true" />
      {progress.status === 'downloading'
        ? `Downloading local Whisper model${progress.progress === undefined ? '' : ` · ${progress.progress}%`}`
        : 'Loading local Whisper model…'}
    </div>
  )
}
