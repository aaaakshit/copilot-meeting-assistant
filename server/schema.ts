import { z } from 'zod'

const limitedText = (max: number) => z.string().trim().max(max)

export const answerRequestSchema = z
  .object({
    question: limitedText(2_000).min(3, 'Enter a complete interview question.'),
    mode: z.enum(['general', 'coding']).default('general'),
    codingLanguage: z
      .enum([
        'auto',
        'typescript',
        'javascript',
        'python',
        'java',
        'csharp',
        'cpp',
        'go',
        'rust',
        'sql',
      ])
      .default('auto'),
    context: z.object({
      targetRole: limitedText(300),
      resumeHighlights: limitedText(12_000),
      jobDescription: limitedText(12_000),
      evidence: limitedText(12_000),
    }),
    preferences: z.object({
      length: z.enum(['concise', 'standard', 'detailed']),
      tone: z.enum(['conversational', 'confident', 'technical']),
    }),
  })
  .strict()
  .refine(
    ({ context, mode }) =>
      mode === 'coding' ||
      context.resumeHighlights.length > 0 ||
      context.evidence.length > 0,
    {
      message:
        'Add resume highlights or at least one evidence story before generating an answer.',
      path: ['context'],
    },
  )
