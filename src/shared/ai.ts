// Shared types for the optional AI writing buddy.

export type AiProvider = 'nanogpt' | 'openrouter' | 'gemini' | 'openai' | 'deepseek' | 'mistral' | 'groq' | 'local' | 'custom'

export interface ProviderInfo {
  label: string
  baseUrl: string
  /** Where to get a key ('' = none). */
  keyPage: string
  needsKey: boolean
}

export const AI_PROVIDERS: Record<AiProvider, ProviderInfo> = {
  nanogpt: { label: 'NanoGPT', baseUrl: 'https://nano-gpt.com/api/v1', keyPage: 'https://nano-gpt.com/api', needsKey: true },
  openrouter: { label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', keyPage: 'https://openrouter.ai/keys', needsKey: true },
  gemini: {
    label: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    keyPage: 'https://aistudio.google.com/apikey',
    needsKey: true
  },
  openai: { label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', keyPage: 'https://platform.openai.com/api-keys', needsKey: true },
  deepseek: { label: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', keyPage: 'https://platform.deepseek.com/api_keys', needsKey: true },
  mistral: { label: 'Mistral', baseUrl: 'https://api.mistral.ai/v1', keyPage: 'https://console.mistral.ai/api-keys', needsKey: true },
  groq: { label: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', keyPage: 'https://console.groq.com/keys', needsKey: true },
  local: { label: 'Local model (this or another computer)', baseUrl: 'http://localhost:1234/v1', keyPage: '', needsKey: false },
  custom: { label: 'Other (OpenAI-compatible)', baseUrl: '', keyPage: '', needsKey: false }
}

export type LocalProgram = 'lmstudio' | 'ollama' | 'koboldcpp' | 'textgen' | 'llamacpp' | 'jan'

/** Programs that run models on your own computer and offer an OpenAI-compatible server. */
export const LOCAL_PROGRAMS: Record<LocalProgram, { label: string; port: number; howTo: string }> = {
  lmstudio: {
    label: 'LM Studio',
    port: 1234,
    howTo: 'In LM Studio open the Developer tab, start the server, and (for another computer) turn on “Serve on Local Network”.'
  },
  ollama: {
    label: 'Ollama',
    port: 11434,
    howTo: 'For another computer: on that PC set the environment variable OLLAMA_HOST to 0.0.0.0, then restart Ollama.'
  },
  koboldcpp: { label: 'KoboldCpp', port: 5001, howTo: 'For another computer: start KoboldCpp with --host 0.0.0.0.' },
  textgen: { label: 'text-generation-webui', port: 5000, howTo: 'Start it with --api, and add --listen for another computer.' },
  llamacpp: { label: 'llama.cpp server', port: 8080, howTo: 'For another computer: start llama-server with --host 0.0.0.0.' },
  jan: { label: 'Jan', port: 1337, howTo: 'In Jan, turn on the Local API Server (set its host to 0.0.0.0 for another computer).' }
}

export function localBaseUrl(host: string, program: LocalProgram): string {
  const h = host.trim().replace(/^https?:\/\//i, '').replace(/[/:].*$/, '') || 'localhost'
  return `http://${h}:${LOCAL_PROGRAMS[program].port}/v1`
}

/** What the renderer may see. The API key itself never leaves the main process. */
export interface AiSettings {
  enabled: boolean
  provider: AiProvider
  baseUrl: string
  model: string
  /** 0 = careful, 1.5 = adventurous. */
  temperature: number
  /** Send less of the wiki along, for small local models. */
  shortContext: boolean
  /** For “local”: the computer running the model, and which program. */
  localHost: string
  localProgram: LocalProgram
  hasKey: boolean
  /** Last 4 characters of the saved key, to recognize it. */
  keyHint: string
}

export interface AiMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export type AiEvent =
  | { id: string; type: 'delta'; text: string }
  | { id: string; type: 'done' }
  | { id: string; type: 'error'; message: string }

export interface AiApi {
  getSettings(): Promise<AiSettings>
  saveSettings(patch: Partial<Omit<AiSettings, 'hasKey' | 'keyHint'>>): Promise<AiSettings>
  setKey(key: string | null): Promise<AiSettings>
  listModels(): Promise<string[]>
  /** Starts a streamed reply; pieces arrive through onEvent with the same id. */
  chat(id: string, messages: AiMessage[]): Promise<void>
  abort(id: string): Promise<void>
  onEvent(cb: (e: AiEvent) => void): () => void
}

/** How reasoning models mark their thinking: <think>…</think> (Qwen, DeepSeek…) and Gemma 4's <|channel>thought…<channel|>. */
const THINKING = [
  { open: '<think>', close: '</think>' },
  { open: '<thinking>', close: '</thinking>' },
  { open: '<reasoning>', close: '</reasoning>' },
  { open: '<|channel>thought', close: '<channel|>' },
  { open: '<|begin_of_thought|>', close: '<|end_of_thought|>' },
  { open: '[THINK]', close: '[/THINK]' },
  { open: '<seed:think>', close: '</seed:think>' }
]

/** Reasoning models (often local ones) write out their thinking; it isn't part of the answer. */
export function stripThinking(text: string): { text: string; thinking: boolean } {
  let out = text
  let thinking = false
  for (const { open, close } of THINKING) {
    // Some chat templates start the thinking in the prompt, so only the closing tag arrives: what's before it
    // is thinking. (A lone closing tag with nothing real after it is just a stray tag: only the tag goes.)
    const firstClose = out.indexOf(close)
    if (firstClose >= 0 && out.lastIndexOf(open, firstClose) < 0) {
      const after = out.slice(firstClose + close.length)
      out = after.replace(/<[^>]*>|\s/g, '') ? after : out.slice(0, firstClose) + after
    }
    for (;;) {
      const start = out.indexOf(open)
      if (start < 0) break
      const end = out.indexOf(close, start + open.length)
      if (end < 0) {
        // Still thinking: hide the rest until it finishes.
        out = out.slice(0, start)
        thinking = true
        break
      }
      out = out.slice(0, start) + out.slice(end + close.length)
    }
  }
  return { text: out.replace(/^\s+/, ''), thinking }
}
