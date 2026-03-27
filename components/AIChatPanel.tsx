'use client'

import { useState, useRef, useEffect } from 'react'

interface Message {
  role: 'user' | 'assistant'
  content: string
  image?: string
}

const SUGGESTIONS = [
  '¿Qué ingredientes tenemos sin coste registrado?',
  'Muéstrame los últimos pedidos de compra',
  '¿Cuáles son nuestros proveedores principales?',
]

export default function AIChatPanel() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [pendingImage, setPendingImage] = useState<string | null>(null)
  const mediaRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])
  useEffect(() => { if (isOpen && messages.length === 0) inputRef.current?.focus() }, [isOpen])

  async function send(text: string, img?: string) {
    const t = text.trim()
    if (!t && !img) return
    const userMsg: Message = { role: 'user', content: t, image: img }
    const history = [...messages, userMsg]
    setMessages(history)
    setInput('')
    setPendingImage(null)
    setIsLoading(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history.map(m => ({ role: m.role, content: m.content })), image: img }),
      })
      if (!res.ok) throw new Error('Error')
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let reply = ''
      setMessages(prev => [...prev, { role: 'assistant', content: '' }])
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        reply += decoder.decode(value)
        setMessages(prev => { const u = [...prev]; u[u.length - 1] = { role: 'assistant', content: reply }; return u })
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Error al conectar con el asistente.' }])
    } finally { setIsLoading(false) }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      mediaRef.current = mr
      chunksRef.current = []
      mr.ondataavailable = e => chunksRef.current.push(e.data)
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        const fd = new FormData()
        fd.append('audio', blob, 'voice.webm')
        try {
          const r = await fetch('/api/voice', { method: 'POST', body: fd })
          const { text } = await r.json()
          if (text) send(text)
        } catch { /* ignore */ }
      }
      mr.start()
      setIsRecording(true)
    } catch { alert('No se pudo acceder al micrófono') }
  }

  function stopRecording() { mediaRef.current?.stop(); setIsRecording(false) }

  function handleImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setPendingImage(reader.result as string)
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(o => !o)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full flex items-center justify-center shadow-xl transition-transform hover:scale-105 active:scale-95"
        style={{ backgroundColor: '#19f973', color: '#2a2522' }}
        title="Asistente IA de Cocina"
      >
        {isOpen ? (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        )}
      </button>

      {isOpen && (
        <div
          className="fixed bottom-24 right-6 z-50 flex flex-col rounded-2xl shadow-2xl overflow-hidden"
          style={{ width: '380px', maxHeight: '72vh', backgroundColor: '#2a2522', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          <div className="flex items-center gap-3 px-5 py-4 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#19f973' }}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="#2a2522" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div className="flex-1">
              <p style={{ fontFamily: "'Chillax', sans-serif", fontWeight: 600, fontSize: '14px', color: '#dfd5c9' }}>Asistente de Cocina</p>
              <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: 'rgba(223,213,201,0.4)', letterSpacing: '0.05em' }}>GPT-4o mini · Whisper-1</p>
            </div>
            <button onClick={() => setMessages([])} style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: 'rgba(223,213,201,0.3)' }}>
              Limpiar
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4" style={{ minHeight: 0 }}>
            {messages.length === 0 && (
              <div className="py-4">
                <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '11px', color: 'rgba(223,213,201,0.3)', textAlign: 'center', marginBottom: '12px' }}>
                  Pregunta sobre tu cocina, sube una foto de albarán o usa la nota de voz
                </p>
                <div className="space-y-2">
                  {SUGGESTIONS.map(s => (
                    <button key={s} onClick={() => send(s)} className="w-full text-left rounded-xl px-3 py-2.5 hover:opacity-80"
                      style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', fontFamily: "'DM Mono', monospace", fontSize: '11px', color: 'rgba(223,213,201,0.55)' }}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} mb-3`}>
                <div className="max-w-[85%] rounded-2xl px-4 py-3"
                  style={{
                    backgroundColor: msg.role === 'user' ? '#19f973' : 'rgba(255,255,255,0.08)',
                    color: msg.role === 'user' ? '#2a2522' : '#dfd5c9',
                    fontFamily: "'DM Mono', monospace",
                    fontSize: '12px', lineHeight: '1.6', whiteSpace: 'pre-wrap',
                  }}
                >
                  {msg.image && <img src={msg.image} alt="" className="w-full rounded-lg mb-2 max-h-36 object-cover" />}
                  {msg.content}
                  {msg.role === 'assistant' && isLoading && i === messages.length - 1 && !msg.content && (
                    <span className="animate-pulse">▋</span>
                  )}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {pendingImage && (
            <div className="px-4 pb-2 flex-shrink-0">
              <div className="relative inline-block">
                <img src={pendingImage} alt="" className="h-16 rounded-lg object-cover" />
                <button onClick={() => setPendingImage(null)} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: '#dc2626', color: 'white' }}>x</button>
              </div>
            </div>
          )}

          <div className="px-4 py-3 flex-shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex items-center gap-2">
              <button onClick={() => fileRef.current?.click()} title="Foto albarán" className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: 'rgba(223,213,201,0.5)' }}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImage} />

              <button onClick={isRecording ? stopRecording : startRecording} title={isRecording ? 'Parar' : 'Nota de voz'} className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors" style={{ backgroundColor: isRecording ? '#19f973' : 'rgba(255,255,255,0.08)', color: isRecording ? '#2a2522' : 'rgba(223,213,201,0.5)' }}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </button>

              <input ref={inputRef} type="text" value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input, pendingImage || undefined) } }}
                placeholder={isRecording ? 'Grabando...' : 'Pregunta algo...'}
                disabled={isLoading || isRecording}
                className="flex-1 rounded-xl px-3 py-2 outline-none"
                style={{ backgroundColor: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', color: '#dfd5c9', fontFamily: "'DM Mono', monospace", fontSize: '12px' }}
              />

              <button onClick={() => send(input, pendingImage || undefined)} disabled={isLoading || (!input.trim() && !pendingImage)}
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 disabled:opacity-40"
                style={{ backgroundColor: '#19f973', color: '#2a2522' }}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
