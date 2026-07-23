import type {
  AnswerRequest,
  HealthResponse,
} from '../shared/contracts.js'
import type { ScreenAttachment } from '../shared/desktop-contracts.js'

export interface AnswerGenerator {
  getStatus(): Promise<HealthResponse>
  generate(
    request: AnswerRequest,
    onDelta: (content: string) => void,
    signal: AbortSignal,
    screen?: ScreenAttachment,
  ): Promise<void>
  close(): Promise<void>
}
