import fs from 'node:fs'
import path from 'node:path'

const FILES = [
  'identity.md', 'personality.md', 'speech-style.md', 'humor.md', 'emotion.md',
  'relationships.md', 'hero-mode.md', 'conversation-rules.md',
]

let cached: string | null = null

/** The static (cacheable) part of the system prompt, assembled from /personality. */
export function loadPersonalityPrompt(): string {
  if (cached) return cached
  const dir = path.join(process.cwd(), 'personality')
  const parts = FILES.map((f) => {
    try {
      return fs.readFileSync(path.join(dir, f), 'utf8')
    } catch {
      return ''
    }
  }).filter(Boolean)
  let examples = ''
  try {
    const ex = JSON.parse(fs.readFileSync(path.join(dir, 'examples.json'), 'utf8')) as { user: string; response: unknown }[]
    examples = '# Examples (tone/format reference only — never copy verbatim)\n' +
      ex.map((e) => `User: ${e.user}\nReply JSON: ${JSON.stringify(e.response)}`).join('\n\n')
  } catch { /* optional */ }
  cached = [
    'You are the brain of a real-time 3D character. Reply ONLY with the structured JSON object described by the schema.',
    'The `dialogue` field is what the character says out loud; every other field drives the 3D body, face and suit.',
    ...parts,
    examples,
  ].join('\n\n---\n\n')
  return cached
}
