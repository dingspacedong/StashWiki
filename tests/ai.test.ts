import { describe, expect, it } from 'vitest'
import { localBaseUrl, stripThinking } from '../src/shared/ai'
import { systemPrompt } from '../src/renderer/src/ai/context'
import { defaultTemplates, newPage } from '../src/shared/defaults'
import type { WikiMeta } from '../src/shared/types'

describe('local model addresses', () => {
  it('builds the address from the computer and program', () => {
    expect(localBaseUrl('192.168.1.20', 'lmstudio')).toBe('http://192.168.1.20:1234/v1')
    expect(localBaseUrl('', 'ollama')).toBe('http://localhost:11434/v1')
    expect(localBaseUrl(' http://gaming-pc:9999/whatever ', 'koboldcpp')).toBe('http://gaming-pc:5001/v1')
  })
})

describe('thinking text from reasoning models', () => {
  it('removes finished thinking', () => {
    expect(stripThinking('<think>plan it</think>\n\nHello!')).toEqual({ text: 'Hello!', thinking: false })
  })
  it('hides thinking that is still streaming', () => {
    expect(stripThinking('<think>still going')).toEqual({ text: '', thinking: true })
  })
  it('removes Gemma 4 thinking', () => {
    expect(stripThinking('<|channel>thought\nThe user wants a pirate.\n<channel|>Ahoy!')).toEqual({ text: 'Ahoy!', thinking: false })
    expect(stripThinking('<|channel>thought\nstill working')).toEqual({ text: '', thinking: true })
    expect(stripThinking('<|channel>thought\n<channel|>Hi <think>x</think>there')).toEqual({ text: 'Hi there', thinking: false })
  })
  it('leaves normal replies alone', () => {
    expect(stripThinking('Just text')).toEqual({ text: 'Just text', thinking: false })
  })
})

describe('short context for small models', () => {
  it('sends far less of a long page', () => {
    const t = defaultTemplates()
    const meta = { id: 'w', name: 'W', tagline: '', logo: '', mainPageId: null, createdAt: 0, categories: {}, theme: {} as WikiMeta['theme'], templates: t }
    const page = { ...newPage('Long', t[0]), body: '<p>' + 'word '.repeat(5000) + '</p>' }
    const pages = { [page.id]: page }
    const full = systemPrompt(meta, pages, page)
    const short = systemPrompt(meta, pages, page, true)
    expect(short.length).toBeLessThan(full.length - 7000)
    expect(short).toContain('rest of the page cut off')
  })
})
