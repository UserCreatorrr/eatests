'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useRef, useState } from 'react'
import { api, errorMessage } from '@/lib/api'
import { tk, ff } from '@/lib/design'
import { Btn, Field, Input, Note, Page, Panel } from '@/components/ui'

export default function PerfilPage() {
  const [user, setUser] = useState<any>(null)
  const [name, setName] = useState(''), [orgName, setOrgName] = useState(''), [msg, setMsg] = useState(''), [saving, setSaving] = useState(false)
  const [gmail, setGmail] = useState<boolean | null>(null)
  const [gmailMsg, setGmailMsg] = useState('')
  const avatarRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    api.get('/api/auth/me').then(d => { setUser(d.user); setName(d.user.name || ''); setOrgName(d.user.org_name || '') }).catch(() => {})
    api.get('/api/messaging/email/status').then(d => setGmail(d.configured)).catch(() => setGmail(false))
    const g = new URLSearchParams(window.location.search).get('gmail')
    if (g === 'ok') setGmailMsg('Gmail conectado: los pedidos por email ya se pueden enviar.')
    if (g === 'error') setGmailMsg('No se pudo conectar Gmail. Inténtalo de nuevo.')
  }, [])

  async function save() {
    setSaving(true); setMsg('')
    try { const d = await api.patch('/api/auth/me', { name: name.trim(), orgName: orgName.trim() || undefined }); setUser(d.user); setMsg('Guardado') } catch (e) { setMsg(errorMessage(e)) }
    setSaving(false)
  }
  async function onAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; e.target.value = ''
    if (!f) return
    if (f.size > 400_000) { setMsg('La imagen debe pesar menos de 400 KB'); return }
    const r = new FileReader()
    r.onload = async () => { try { const d = await api.patch('/api/auth/me', { avatar: r.result as string }); setUser(d.user) } catch (x) { setMsg(errorMessage(x)) } }
    r.readAsDataURL(f)
  }
  async function logoutAll() { if (!confirm('¿Cerrar la sesión en todos los dispositivos?')) return; await fetch('/api/auth/logout', { method: 'POST' }); window.location.href = '/login' }

  if (!user) return <div style={{ padding: 36, fontFamily: ff.mono, fontSize: 12, color: tk.iron60 }}>Cargando…</div>

  return (
    <Page eyebrow="Cuenta" title="Mi perfil" subtitle={`${user.email} · ${user.role === 'owner' ? 'propietario' : user.role} de ${user.org_name}`}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
        <Panel title="Datos">
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <button onClick={() => avatarRef.current?.click()} title="Cambiar foto" style={{ width: 64, height: 64, background: tk.apple, border: `1.5px solid ${tk.iron}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: 0 }}>
                {user.avatar ? <img src={user.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontFamily: ff.display, fontWeight: 700, fontSize: 24, color: tk.iron }}>{(user.name || user.email)[0].toUpperCase()}</span>}
              </button>
              <input ref={avatarRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onAvatar} />
              <div style={{ fontFamily: ff.mono, fontSize: 11, color: tk.iron60 }}>Haz clic en la foto para cambiarla (máx. 400 KB).</div>
            </div>
            <Field label="Nombre"><Input value={name} onChange={e => setName(e.target.value)} /></Field>
            {user.role === 'owner' && <Field label="Nombre del restaurante / organización"><Input value={orgName} onChange={e => setOrgName(e.target.value)} /></Field>}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}><Btn onClick={save} disabled={saving || !name.trim()}>GUARDAR</Btn>{msg && <span style={{ fontFamily: ff.mono, fontSize: 11, color: msg === 'Guardado' ? tk.appleDeep : tk.terra }}>{msg}</span>}</div>
          </div>
        </Panel>
        <div>
          <Panel title="Email de pedidos (Gmail)">
            <div style={{ padding: 20 }}>
              {gmailMsg && <Note tone={gmailMsg.startsWith('No') ? 'crit' : 'ok'}>{gmailMsg}</Note>}
              <p style={{ fontFamily: ff.mono, fontSize: 11.5, color: tk.iron60, margin: '0 0 12px', lineHeight: 1.5 }}>Los pedidos por email salen desde una cuenta de Gmail conectada. Solo se pide permiso para enviar, y el acceso se guarda cifrado.</p>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={{ fontFamily: ff.mono, fontSize: 11, color: gmail ? tk.appleDeep : tk.clay }}>{gmail == null ? '…' : gmail ? '● Conectado' : '○ Sin conectar'}</span>
                {user.role === 'owner' && <Btn kind="ghost" href="/api/messaging/email/auth">{gmail ? 'VOLVER A CONECTAR' : 'CONECTAR GMAIL'}</Btn>}
              </div>
            </div>
          </Panel>
          <Panel title="Sesión">
            <div style={{ padding: 20, display: 'flex', gap: 10, alignItems: 'center' }}>
              <Btn kind="danger" onClick={logoutAll}>CERRAR SESIÓN</Btn>
              <span style={{ fontFamily: ff.mono, fontSize: 11, color: tk.iron60 }}>La sesión se revoca en el servidor: el dispositivo tendrá que volver a entrar.</span>
            </div>
          </Panel>
        </div>
      </div>
    </Page>
  )
}
