import { Sparkles } from 'lucide-react'
import type {
  AnswerPreferences,
  CandidateContext,
} from '../../../shared/contracts'
import type {
  DesktopActions,
  DesktopViewModel,
} from '../model/desktopModel'

interface ProfileViewProps {
  model: DesktopViewModel
  actions: DesktopActions
}

export function ProfileView({ model, actions }: ProfileViewProps) {
  const updateContext = (field: keyof CandidateContext, value: string) => {
    actions.setContext({ ...model.context, [field]: value })
  }

  return (
    <main className="desktop-content profile-content">
      <div className="profile-intro">
        <h1>Ground answers in facts you can defend.</h1>
        <p>Saved locally and sent to Copilot only for answer generation.</p>
      </div>

      <label className="desktop-field">
        <span>Target role</span>
        <input
          value={model.context.targetRole}
          placeholder="Senior Product Engineer"
          onChange={(event) => updateContext('targetRole', event.target.value)}
        />
      </label>
      <label className="desktop-field">
        <span>Resume highlights *</span>
        <textarea
          value={model.context.resumeHighlights}
          rows={5}
          placeholder="Experience, skills, and measurable outcomes"
          onChange={(event) =>
            updateContext('resumeHighlights', event.target.value)
          }
        />
      </label>
      <label className="desktop-field">
        <span>Job description</span>
        <textarea
          value={model.context.jobDescription}
          rows={4}
          placeholder="Role requirements and company priorities"
          onChange={(event) =>
            updateContext('jobDescription', event.target.value)
          }
        />
      </label>
      <label className="desktop-field">
        <span>Evidence stories *</span>
        <textarea
          value={model.context.evidence}
          rows={7}
          placeholder="Situation → action → measurable result"
          onChange={(event) => updateContext('evidence', event.target.value)}
        />
      </label>

      <div className="desktop-preferences">
        <label>
          <span>Answer length</span>
          <select
            value={model.preferences.length}
            onChange={(event) =>
              actions.setPreferences({
                ...model.preferences,
                length: event.target.value as AnswerPreferences['length'],
              })
            }
          >
            <option value="concise">Concise</option>
            <option value="standard">Standard</option>
            <option value="detailed">Detailed</option>
          </select>
        </label>
        <label>
          <span>Tone</span>
          <select
            value={model.preferences.tone}
            onChange={(event) =>
              actions.setPreferences({
                ...model.preferences,
                tone: event.target.value as AnswerPreferences['tone'],
              })
            }
          >
            <option value="conversational">Conversational</option>
            <option value="confident">Confident</option>
            <option value="technical">Technical</option>
          </select>
        </label>
      </div>

      <div className="profile-actions">
        <button
          className="desktop-secondary-button"
          type="button"
          onClick={actions.loadDemo}
        >
          <Sparkles size={15} aria-hidden="true" />
          Load demo
        </button>
        <button
          className="desktop-primary-button"
          type="button"
          onClick={actions.saveProfile}
        >
          Save and return
        </button>
      </div>
    </main>
  )
}
