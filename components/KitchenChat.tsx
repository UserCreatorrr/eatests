'use client'

import { useState, useRef, useEffect } from 'react'

interface Message {
  role: 'user' | 'assistant'
  content: string
  image?: string
}

interface StoredConvo {
  messages: Message[]
  lastUsed: number  // timestamp ms
}

const SUGGESTIONS = [
  'Ingredientes sin coste registrado',
  'Ultimos pedidos de compra',
  'Proveedores principales',
  'Resumen de costes',
]

const STORAGE_KEY = 'mb_chat_history'
const CURRENT_KEY = 'mb_chat_current'
const MAX_HISTORY = 15
const EXPIRY_MS = 15 * 24 * 60 * 60 * 1000 // 15 days

function loadHistory(): StoredConvo[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    const now = Date.now()
    // Filter out expired and ensure format
    return (raw as any[])
      .filter(c => c && c.messages && c.lastUsed && (now - c.lastUsed) < EXPIRY_MS)
      .slice(0, MAX_HISTORY)
  } catch { return [] }
}

function saveHistory(convos: StoredConvo[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(convos.slice(0, MAX_HISTORY)))
  } catch {}
}

function loadCurrent(): Message[] {
  try {
    return JSON.parse(localStorage.getItem(CURRENT_KEY) || '[]')
  } catch { return [] }
}

function saveCurrent(messages: Message[]) {
  try {
    localStorage.setItem(CURRENT_KEY, JSON.stringify(messages))
  } catch {}
}

