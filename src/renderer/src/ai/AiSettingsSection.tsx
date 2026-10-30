import { useEffect, useState } from 'react'
import { AI_PROVIDERS, LOCAL_PROGRAMS, stripThinking, type AiProvider, type LocalProgram } from '@shared/ai'
import { uid } from '@shared/defaults'
import { isMac } from '../lib/platform'
import { isReady, useAi } from './aiStore'

const THIS_COMPUTER = isMac ? 'this Mac' : 'this PC'

/** “Look & settings” section for the optional writing buddy. Off unless the user turns it on. */
export default function AiSettingsSection(): React.JSX.Element | null {
  const settings = useAi((s) => s.settings)
  const [key, setKey] = useState('')
  const [models, setModels] = useState<string[]>([])
  const [modelMsg, setModelMsg] = useState('')
  const [test, setTest] = useState('')

  useEffect(() => {
    void useAi.getState().loadSettings()
  }, [])
  if (!settings) return null
  const save = useAi.getState().saveSettings
  const provider = AI_PROVIDERS[settings.provider]
  const local = settings.provider === 'local'
  const canAsk = settings.hasKey || !provider.needsKey

  const turnOn = async (on: boolean): Promise<void> => {
    if (
      on &&
      !window.confirm(
        'Turn on the AI writing buddy?\n\nWhen you send it a message, that message — plus the page you are looking at, ' +
          'your page titles and template names — goes to the AI service you choose (NanoGPT, OpenRouter, Gemini, ' +
          'or a model running on your own computer). Nothing is sent until you press Send, and it can only suggest ' +
          'changes; you approve each one.\n\nYou can turn it off again here at any time.'
      )
    ) {
      return
    }
    await save({ enabled: on })
  }

  const loadModels = async (): Promise<void> => {
    setModelMsg('Loading…')
    try {
      const list = await window.stash.ai!.listModels()
      setModels(list)
      setModelMsg(list.length ? `${list.length} model${list.length === 1 ? '' : 's'} found — click the box below to pick one, or type to search.` : 'No models found. Load one in the program first.')
      if (list.length === 1 && !settings.model) await save({ model: list[0] })
    } catch (e) {
      setModelMsg('Couldn’t load models: ' + String((e as Error).message ?? e))
    }
  }

  const runTest = async (): Promise<void> => {
    setTest('Asking…')
    const id = uid()
    let reply = ''
    const off = window.stash.ai!.onEvent((e) => {
      if (e.id !== id) return
      if (e.type === 'delta') reply += e.text
      else {
        off()
        const clean = stripThinking(reply).text.trim()
        setTest(e.type === 'error' ? 'Didn’t work: ' + e.message : `It works! Reply: “${clean.slice(0, 80)}”`)
      }
    })
    await window.stash.ai!.chat(id, [{ role: 'user', content: 'Reply with just the word: Hello' }])
  }

  return (
    <section className="settings-section ai-settings">
      <h2>AI writing buddy</h2>
      <label className="check big-check">
        <input type="checkbox" checked={settings.enabled} onChange={(e) => void turnOn(e.target.checked)} />
        Turn on the AI writing buddy
      </label>
      {!settings.enabled && (
        <p className="muted">
          Off. An optional helper that brainstorms with you and drafts pages using an AI you pick: an online service (NanoGPT, OpenRouter, Google
          Gemini, …) or a model running on your own computer. While it’s off it is hidden everywhere and nothing is ever sent.
        </p>
      )}
      {settings.enabled && (
        <div className="ai-settings-body">
          <p className="muted">
            Open it with the <strong>✦ Buddy</strong> button at the top. It only sees what you send it, and every change it suggests waits for your
            Apply.
          </p>
          <label className="field">
            <span>Service</span>
            <select
              value={settings.provider}
              onChange={(e) => {
                setModels([])
                setModelMsg('')
                setTest('')
                void save({ provider: e.target.value as AiProvider })
              }}
            >
              {(Object.keys(AI_PROVIDERS) as AiProvider[]).map((p) => (
                <option key={p} value={p}>
                  {AI_PROVIDERS[p].label}
                </option>
              ))}
            </select>
          </label>

          {local && (
            <div className="ai-local">
              <label className="field">
                <span>Program running the model</span>
                <select value={settings.localProgram} onChange={(e) => void save({ localProgram: e.target.value as LocalProgram })}>
                  {(Object.keys(LOCAL_PROGRAMS) as LocalProgram[]).map((p) => (
                    <option key={p} value={p}>
                      {LOCAL_PROGRAMS[p].label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Which computer</span>
                <input
                  defaultValue={settings.localHost}
                  key={'host' + settings.localHost}
                  placeholder="localhost, or the other computer's address like 192.168.1.20"
                  spellCheck={false}
                  onBlur={(e) => e.target.value !== settings.localHost && void save({ localHost: e.target.value })}
                />
                <span className="hint">
                  Use <code>localhost</code> for {THIS_COMPUTER}. For another computer, use its local network address (on Windows: run{' '}
                  <code>ipconfig</code> there and look for “IPv4 Address”; on a Mac: System Settings → Wi-Fi → Details). {LOCAL_PROGRAMS[settings.localProgram].howTo}
                </span>
              </label>
            </div>
          )}

          <label className="field">
            <span>{local ? 'Address (filled in for you)' : 'Address (base URL)'}</span>
            <input
              defaultValue={settings.baseUrl}
              key={settings.provider + settings.baseUrl}
              placeholder="https://…/v1"
              spellCheck={false}
              onBlur={(e) => e.target.value !== settings.baseUrl && void save({ baseUrl: e.target.value })}
            />
          </label>

          <div className="field">
            <span>API key{provider.needsKey ? '' : ' (usually not needed)'}</span>
            {settings.hasKey ? (
              <div className="row gap">
                <span>Saved (ends in …{settings.keyHint})</span>
                <button className="link-btn danger" onClick={() => void useAi.getState().setKey(null)}>
                  Remove key
                </button>
              </div>
            ) : (
              <div className="row gap">
                <input
                  type="password"
                  className="grow"
                  value={key}
                  placeholder={provider.needsKey ? 'Paste your key' : 'Only if your server asks for one'}
                  spellCheck={false}
                  onChange={(e) => setKey(e.target.value)}
                />
                <button
                  className="btn small"
                  disabled={!key.trim()}
                  onClick={async () => {
                    await useAi.getState().setKey(key)
                    setKey('')
                  }}
                >
                  Save key
                </button>
              </div>
            )}
            <span className="hint">
              Stored encrypted on {THIS_COMPUTER} only — never in the wiki folder.
              {provider.keyPage && (
                <>
                  {' '}
                  <button className="link-btn" onClick={() => void window.stash.openExternal(provider.keyPage)}>
                    Get a {provider.label} key ↗
                  </button>
                </>
              )}
            </span>
          </div>

          <div className="field">
            <span>Model</span>
            <div className="row gap">
              <input
                className="grow"
                list="ai-models"
                defaultValue={settings.model}
                key={settings.provider + settings.model}
                placeholder={settings.provider === 'gemini' ? 'e.g. gemini-2.5-flash' : local ? 'Click “Load models”' : 'e.g. deepseek/deepseek-chat'}
                spellCheck={false}
                onBlur={(e) => e.target.value !== settings.model && void save({ model: e.target.value })}
              />
              <datalist id="ai-models">
                {models.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
              <button className="btn small ghost" disabled={!canAsk} onClick={() => void loadModels()}>
                Load models
              </button>
            </div>
            {modelMsg && <span className="hint">{modelMsg}</span>}
          </div>

          <label className="field">
            <span>
              Creativity: {settings.temperature.toFixed(1)} <span className="muted">(lower = careful, higher = adventurous)</span>
            </span>
            <input
              type="range"
              min={0}
              max={1.5}
              step={0.1}
              value={settings.temperature}
              onChange={(e) => useAi.setState({ settings: { ...settings, temperature: Number(e.target.value) } })}
              onMouseUp={(e) => void save({ temperature: Number((e.target as HTMLInputElement).value) })}
              onKeyUp={(e) => void save({ temperature: Number((e.target as HTMLInputElement).value) })}
            />
          </label>
          <label className="check">
            <input type="checkbox" checked={settings.shortContext} onChange={(e) => void save({ shortContext: e.target.checked })} />
            Send less at once <span className="muted">(for small local models that lose track or run out of room)</span>
          </label>
          <div className="row gap ai-test-row">
            <button className="btn small" disabled={!isReady(settings)} onClick={() => void runTest()}>
              Test connection
            </button>
            {test && <span className="muted">{test}</span>}
          </div>
        </div>
      )}
    </section>
  )
}
