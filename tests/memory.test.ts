import { describe, it, expect } from 'vitest'
import { MemoryManager, looksSensitive, retention, tokens, isExplicitRemember } from '../src/memory/memoryManager'
import { SessionMemoryStore } from '../src/memory/stores'

const mk = () => new MemoryManager(new SessionMemoryStore())
const DAY = 86_400_000

describe('memory manager', () => {
  it('stores, dedups and merges', () => {
    const m = mk()
    m.add({ content: 'User is building a web game with Three.js', type: 'userFacts', importance: 60, tags: ['project'] })
    m.add({ content: 'The user is building a web game with three.js!', type: 'userFacts', importance: 75, tags: ['game'] })
    expect(m.items).toHaveLength(1)
    expect(m.items[0].importance).toBe(75)
    expect(m.items[0].tags.sort()).toEqual(['game', 'project'])
  })
  it('rejects sensitive content', () => {
    const m = mk()
    expect(m.add({ content: 'my api key is sk-abcdefghijklmnopqrstuvwxyz', type: 'userFacts', importance: 90 })).toBeNull()
    expect(looksSensitive('비밀번호는 1234')).toBe(true)
    expect(looksSensitive('I like pizza')).toBe(false)
  })
  it('forgets low-importance old memories but keeps important ones', () => {
    const m = mk(); const now = Date.now()
    m.add({ content: 'likes mint ice cream', type: 'userFacts', importance: 20 }, now - 60 * DAY)
    m.add({ content: 'user is writing a thesis about spiders', type: 'userFacts', importance: 60 }, now - 60 * DAY)
    m.add({ content: 'user said this is very important: birthday is May 3', type: 'importantEvents', importance: 90 }, now - 400 * DAY)
    m.prune(now)
    expect(m.items.map((x) => x.importance).sort()).toEqual([60, 90])
    expect(retention(m.items.find((i) => i.importance === 60)!, now)).toBeGreaterThan(20)
  })
  it('retrieves relevant memories (Korean + English)', () => {
    const m = mk()
    m.add({ content: '사용자는 웹 게임을 만들고 있다', type: 'userFacts', importance: 60, tags: ['game'] })
    m.add({ content: 'User likes jazz piano', type: 'userFacts', importance: 40, tags: ['music'] })
    expect(m.relevant('내 게임 어떻게 생각해?')[0].content).toContain('게임')
    expect(m.relevant('any good jazz recommendations?')[0].content).toContain('jazz')
  })
  it('summarises after enough turns and keeps recent turns', () => {
    const m = mk()
    for (let i = 0; i < 16; i++) { m.recordTurn('user', 'u' + i); m.recordTurn('assistant', 'a' + i) }
    expect(m.needsSummary()).toBe(true)
    expect(m.turnsToSummarize().length).toBeGreaterThan(0)
    m.applySummary('They talked about many things.')
    expect(m.turns.length).toBe(8); expect(m.needsSummary()).toBe(false)
    expect(m.summary).toContain('talked')
  })
  it('round-trips through a store', async () => {
    const m = mk(); m.add({ content: 'likes tea', type: 'userFacts', importance: 50 }); await m.flush()
    const m2 = new MemoryManager(m.store); await m2.load()
    expect(m2.items).toHaveLength(1)
  })
  it('does not persist sensitive turns', () => {
    const m = mk(); m.recordTurn('user', 'my password is hunter2'); m.recordTurn('user', 'I like tea')
    expect(JSON.stringify(m.snapshot())).not.toContain('hunter2'); expect(JSON.stringify(m.snapshot())).toContain('I like tea')
  })
  it('helpers', () => {
    expect(isExplicitRemember('이거 꼭 기억해')).toBe(true)
    expect(tokens('웹게임').has('웹게')).toBe(true)
  })
})