export default function KitchenChat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [history, setHistory] = useState<StoredConvo[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [pendingImage, setPendingImage] = useState<string | null>(null)
  const [actionMsg, setActionMsg] = useState('')
  const mediaRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)

  // Restore current conversation and history on mount
  useEffect(() => {
    const current = loadCurrent()
    if (current.length > 0) setMessages(current)
    setHistory(loadHistory())
  }, [])

  // Persist current conversation on every change
  useEffect(() => {
    saveCurrent(messages)
  }, [messages])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function newConversation() {
    if (messages.length > 0) {
      const convo: StoredConvo = { messages, lastUsed: Date.now() }
      const updated = [convo, ...history].slice(0, MAX_HISTORY)
      setHistory(updated)
      saveHistory(updated)
    }
    setMessages([])
    saveCurrent([])
    setActionMsg('')
  }

  function loadConversation(convo: StoredConvo) {
    // Save current first
    if (messages.length > 0) {
      const c: StoredConvo = { messages, lastUsed: Date.now() }
      const updated = [c, ...history.filter(h => h !== convo)].slice(0, MAX_HISTORY)
      setHistory(updated)
      saveHistory(updated)
    }
    setMessages(convo.messages)
    saveCurrent(convo.messages)
    setShowHistory(false)
  }

  function deleteConversation(idx: number, e: React.MouseEvent) {
    e.stopPropagation()
    const updated = history.filter((_, i) => i !== idx)
    setHistory(updated)
    saveHistory(updated)
  }

  async function send(text: string, img?: string) {
    const t = text.trim()
    if (!t && !img) return
    const userMsg: Message = { role: 'user', content: t, image: img }
    const history2 = [...messages, userMsg]
    setMessages(history2)
    setInput('')
    setPendingImage(null)
    setIsLoading(true)
    setActionMsg('')
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history2.map(m => ({ role: m.role, content: m.content })),
          image: img,
        }),
      })
      if (!res.ok) throw new Error('Error')

      const contentType = res.headers.get('content-type') || ''

      if (contentType.includes('application/json')) {
        const json = await res.json()
        if (json.action) setActionMsg(json.action)
        if (json.reply) setMessages(prev => [...prev, { role: 'assistant', content: json.reply }])
      } else {
        const reader = res.body!.getReader()
        const decoder = new TextDecoder()
        let reply = ''
        setMessages(prev => [...prev, { role: 'assistant', content: '' }])
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          reply += decoder.decode(value)
          setMessages(prev => {
            const u = [...prev]
            u[u.length - 1] = { role: 'assistant', content: reply }
            return u
          })
        }
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Error al conectar.' }])
    } finally {
      setIsLoading(false)
    }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      mediaRef.current = mr
      chunksRef.current = []
      mr.ondataavailable = (e) => chunksRef.current.push(e.data)
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        const fd = new FormData()
        fd.append('audio', blob, 'voice.webm')
        const r = await fetch('/api/voice', { method: 'POST', body: fd })
        const { text } = await r.json()
        if (text) send(text)
      }
      mr.start()
      setIsRecording(true)
    } catch {
      alert('No se pudo acceder al microfono')
    }
  }

  function stopRecording() {
    mediaRef.current?.stop()
    setIsRecording(false)
  }

  function handleImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setPendingImage(reader.result as string)
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const iconAI = (
    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#2a2522" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  )

  return (
    <div style={{ display: 'flex', height: '100%', backgroundColor: '#f5f2ee' }}>

      {/* History panel */}
      {showHistory && (
        <div style={{ width: 280, flexShrink: 0, backgroundColor: '#fff', borderRight: '1px solid #e8e2db', display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ padding: '20px 16px 12px', borderBottom: '1px solid #e8e2db', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            <span style={{ fontFamily: 'Chillax, sans-serif', fontWeight: 600, fontSize: 14, color: '#3d3834' }}>Conversaciones</span>
            <button onClick={() => setShowHistory(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3d3834', opacity: 0.4, fontSize: 18, lineHeight: 1 }}>x</button>
          </div>
          {history.length === 0 ? (
            <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#3d3834', opacity: 0.4, padding: 16 }}>Sin conversaciones guardadas.</p>
          ) : (
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {history.map((convo, i) => {
                const preview = convo.messages.find(m => m.role === 'user')?.content || '...'
                const date = new Date(convo.lastUsed)
                return (
                  <div key={i} onClick={() => loadConversation(convo)} style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid #f5f2ee', cursor: 'pointer' }}>
                    <div style={{ flex: 1, padding: '12px 16px' }}>
                      <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#3d3834', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {preview.slice(0, 50)}
                      </p>
                      <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#3d3834', opacity: 0.4, margin: '3px 0 0' }}>
                        {convo.messages.length} mensajes · {date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                    <button onClick={(e) => deleteConversation(i, e)} style={{ padding: '0 12px', background: 'none', border: 'none', cursor: 'pointer', color: '#3d3834', opacity: 0.25, fontSize: 16 }}>x</button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Main chat */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, height: '100%' }}>
        <div style={{ flexShrink: 0, padding: '16px 40px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button onClick={() => setShowHistory(s => !s)} style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#3d3834', opacity: 0.4, background: 'none', border: 'none', cursor: 'pointer' }}>
            {showHistory ? 'Ocultar historial' : `Historial (${history.length})`}
          </button>
          {messages.length > 0 && (
            <button onClick={newConversation} style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#3d3834', opacity: 0.4, background: 'none', border: 'none', cursor: 'pointer' }}>
              Nueva conversacion
            </button>
          )}
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 40px 16px' }}>
          <div style={{ maxWidth: '720px', margin: '0 auto' }}>

            {messages.length === 0 && (
              <div style={{ paddingTop: 40, paddingBottom: 24 }}>
                <div style={{ width: 64, height: 64, borderRadius: 18, backgroundColor: '#19f973', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                  <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="#2a2522" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <p style={{ fontFamily: 'Chillax, sans-serif', fontWeight: 600, fontSize: 20, color: '#3d3834', textAlign: 'center', margin: '0 0 6px' }}>
                  En que te ayudo hoy?
                </p>
                <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#3d3834', opacity: 0.4, textAlign: 'center', margin: '0 0 28px' }}>
                  Pregunta sobre tu cocina, sube una foto de albaran o graba una nota de voz
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {SUGGESTIONS.map(s => (
                    <button key={s} onClick={() => send(s)} style={{ textAlign: 'left', backgroundColor: '#ffffff', border: '1px solid #e8e2db', borderRadius: 14, padding: '14px 16px', fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#3d3834', cursor: 'pointer' }}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {actionMsg && (
              <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: '10px 16px', marginBottom: 12 }}>
                <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#166534', margin: 0 }}>Accion ejecutada: {actionMsg}</p>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {messages.map((msg, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', alignItems: 'flex-start', gap: 10 }}>
                  {msg.role === 'assistant' && (
                    <div style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0, backgroundColor: '#19f973', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 4 }}>
                      {iconAI}
                    </div>
                  )}
                  <div style={{ maxWidth: '78%', borderRadius: 18, padding: '12px 18px', backgroundColor: msg.role === 'user' ? '#3d3834' : '#ffffff', color: msg.role === 'user' ? '#dfd5c9' : '#3d3834', fontFamily: 'DM Mono, monospace', fontSize: 13, lineHeight: 1.65, whiteSpace: 'pre-wrap', border: msg.role === 'assistant' ? '1px solid #e8e2db' : 'none' }}>
                    {msg.image && <img src={msg.image} alt="" style={{ width: '100%', borderRadius: 10, marginBottom: 10, maxHeight: 200, objectFit: 'cover' }} />}
                    {msg.content}
                    {msg.role === 'assistant' && isLoading && i === messages.length - 1 && !msg.content && (
                      <span style={{ color: '#19f973' }}>|</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div ref={bottomRef} />
          </div>
        </div>

        {/* Input */}
        <div style={{ flexShrink: 0, padding: '8px 40px 32px' }}>
          <div style={{ maxWidth: '720px', margin: '0 auto' }}>
            {pendingImage && (
              <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <img src={pendingImage} alt="" style={{ height: 52, borderRadius: 10, objectFit: 'cover' }} />
                  <button onClick={() => setPendingImage(null)} style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%', backgroundColor: '#dc2626', color: 'white', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer' }}>x</button>
                </div>
                <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#3d3834', opacity: 0.4 }}>Foto adjunta</p>
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: '#ffffff', border: '1.5px solid #e8e2db', borderRadius: 18, padding: '8px 10px' }}>
              {/* Galería */}
              <button onClick={() => fileRef.current?.click()} title="Subir foto" style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, backgroundColor: '#f5f2ee', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3d3834', opacity: 0.55 }}>
                <svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </button>
              {/* Cámara */}
              <button onClick={() => cameraRef.current?.click()} title="Abrir camara" style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, backgroundColor: '#f5f2ee', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3d3834', opacity: 0.55 }}>
                <svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImage} />
              <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleImage} />
              {/* Micro */}
              <button onClick={isRecording ? stopRecording : startRecording} title={isRecording ? 'Detener' : 'Nota de voz'} style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, backgroundColor: isRecording ? '#19f973' : '#f5f2ee', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isRecording ? '#2a2522' : '#3d3834', opacity: isRecording ? 1 : 0.55 }}>
                {isRecording
                  ? <span style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: '#2a2522', display: 'block' }} />
                  : <svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                }
              </button>
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input, pendingImage || undefined) } }}
                placeholder={isRecording ? 'Grabando nota de voz...' : 'Pregunta algo sobre tu cocina...'}
                disabled={isLoading || isRecording}
                autoFocus
                style={{ flex: 1, outline: 'none', background: 'transparent', border: 'none', fontFamily: 'DM Mono, monospace', fontSize: 13, color: '#3d3834' }}
              />
              <button onClick={() => send(input, pendingImage || undefined)} disabled={isLoading || (!input.trim() && !pendingImage)} style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, backgroundColor: '#19f973', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2a2522', opacity: isLoading || (!input.trim() && !pendingImage) ? 0.3 : 1 }}>
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            </div>
            <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#3d3834', opacity: 0.28, textAlign: 'center', marginTop: 8 }}>
              Accede a datos detallados desde el menu lateral
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
