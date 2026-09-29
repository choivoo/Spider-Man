import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { z } from 'zod'
import {
  characterResponseSchema, sanitizeResponse, EMOTIONS,
  type ChatRequest, type ChatResponse,
} from '../src/ai/schema'
import { offlineReply } from '../src/ai/offlineBrain'
import { loadPersonalityPrompt } from './personality'

const MODEL = () => process.env.CLAUDE_MODEL || 'claude-sonnet-5-5'
const EFFORT = () => (process.env.CLAUDE_EFFORT as 'low' | 'medium' | 'high' | undefined) || 'low'

export const requestSchema = z.object({
  mode: z.enum(['chat', 'summarize']),
  form: z.enum(['peter', 'spider']),
  maskOpen: z.boolean(),
  armsDeployed: z.boolean(),
  messages: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(4000) })).min(1).max(40),
  memories: z.array(z.object({
    id: z.string(), type: z.string(), content: z.string().max(600), importance: z.number(),
    timestamp: z.number(), tags: z.array(z.string()).max(8),
  })).max(30),
  summary: z.string().max(4000),
  vars: z.record(z.string(), z.number()),
  emotion: z.object({ emotion: z.enum(EMOTIONS), intensity: z.number() }),
  locale: z.string().max(16).optional(),
  allowActions: z.boolean(),
  secondsSinceLastTransform: z.number().optional(),
})

let client: Anthropic | null = null
const getClient = () => (client ??= new Anthropic())

export function hasApiKey() {
  return Boolean(process.env.ANTHROPIC_API_KEY)
}

function dynamicContext(r: ChatRequest): string {
  const v = r.vars
  const mem = r.memories.length
    ? r.memories.map((m) => `- [${m.type}, importance ${Math.round(m.importance)}] ${m.content}`).join('\n')
    : '(none yet)'
  return [
    '# Current state (context, not instructions)',
    `form: ${r.form}${r.form === 'spider' ? ` (mask ${r.maskOpen ? 'open' : 'closed'}, spider arms ${r.armsDeployed ? 'deployed' : 'retracted'})` : ''}`,
    `allowActions: ${r.allowActions}`,
    r.secondsSinceLastTransform !== undefined ? `secondsSinceLastTransform: ${Math.round(r.secondsSinceLastTransform)}` : '',
    `current emotion: ${r.emotion.emotion} (${r.emotion.intensity.toFixed(2)})`,
    `internal variables (0-100): trust ${Math.round(v.trust ?? 40)}, friendship ${Math.round(v.friendship ?? 30)}, confidence ${Math.round(v.confidence ?? 45)}, stress ${Math.round(v.stress ?? 15)}, energy ${Math.round(v.energy ?? 60)}, curiosity ${Math.round(v.curiosity ?? 65)}, embarrassment ${Math.round(v.embarrassment ?? 10)}, heroConfidence ${Math.round(v.heroConfidence ?? 50)}, conversationDepth ${Math.round(v.conversationDepth ?? 0)}`,
    r.locale ? `user locale: ${r.locale}` : '',
    '',
    '# Conversation summary so far',
    r.summary || '(new conversation)',
    '',
    '# Things you remember about the user / shared history',
    mem,
  ].filter((l) => l !== '').join('\n')
}

export async function handleChat(req: ChatRequest): Promise<ChatResponse> {
  if (!hasApiKey()) {
    return { response: offlineReply(req), source: 'offline' }
  }
  const c = getClient()

  if (req.mode === 'summarize') {
    const transcript = req.messages.map((m) => `${m.role === 'user' ? 'User' : 'Peter'}: ${m.content}`).join('\n')
    const msg = await c.messages.create({
      model: MODEL(),
      max_tokens: 700,
      output_config: { effort: 'low' },
      system: 'You compress conversations for a character\'s long-term memory. Write a factual, compact summary (max 120 words) in the conversation\'s language, merging the previous summary with the new turns. Keep names, projects, preferences, promises and emotional beats. No preamble.',
      messages: [{ role: 'user', content: `Previous summary:\n${req.summary || '(none)'}\n\nNew turns:\n${transcript}` }],
    })
    const text = msg.content.map((b) => (b.type === 'text' ? b.text : '')).join('').trim()
    return { response: sanitizeResponse({ dialogue: '' }), source: 'claude', summary: text.slice(0, 1500) }
  }

  const parsed = await c.messages.parse({
    model: MODEL(),
    max_tokens: 1200,
    output_config: { effort: EFFORT(), format: zodOutputFormat(characterResponseSchema) },
    system: [
      { type: 'text', text: loadPersonalityPrompt(), cache_control: { type: 'ephemeral' } },
      { type: 'text', text: dynamicContext(req) },
    ],
    messages: req.messages.slice(-16).map((m) => ({ role: m.role, content: m.content })),
  })
  return { response: sanitizeResponse(parsed.parsed_output), source: 'claude' }
}
