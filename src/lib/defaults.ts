import type {
  AnswerPreferences,
  CandidateContext,
} from '../../shared/contracts'

export const DEFAULT_CONTEXT: CandidateContext = {
  targetRole: '',
  resumeHighlights: '',
  jobDescription: '',
  evidence: '',
}

export const DEFAULT_PREFERENCES: AnswerPreferences = {
  length: 'standard',
  tone: 'conversational',
}

export const DEMO_CONTEXT: CandidateContext = {
  targetRole: 'Senior Product Engineer',
  resumeHighlights:
    '[DEMO] Five years building B2B web products with React and TypeScript. Led frontend architecture for a six-person product team. Strong focus on accessibility, observability, and developer experience.',
  jobDescription:
    '[DEMO] Own customer-facing workflows, partner with design and backend teams, improve reliability, and mentor engineers. The role values pragmatic technical decisions and measurable product outcomes.',
  evidence:
    '[DEMO] Checkout reliability: traced intermittent payment failures to duplicate client retries, introduced idempotency keys with the backend team, and reduced failed checkouts by 28%.\n\n[DEMO] Design system rollout: aligned three teams on shared accessible components, migrated the highest-traffic flows first, and reduced UI implementation time by roughly 35%.\n\n[DEMO] Incident leadership: coordinated a production recovery, kept support updated every 20 minutes, completed the rollback in 42 minutes, and added release health gates afterward.',
}
