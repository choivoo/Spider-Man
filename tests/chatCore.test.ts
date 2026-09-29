import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { DEFAULT_VARS, type ChatRequest } from '../src/ai/schema'

/** Talks to a local stub of the Messages API to verify the exact request we send and how we parse the reply. */
let server: http.Server
let seen: any[] = []
const reply = (text: string) => ({
  id: 'msg_test', type: 'message', role: 'assistant', model: 'claude-sonnet-5-5', stop_reason: 'end_turn', stop_sequence: null,
  content: [{ type: 'text', text }], usage: { input_tokens: 10, output_tokens: 10 },
})

beforeAll(async () => {
  server = http.createServer((req, res) => {
    let body = ''
    req.on('data', (c) => (body += c))
    req.on('end', () => {
      const j = JSON.parse(body); seen.push({ url: req.url, headers: req.headers, body: j })
      res.setHeader('content-type', 'application/json')
      if (j.output_config?.format) {
        res.end(JSON.stringify(reply(JSON.stringify({
          dialogue: '어, 안녕! 왔구나.', emotion: 'happy', emotionIntensity: 0.6, gesture: 'wave', face: 'smile', eyeExpression: 'normal',
          lookAtUser: true, animation: 'greet_01', suitAction: 'none', armAction: 'none',
          memoryCandidate: { content: 'The user said hi.', type: 'userFacts', importance: 20, tags: ['greeting'] },
        }))))
      } else res.end(JSON.stringify(reply('They greeted each other.')))
    })
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  process.env.ANTHROPIC_API_KEY = 'sk-test-not-real'
  process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})
afterAll(() => { server.close(); delete process.env.ANTHROPIC_API_KEY; delete process.env.ANTHROPIC_BASE_URL })

const req = (o: Partial<ChatRequest> = {}): ChatRequest => ({
  mode: 'chat', form: 'spider', maskOpen: false, armsDeployed: true, messages: [{ role: 'user', content: '안녕' }],
  memories: [{ id: '1', type: 'userFacts', content: 'Likes jazz', importance: 40, timestamp: 1, tags: [] }],
  summary: 'They met yesterday.', vars: DEFAULT_VARS, emotion: { emotion: 'neutral', intensity: 0.3 }, allowActions: true, ...o,
})

describe('chatCore → Claude', () => {
  it('sends a cached personality prompt + dynamic context and structured-output format, returns a sanitised response', async () => {
    seen = []
    const { handleChat } = await import('../server/chatCore')
    const out = await handleChat(req())
    expect(out.source).toBe('claude')
    expect(out.response.dialogue).toContain('안녕'); expect(out.response.gesture).toBe('wave'); expect(out.response.memoryCandidate?.importance).toBe(20)
    const b = seen[0].body
    expect(seen[0].url).toContain('/v1/messages'); expect(seen[0].headers['x-api-key']).toBe('sk-test-not-real')
    expect(b.model).toBe('claude-sonnet-5-5')
    expect(b.system[0].cache_control).toEqual({ type: 'ephemeral' })            // static personality is cacheable
    expect(b.system[0].text).toContain('Peter'); expect(b.system[0].text).toContain('Hero mode')
    expect(b.system[1].text).toContain('form: spider'); expect(b.system[1].text).toContain('Likes jazz'); expect(b.system[1].text).toContain('They met yesterday.')
    expect(b.output_config.format.type).toBe('json_schema')                     // structured output, no forced tool_choice
    expect(b.tool_choice).toBeUndefined(); expect(b.thinking).toBeUndefined()
    expect(b.messages).toEqual([{ role: 'user', content: '안녕' }])
  })
  it('summarize mode returns text', async () => {
    const { handleChat } = await import('../server/chatCore')
    const out = await handleChat(req({ mode: 'summarize' }))
    expect(out.summary).toBe('They greeted each other.')
  })
  it('rejects malformed client requests', async () => {
    const { requestSchema } = await import('../server/chatCore')
    expect(requestSchema.safeParse({ mode: 'chat' }).success).toBe(false)
    expect(requestSchema.safeParse(req()).success).toBe(true)
    expect(requestSchema.safeParse({ ...req(), messages: [] }).success).toBe(false)
  })
})
