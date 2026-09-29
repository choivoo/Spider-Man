import { MemoryManager } from './memoryManager'
import { LocalMemoryStore, SessionMemoryStore, CloudMemoryStore } from './stores'
import { useSettings, type MemoryMode } from '../store/settingsStore'
import { useCharacterStore } from '../store/characterStore'
import { sendChat } from '../ai/claude'
import { DEFAULT_VARS, type ChatRequest } from '../ai/schema'

const makeStore = (m: MemoryMode) => (m === 'cloud' ? new CloudMemoryStore() : m === 'session' ? new SessionMemoryStore() : new LocalMemoryStore())

export const memory = new MemoryManager(makeStore(useSettings.getState().memoryMode))

/** Load persisted memory and hydrate the character (vars + recent chat) so the character "remembers" across visits. */
export async function initMemory() {
  await memory.load()
  const cs = useCharacterStore.getState()
  cs.patchVars(memory.vars)
  if (cs.messages.length === 0 && memory.turns.length) {
    for (const t of memory.turns.slice(-12)) cs.addMessage({ role: t.role, content: t.content })
  }
  let last = useSettings.getState().memoryMode
  useSettings.subscribe((s) => {
    if (s.memoryMode !== last) { last = s.memoryMode; void memory.setStore(makeStore(s.memoryMode), true) }
  })
}

/** Fold old turns into the running summary via the backend (no-op if it fails). */
export async function maybeSummarize() {
  if (!memory.needsSummary()) return
  const req: ChatRequest = {
    mode: 'summarize', form: 'peter', maskOpen: false, armsDeployed: false,
    messages: memory.turnsToSummarize(), memories: [], summary: memory.summary,
    vars: DEFAULT_VARS, emotion: { emotion: 'neutral', intensity: 0.3 }, allowActions: false,
  }
  if (!req.messages.length) return
  try {
    const r = await sendChat(req)
    if (r.summary) memory.applySummary(r.summary)
    else memory.applySummary(fallbackSummary(req.messages.map((m) => m.content)))
  } catch { /* try again later */ }
}

function fallbackSummary(lines: string[]) { return (memory.summary + ' ' + lines.join(' ')).slice(-600) }
