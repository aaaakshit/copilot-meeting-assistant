import {
  AlertCircle,
  Check,
  LoaderCircle,
} from 'lucide-react'
import type { HealthResponse } from '../../../../shared/contracts'

interface ConnectionStatusProps {
  health: HealthResponse | null
  onRetry: () => void
}

export function ConnectionStatus({
  health,
  onRetry,
}: ConnectionStatusProps) {
  return (
    <button
      className={`desktop-status status-${health?.status ?? 'checking'}`}
      type="button"
      title={health?.message || 'Checking Copilot connection'}
      onClick={onRetry}
    >
      {health?.status === 'ready' ? (
        <Check size={11} aria-hidden="true" />
      ) : health ? (
        <AlertCircle size={11} aria-hidden="true" />
      ) : (
        <LoaderCircle className="spin" size={11} aria-hidden="true" />
      )}
      {health?.status === 'ready'
        ? 'Copilot'
        : health?.status === 'needs-auth'
          ? 'Sign in'
          : health
            ? 'Retry'
            : 'Connecting'}
    </button>
  )
}
