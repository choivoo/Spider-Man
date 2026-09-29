import { speechInput, voice } from '../audio/VoiceManager'
import { useCharacterStore } from '../store/characterStore'
import { talk } from '../ai/conversation'

/** Push-to-talk toggle: start listening, or stop and send what was heard. */
export function toggleMic() {
  const st = useCharacterStore.getState()
  if (st.voice.listening) { speechInput.stop(); return }
  speechInput.start((text) => { void talk(text, { source: 'voice' }) })
}
export const cancelVoice = () => { speechInput.cancel(); voice.stop() }
