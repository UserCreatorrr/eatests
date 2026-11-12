// Único punto de contacto con OpenAI. Los servicios reciben estas funciones
// por parámetro, así los tests inyectan un doble y no tocan la red.
import type OpenAI from 'openai'

let client: OpenAI | null = null
async function openai(): Promise<OpenAI> {
  if (!client) {
    if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY no configurada')
    const mod = await import('openai')
    client = new mod.default({ apiKey: process.env.OPENAI_API_KEY })
  }
  return client
}

export interface ToolCall { id: string; name: string; arguments: string }
export interface LlmMessage { role: 'system' | 'user' | 'assistant' | 'tool'; content: any; tool_call_id?: string; tool_calls?: any[] }
export interface LlmResult { content: string | null; toolCalls: ToolCall[]; finishReason: string; raw?: any }
export interface LlmRequest { model?: string; messages: LlmMessage[]; tools?: any[]; json?: boolean; maxTokens?: number; temperature?: number }

/** Completa un chat; con `tools` el modelo puede pedir llamadas a herramientas. */
export type Llm = (req: LlmRequest) => Promise<LlmResult>

export const openaiLlm: Llm = async req => {
  const c = await openai()
  const resp = await c.chat.completions.create({
    model: req.model ?? 'gpt-4o-mini', messages: req.messages as any, tools: req.tools, tool_choice: req.tools ? 'auto' : undefined,
    response_format: req.json ? { type: 'json_object' } : undefined, max_tokens: req.maxTokens ?? 1500, temperature: req.temperature ?? 0.3,
  })
  const ch = resp.choices[0]
  return {
    content: ch?.message?.content ?? null, finishReason: ch?.finish_reason ?? 'stop', raw: ch?.message,
    toolCalls: (ch?.message?.tool_calls ?? []).map((t: any) => ({ id: t.id, name: t.function.name, arguments: t.function.arguments })),
  }
}

/** Visión → JSON. `images` son data URLs. */
export type VisionJson = (prompt: string, images: string[], opts?: { maxTokens?: number }) => Promise<any>

export const openaiVision: VisionJson = async (prompt, images, opts = {}) => {
  const c = await openai()
  const resp = await c.chat.completions.create({
    model: 'gpt-4o', response_format: { type: 'json_object' }, max_tokens: opts.maxTokens ?? 3000, temperature: 0.1,
    messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, ...images.map(url => ({ type: 'image_url' as const, image_url: { url, detail: 'high' as const } }))] }],
  })
  try { return JSON.parse(resp.choices[0]?.message?.content || '{}') } catch { return {} }
}

export type Transcribe = (file: File) => Promise<string>
export const openaiTranscribe: Transcribe = async file => {
  const c = await openai()
  const t = await c.audio.transcriptions.create({ file, model: 'whisper-1', language: 'es' })
  // Whisper alucina este pie de subtítulos en audios cortos o con silencio.
  return t.text.replace(/subt[ií]tulos realizados por la comunidad de amara\.org/gi, '').replace(/amara\.org/gi, '').trim()
}
