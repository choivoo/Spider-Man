import { sendChat, ChatError } from './claude'
import { useCharacterStore } from '../store/characterStore'
import { useSettings } from '../store/settingsStore'
import { director } from '../character/director'
import { updateVars } from './emotions'
import { planActions } from './actions'
import { getWorld } from './executor'
import { voice } from '../audio/VoiceManager'
import { sanitizeForSpeech, VarietyGuard } from './personality'
import { memory, maybeSummarize } from '../memory'
import { isExplicitRemember } from '../memory/memoryManager'
import type { ChatRequest, CharacterResponse } from './schema'

const guard = new VarietyGuard()

/** Everything that happens between the user pressing Enter and the character reacting. */
export async function talk(text: string, opts: { source?: 'text' | 'voice' } = {}): Promise<CharacterResponse | null> {
  const s = useCharacterStore.getState()
  const clean = text.trim()
  if (s.busy || !clean) return null
  s.addMessage({ role: 'user', content: clean })
  s.setBusy(true)
  director.look.lookAtUser()
  memory.recordTurn('user', clean)
  try {
    const st = useCharacterStore.getState()
    const world = getWorld()
    const wctx = world?.context()
    const settings = useSettings.getState()
    const req: ChatRequest = {
      mode: 'chat',
      form: wctx?.form ?? 'peter',
      maskOpen: wctx?.maskOpen ?? false,
      armsDeployed: wctx?.armsDeployed ?? false,
      messages: st.messages.slice(-16).map((m) => ({ role: m.role, content: m.content })),
      memories: memory.relevant(clean),
      summary: memory.summary,
      vars: st.vars,
      emotion: st.emotion,
      locale: navigator.language,
      allowActions: settings.allowAIActions,
      secondsSinceLastTransform: wctx ? (Date.now() - wctx.lastTransformAt) / 1000 : undefined,
    }
    const res = await sendChat(req)
    const response = guard.apply({ ...res.response, dialogue: sanitizeForSpeech(res.response.dialogue) || res.response.dialogue })
    const cs = useCharacterStore.getState()
    cs.setConnection(res.source === 'offline' ? 'offline-demo' : 'ok')
    cs.addMessage({ role: 'assistant', content: response.dialogue, emotion: response.emotion })
    cs.patchVars(updateVars(cs.vars, { userText: clean, response, form: req.form }))
    memory.setVars(useCharacterStore.getState().vars)
    memory.recordTurn('assistant', response.dialogue)
    if (response.memoryCandidate) memory.add({ ...response.memoryCandidate, importance: isExplicitRemember(clean) ? Math.max(90, response.memoryCandidate.importance) : response.memoryCandidate.importance })
    else if (isExplicitRemember(clean)) memory.add({ content: `User said: ${clean.slice(0, 240)}`, type: 'importantEvents', importance: 90, tags: ['explicit'] })
    void maybeSummarize()
    director.perform(response)
    void voice.speak(response.dialogue, { emotion: response.emotion, intensity: response.emotionIntensity, spider: req.form === 'spider' })
    if (world) {
      const cmds = planActions(response, { ...world.context(), allowActions: settings.allowAIActions, now: Date.now() })
      if (cmds.length) world.run(cmds)
    }
    void opts
    return response
  } catch (e) {
    if (e instanceof ChatError) useCharacterStore.getState().setConnection('unavailable')
    return null
  } finally {
    useCharacterStore.getState().setBusy(false)
  }
}
