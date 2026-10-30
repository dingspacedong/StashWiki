// The optional AI writing buddy's connection to an OpenAI-compatible service (NanoGPT, OpenRouter, Gemini,
// a local model on this or another computer, ...). Everything here is inert until the user turns the buddy on;
// the app window itself still can't reach the internet.
import { ipcMain, safeStorage, session, type WebContents } from 'electron'
import { join } from 'path'
import { AI_PROVIDERS, LOCAL_PROGRAMS, localBaseUrl, type AiMessage, type AiProvider, type AiSettings, type LocalProgram } from '../shared/ai'
import { dataRoot, readJson, writeJson } from './store'

interface Stored {
  enabled: boolean
  provider: AiProvider
  baseUrl: string
  model: string
  temperature: number
  shortContext: boolean
  localHost: string
  localProgram: LocalProgram
  /** The API key, encrypted with the OS keystore (DPAPI on Windows, Keychain on macOS) when available. */
  key?: string
  keyEncrypted?: boolean
  keyHint?: string
}

const DEFAULTS: Stored = {
  enabled: false,
  provider: 'nanogpt',
  baseUrl: AI_PROVIDERS.nanogpt.baseUrl,
  model: '',
  temperature: 0.8,
  shortContext: false,
  localHost: 'localhost',
  localProgram: 'lmstudio'
}
const file = (): string => join(dataRoot(), 'ai.json')
const running = new Map<string, AbortController>()

/** Local models write long answers slowly but some servers stop them early unless asked for more. */
const LOCAL_MAX_TOKENS = 4096

async function load(): Promise<Stored> {
  const s = { ...DEFAULTS, ...(await readJson<Partial<Stored>>(file(), {})) }
  if (!(s.provider in AI_PROVIDERS)) s.provider = 'custom'
  if (!(s.localProgram in LOCAL_PROGRAMS)) s.localProgram = 'lmstudio'
  return s
}

function publicView(s: Stored): AiSettings {
  return {
    enabled: s.enabled,
    provider: s.provider,
    baseUrl: s.baseUrl,
    model: s.model,
    temperature: s.temperature,
    shortContext: s.shortContext,
    localHost: s.localHost,
    localProgram: s.localProgram,
    hasKey: !!s.key,
    keyHint: s.keyHint ?? ''
  }
}

function decryptKey(s: Stored): string {
  if (!s.key) return ''
  const buf = Buffer.from(s.key, 'base64')
  return s.keyEncrypted ? safeStorage.decryptString(buf) : buf.toString('utf8')
}

function endpoint(s: Stored, path: string): string {
  const base = (s.baseUrl || AI_PROVIDERS[s.provider].baseUrl).trim().replace(/\/+$/, '')
  if (!/^https?:\/\/[^/]+/i.test(base)) throw new Error('Set the service address (it should start with http:// or https://).')
  return base + path
}

function headers(s: Stored): Record<string, string> {
  const key = decryptKey(s)
  if (!key && AI_PROVIDERS[s.provider].needsKey) {
    throw new Error(`Add your ${AI_PROVIDERS[s.provider].label} API key first (Look & settings → AI writing buddy).`)
  }
  const h: Record<string, string> = {
    'Content-Type': 'application/json',
    // OpenRouter shows this name in its usage page; nothing about the user is sent.
    'X-Title': 'StashWiki'
  }
  if (key) h.Authorization = `Bearer ${key}`
  return h
}

async function errorText(res: Response): Promise<string> {
  const body = await res.text().catch(() => '')
  try {
    let j = JSON.parse(body)
    if (Array.isArray(j)) j = j[0] // Gemini wraps errors in a list
    const msg = j?.error?.message ?? j?.message ?? j?.error ?? j?.detail
    if (msg) return `${res.status}: ${typeof msg === 'string' ? msg : JSON.stringify(msg)}`
  } catch {
    // not JSON
  }
  return `${res.status} ${res.statusText}${body ? ': ' + body.slice(0, 300) : ''}`
}

/** Turn low-level network failures into something a person can act on. */
function friendly(e: unknown, s: Stored): string {
  const msg = String((e as Error)?.message ?? e)
  let host = ''
  try {
    host = new URL(s.baseUrl || AI_PROVIDERS[s.provider].baseUrl).host
  } catch {
    // keep it empty
  }
  if (/ERR_CONNECTION_REFUSED|ECONNREFUSED/.test(msg)) {
    return s.provider === 'local'
      ? `Couldn't connect to ${host}. Is ${LOCAL_PROGRAMS[s.localProgram].label} running there with its server turned on? ${LOCAL_PROGRAMS[s.localProgram].howTo}`
      : `Couldn't connect to ${host}. Check the address.`
  }
  if (/ERR_NAME_NOT_RESOLVED|ENOTFOUND/.test(msg)) return `Couldn't find a computer or service called “${host}”. Check the address.`
  if (/ERR_ADDRESS_UNREACHABLE|ERR_CONNECTION_TIMED_OUT|ETIMEDOUT|EHOSTUNREACH/.test(msg)) {
    return `${host} didn't answer. Make sure that computer is on, on the same network, and that its firewall allows the connection.`
  }
  if (/ERR_INTERNET_DISCONNECTED/.test(msg)) return 'This computer seems to be offline.'
  return msg
}

const aiSession = (): Electron.Session => session.fromPartition('stash-ai')

