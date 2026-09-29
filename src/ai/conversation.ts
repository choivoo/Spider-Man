import { sendChat, ChatError } from './claude'
import { useCharacterStore } from '../store/characterStore'
import { director } from '../character/director'
import type { ChatRequest, CharacterResponse } from './schema'

/** Sends the user's message through the AI pipeline and returns the parsed response (or null on failure). */
export async function talk(text: string): Promise<CharacterResponse | null> {
  const s = useCharacterStore.getState()
  if (s.busy || !text.trim()) return null
  s.addMessage({ role: 'user', content: text.trim() })
  s.setBusy(true)
  try {
    const st = useCharacterStore.getState()
    const req: ChatRequest = {
      mode: 'chat',
      form: 'peter',
      maskOpen: false,
      armsDeployed: false,
      messages: st.messages.slice(-16).map((m) => ({ role: m.role, content: m.content })),
      memories: [],
      summary: '',
      vars: st.vars,
      emotion: st.emotion,
      locale: navigator.language,
      allowActions: false,
    }
    const res = await sendChat(req)
    useCharacterStore.getState().setConnection(res.source === 'offline' ? 'offline-demo' : 'ok')
    useCharacterStore.getState().addMessage({ role: 'assistant', content: res.response.dialogue, emotion: res.response.emotion })
    director.perform(res.response)
    director.beginSpeech(res.response.dialogue)
    return res.response
  } catch (e) {
    if (e instanceof ChatError) useCharacterStore.getState().setConnection('unavailable')
    return null
  } finally {
    useCharacterStore.getState().setBusy(false)
  }
}
