import { useEffect, useRef, useState } from 'react'
import { useCharacterStore } from '../store/characterStore'
import { talk } from '../ai/conversation'

export default function Chat() {
  const messages = useCharacterStore((s) => s.messages)
  const busy = useCharacterStore((s) => s.busy)
  const connection = useCharacterStore((s) => s.connection)
  const [text, setText] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages.length, busy])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const t = text.trim()
    if (!t) return
    setText('')
    void talk(t)
  }

  return (
    <section className="chat" aria-label="Chat">
      <header className="chat-head">
        <span className="chat-title">Peter</span>
        {connection === 'offline-demo' && <span className="chip warn" title="Set ANTHROPIC_API_KEY on the server">demo brain</span>}
        {connection === 'unavailable' && <span className="chip err">offline</span>}
      </header>
      <div className="chat-log" role="log" aria-live="polite">
        {messages.length === 0 && <p className="hint">Say hi.</p>}
        {messages.map((m) => (
          <div key={m.id} className={`bubble ${m.role}`}>{m.content}</div>
        ))}
        {busy && <div className="bubble assistant typing" aria-label="typing"><i /><i /><i /></div>}
        {connection === 'unavailable' && <p className="notice">Connection temporarily unavailable.</p>}
        <div ref={endRef} />
      </div>
      <form className="chat-input" onSubmit={submit}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Message…" aria-label="Message" enterKeyHint="send" />
        <button type="submit" disabled={busy || !text.trim()}>Send</button>
      </form>
    </section>
  )
}