async function streamChat(sender: WebContents, id: string, messages: AiMessage[]): Promise<void> {
  const send = (e: object): void => {
    if (!sender.isDestroyed()) sender.send('ai:event', { id, ...e })
  }
  const s = await load()
  if (!s.enabled) return send({ type: 'error', message: 'The AI writing buddy is turned off.' })
  const ctrl = new AbortController()
  running.set(id, ctrl)
  try {
    if (!s.model) throw new Error('Choose a model first (Look & settings → AI writing buddy).')
    const body: Record<string, unknown> = { model: s.model, messages, temperature: s.temperature, stream: true }
    if (s.provider === 'local') body.max_tokens = LOCAL_MAX_TOKENS

    // Some models refuse settings others accept (e.g. a fixed temperature); drop the setting and try again.
    let res: Response
    for (let attempt = 0; ; attempt++) {
      res = await aiSession().fetch(endpoint(s, '/chat/completions'), {
        method: 'POST',
        headers: headers(s),
        body: JSON.stringify(body),
        signal: ctrl.signal
      })
      if (res.ok || res.status !== 400 || attempt >= 2) break
      const err = await errorText(res)
      const drop = ['temperature', 'max_tokens'].find((k) => k in body && err.toLowerCase().includes(k))
      if (!drop) throw new Error(err)
      delete body[drop]
    }
    if (!res.ok || !res.body) throw new Error(await errorText(res))

    // Server-sent events: lines of "data: {json}", ending with "data: [DONE]".
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let sawData = false
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let nl: number
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl).trim()
        buffer = buffer.slice(nl + 1)
        if (!line.startsWith('data:')) continue
        const data = line.slice(5).trim()
        if (data === '[DONE]') continue
        try {
          const j = JSON.parse(data)
          if (j.error) throw new Error(j.error.message ?? JSON.stringify(j.error))
          const text = j.choices?.[0]?.delta?.content ?? j.choices?.[0]?.message?.content
          if (text) {
            sawData = true
            send({ type: 'delta', text })
          }
        } catch (e) {
          if (e instanceof SyntaxError) continue
          throw e
        }
      }
    }
    // Some servers ignore stream:true and answer with one JSON body.
    if (!sawData && buffer.trim().startsWith('{')) {
      const j = JSON.parse(buffer)
      const text = j.choices?.[0]?.message?.content
      if (text) send({ type: 'delta', text })
    }
    send({ type: 'done' })
  } catch (e) {
    if (ctrl.signal.aborted) send({ type: 'done' })
    else send({ type: 'error', message: friendly(e, s) })
  } finally {
    running.delete(id)
  }
}

export function registerAiIpc(): void {
  ipcMain.handle('ai:getSettings', async () => publicView(await load()))

  ipcMain.handle('ai:saveSettings', async (_e, patch: Partial<Stored>) => {
    const s = await load()
    const next: Stored = { ...s }
    if (typeof patch.enabled === 'boolean') next.enabled = patch.enabled
    if (typeof patch.localHost === 'string') next.localHost = patch.localHost.trim() || 'localhost'
    if (patch.localProgram && patch.localProgram in LOCAL_PROGRAMS) next.localProgram = patch.localProgram
    if (patch.provider && patch.provider in AI_PROVIDERS && patch.provider !== s.provider) {
      next.provider = patch.provider
      if (patch.provider !== 'custom') next.baseUrl = AI_PROVIDERS[patch.provider].baseUrl
      // Small local models can't take the whole wiki; big hosted ones can.
      next.shortContext = patch.provider === 'local'
      next.model = ''
    }
    if (next.provider === 'local' && (patch.localHost !== undefined || patch.localProgram !== undefined || patch.provider === 'local')) {
      next.baseUrl = localBaseUrl(next.localHost, next.localProgram)
    }
    if (typeof patch.baseUrl === 'string') next.baseUrl = patch.baseUrl.trim()
    if (typeof patch.model === 'string') next.model = patch.model.trim()
    if (typeof patch.shortContext === 'boolean') next.shortContext = patch.shortContext
    if (typeof patch.temperature === 'number') next.temperature = Math.min(2, Math.max(0, patch.temperature))
    if (!next.enabled) for (const c of running.values()) c.abort()
    await writeJson(file(), next)
    return publicView(next)
  })

  ipcMain.handle('ai:setKey', async (_e, key: string | null) => {
    const s = await load()
    const k = key?.trim()
    if (!k) {
      delete s.key
      delete s.keyEncrypted
      delete s.keyHint
    } else if (safeStorage.isEncryptionAvailable()) {
      s.key = safeStorage.encryptString(k).toString('base64')
      s.keyEncrypted = true
      s.keyHint = k.slice(-4)
    } else {
      s.key = Buffer.from(k, 'utf8').toString('base64')
      s.keyEncrypted = false
      s.keyHint = k.slice(-4)
    }
    await writeJson(file(), s)
    return publicView(s)
  })

  ipcMain.handle('ai:listModels', async () => {
    const s = await load()
    if (!s.enabled) return []
    let res: Response
    try {
      res = await aiSession().fetch(endpoint(s, '/models'), { headers: headers(s) })
    } catch (e) {
      throw new Error(friendly(e, s))
    }
    if (!res.ok) throw new Error(await errorText(res))
    const j = await res.json()
    const list: { id?: string; name?: string }[] = Array.isArray(j) ? j : (j.data ?? j.models ?? [])
    return [
      ...new Set(
        list
          .map((m) => m.id ?? m.name ?? '')
          // Gemini lists "models/gemini-…"; chat requests use the bare name.
          .map((id) => id.replace(/^models\//, ''))
          .filter(Boolean)
      )
    ].sort((a, b) => a.localeCompare(b))
  })

  ipcMain.handle('ai:chat', (e, id: string, messages: AiMessage[]) => {
    void streamChat(e.sender, id, messages)
  })

  ipcMain.handle('ai:abort', (_e, id: string) => {
    running.get(id)?.abort()
  })
}
