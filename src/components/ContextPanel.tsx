import {
  BriefcaseBusiness,
  Database,
  FileText,
  RotateCcw,
  Sparkles,
} from 'lucide-react'
import type { CandidateContext } from '../../shared/contracts'

interface ContextPanelProps {
  context: CandidateContext
  onChange: (context: CandidateContext) => void
  onLoadDemo: () => void
  onClear: () => void
}

export function ContextPanel({
  context,
  onChange,
  onLoadDemo,
  onClear,
}: ContextPanelProps) {
  const evidenceSources = [
    context.resumeHighlights,
    context.jobDescription,
    context.evidence,
  ].filter((value) => value.trim().length > 0).length
  const isDemo = context.resumeHighlights.startsWith('[DEMO]')

  const update = (field: keyof CandidateContext, value: string) => {
    onChange({ ...context, [field]: value })
  }

  return (
    <aside className="context-panel">
      <div className="panel-heading">
        <div>
          <p className="section-kicker">Step 1</p>
          <h2>Evidence vault</h2>
        </div>
        <span className="local-badge">Local draft</span>
      </div>

      <div className="readiness">
        <div className="readiness-label">
          <span>Context readiness</span>
          <strong>{evidenceSources}/3 sources</strong>
        </div>
        <div className="readiness-track" aria-hidden="true">
          <span style={{ width: `${(evidenceSources / 3) * 100}%` }} />
        </div>
      </div>

      {isDemo && (
        <div className="demo-notice">
          <Sparkles size={15} aria-hidden="true" />
          Demo facts are loaded. Replace them before a real interview.
        </div>
      )}

      <div className="context-fields">
        <label className="field">
          <span className="field-label">
            <BriefcaseBusiness size={15} aria-hidden="true" />
            Target role
          </span>
          <input
            value={context.targetRole}
            maxLength={300}
            placeholder="e.g. Senior Product Engineer"
            onChange={(event) => update('targetRole', event.target.value)}
          />
        </label>

        <label className="field">
          <span className="field-label">
            <FileText size={15} aria-hidden="true" />
            Resume highlights
            <span className="required-dot" title="Required evidence">
              •
            </span>
          </span>
          <textarea
            value={context.resumeHighlights}
            maxLength={12_000}
            rows={6}
            placeholder="Paste concise experience, skills, and measurable outcomes."
            onChange={(event) => update('resumeHighlights', event.target.value)}
          />
        </label>

        <label className="field">
          <span className="field-label">
            <BriefcaseBusiness size={15} aria-hidden="true" />
            Job description
          </span>
          <textarea
            value={context.jobDescription}
            maxLength={12_000}
            rows={5}
            placeholder="Paste the role requirements and company priorities."
            onChange={(event) => update('jobDescription', event.target.value)}
          />
        </label>

        <label className="field">
          <span className="field-label">
            <Database size={15} aria-hidden="true" />
            Evidence stories
            <span className="required-dot" title="Required evidence">
              •
            </span>
          </span>
          <textarea
            value={context.evidence}
            maxLength={12_000}
            rows={7}
            placeholder={'Add STAR notes, one per line:\nSituation → action → measurable result'}
            onChange={(event) => update('evidence', event.target.value)}
          />
        </label>
      </div>

      <p className="privacy-note">
        Saved in localStorage and sent to Copilot only when you generate.
      </p>

      <div className="context-actions">
        <button className="secondary-button" type="button" onClick={onLoadDemo}>
          <Sparkles size={15} aria-hidden="true" />
          Load demo
        </button>
        <button className="ghost-button" type="button" onClick={onClear}>
          <RotateCcw size={15} aria-hidden="true" />
          Clear
        </button>
      </div>
    </aside>
  )
}
