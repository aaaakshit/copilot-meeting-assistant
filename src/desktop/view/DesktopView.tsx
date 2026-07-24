import {
  Blend,
  CircleStop,
  Minus,
  Pin,
  PinOff,
  Radio,
  Settings2,
  Sparkles,
  X,
} from 'lucide-react'
import type { DesktopPresenter } from '../model/desktopModel'
import { ConnectionStatus } from './components/ConnectionStatus'
import { FocusView } from './FocusView'
import { LiveView } from './LiveView'
import { ProfileView } from './ProfileView'

export function DesktopView({ model, actions }: DesktopPresenter) {
  return (
    <div
      className={`desktop-app ${model.focusMode ? 'desktop-app-focus' : ''}`}
      style={model.style}
      data-runtime-ready={String(model.runtimeReady)}
      data-focus-mode={String(model.focusMode)}
    >
      <header className="desktop-titlebar">
        <div className="desktop-brand">
          <span className="desktop-brand-mark">
            <Sparkles size={14} aria-hidden="true" />
          </span>
          Meeting Assistant
          <span className="desktop-live-badge">LIVE</span>
        </div>
        <div className="window-actions">
          {model.focusMode && (
            <button
              className="focus-stop-button"
              type="button"
              title="Stop listening and return to setup"
              onClick={() => void actions.stopCapture()}
            >
              <CircleStop size={14} aria-hidden="true" />
              Stop listening
            </button>
          )}
          <button
            className={
              model.showAppearance
                ? 'appearance-button active'
                : 'appearance-button'
            }
            type="button"
            title="Adjust transparency"
            aria-expanded={model.showAppearance}
            onClick={actions.toggleAppearance}
          >
            <Blend size={15} aria-hidden="true" />
          </button>
          <button
            type="button"
            title={
              model.alwaysOnTop
                ? 'Disable always on top'
                : 'Keep always on top'
            }
            onClick={() => void actions.toggleAlwaysOnTop()}
          >
            {model.alwaysOnTop ? (
              <Pin size={14} aria-hidden="true" />
            ) : (
              <PinOff size={14} aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            title="Minimize"
            onClick={() => void actions.minimizeWindow()}
          >
            <Minus size={15} aria-hidden="true" />
          </button>
          <button
            className="window-close"
            type="button"
            title="Close"
            onClick={() => void actions.closeWindow()}
          >
            <X size={15} aria-hidden="true" />
          </button>
        </div>
        {model.showAppearance && (
          <div className="appearance-popover">
            <div className="appearance-heading">
              <span>Overlay visibility</span>
              <strong>{model.glassLevel}%</strong>
            </div>
            <input
              type="range"
              min="30"
              max="98"
              step="1"
              value={model.glassLevel}
              aria-label="Overlay visibility"
              onChange={(event) =>
                actions.setGlassLevel(Number(event.target.value))
              }
            />
            <div className="appearance-presets">
              <button type="button" onClick={() => actions.setGlassLevel(42)}>
                Ghost
              </button>
              <button type="button" onClick={() => actions.setGlassLevel(72)}>
                Balanced
              </button>
              <button type="button" onClick={() => actions.setGlassLevel(94)}>
                Focus
              </button>
            </div>
            <p>Text remains opaque while the meeting shows through panels.</p>
          </div>
        )}
      </header>

      {model.focusMode ? (
        <FocusView model={model} actions={actions} />
      ) : (
        <>
          <nav className="desktop-tabs" aria-label="Desktop views">
        <button
          className={model.page === 'live' ? 'active' : ''}
          type="button"
          onClick={() => actions.setPage('live')}
        >
          <Radio size={14} aria-hidden="true" />
          Live
        </button>
        <button
          className={model.page === 'profile' ? 'active' : ''}
          type="button"
          onClick={() => actions.setPage('profile')}
        >
          <Settings2 size={14} aria-hidden="true" />
          Profile
        </button>
        <ConnectionStatus
          health={model.health}
          onRetry={() => void actions.refreshStatus()}
        />
          </nav>

          {model.page === 'live' ? (
            <LiveView model={model} actions={actions} />
          ) : (
            <ProfileView model={model} actions={actions} />
          )}

          <footer className="desktop-footer">
            <span>Ctrl+Shift+Space: hide/show</span>
            <span>Ctrl+Shift+Enter: read screen</span>
          </footer>
        </>
      )}
    </div>
  )
}
