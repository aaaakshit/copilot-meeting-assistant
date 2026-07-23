import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { basename, extname } from 'node:path'

const repositoryFiles = execFileSync(
  'git',
  ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
  { encoding: 'utf8' },
)
  .split('\0')
  .filter(Boolean)

const forbiddenNames = new Set([
  '.env',
  '.npmrc',
  'credentials.json',
  'service-account.json',
])
const forbiddenExtensions = new Set([
  '.db',
  '.jks',
  '.key',
  '.keystore',
  '.log',
  '.p12',
  '.pem',
  '.pfx',
  '.sqlite',
])
const secretPatterns = [
  {
    label: 'private key block',
    pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  },
  {
    label: 'GitHub token',
    pattern: /\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/,
  },
  {
    label: 'AWS access key',
    pattern: /\bAKIA[0-9A-Z]{16}\b/,
  },
  {
    label: 'Google API key',
    pattern: /\bAIza[0-9A-Za-z_-]{30,}\b/,
  },
  {
    label: 'Slack token',
    pattern: /\bxox[baprs]-[0-9A-Za-z-]{20,}\b/,
  },
  {
    label: 'assigned credential value',
    pattern:
      /\b(?:password|secret|api[_-]?key|access[_-]?token|client[_-]?secret)\b\s*[:=]\s*["'`](?!YOUR_|EXAMPLE_|REPLACE_|<)[^"'`\r\n]{8,}["'`]/i,
  },
]
const personalDataPatterns = [
  {
    label: 'absolute Windows user path',
    pattern: /\b[A-Z]:\\Users\\[^\\\r\n]+\\/i,
  },
  {
    label: 'personal email address',
    pattern:
      /\b[A-Z0-9._%+-]+@(?!users\.noreply\.github\.com\b)[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  },
]

const findings = []

for (const file of repositoryFiles) {
  if (!existsSync(file)) continue
  const name = basename(file).toLowerCase()
  const extension = extname(name)
  if (forbiddenNames.has(name) || forbiddenExtensions.has(extension)) {
    findings.push(`${file}: forbidden sensitive file type`)
    continue
  }

  const buffer = readFileSync(file)
  if (buffer.includes(0)) continue
  const content = buffer.toString('utf8')

  const patterns = file.endsWith('package-lock.json')
    ? secretPatterns
    : [...secretPatterns, ...personalDataPatterns]
  for (const { label, pattern } of patterns) {
    if (pattern.test(content)) findings.push(`${file}: ${label}`)
  }
}

if (findings.length > 0) {
  console.error('Source audit failed:')
  for (const finding of findings) console.error(`- ${finding}`)
  process.exitCode = 1
} else {
  console.log(`Source audit passed (${repositoryFiles.length} files checked).`)
}
