import {
  AlertCircle,
  CheckCircle2,
  LoaderCircle,
  RefreshCw,
} from 'lucide-react'
import type { HealthResponse } from '../../shared/contracts'

interface StatusBadgeProps {
  health: HealthResponse | null
  checking: boolean
  onRetry: () => void
}

export function StatusBadge({
  health,
  checking,
  onRetry,
}: StatusBadgeProps) {
  if (checking) {
    return (
      <div className="status-badge status-checking" role="status">
        <LoaderCircle className="spin" size={15} aria-hidden="true" />
        Connecting to Copilot
      </div>
    )
  }

  if (health?.status === 'ready') {
    return (
      <button
        className="status-badge status-ready"
        type="button"
        title={`${health.message}. Click to recheck.`}
        onClick={onRetry}
      >
        <CheckCircle2 size={15} aria-hidden="true" />
        Copilot ready
        {health.login && <span className="status-user">@{health.login}</span>}
      </button>
    )
  }

  return (
    <button
      className="status-badge status-problem"
      type="button"
      title={health?.message || 'Copilot is unavailable.'}
      onClick={onRetry}
    >
      {health?.status === 'needs-auth' ? (
        <AlertCircle size={15} aria-hidden="true" />
      ) : (
        <RefreshCw size={15} aria-hidden="true" />
      )}
      {health?.status === 'needs-auth' ? 'Sign in required' : 'Retry Copilot'}
    </button>
  )
}
