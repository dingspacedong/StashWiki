import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { RELEASE_NOTES, notesSince } from '../src/renderer/src/lib/releaseNotes'

describe('what’s new after updating', () => {
  it('has notes for the version being released', () => {
    const version = JSON.parse(readFileSync('package.json', 'utf8')).version
    expect(RELEASE_NOTES[0].version).toBe(version)
  })
  it('shows every version since the last one opened, newest first', () => {
    expect(notesSince('0.15.0', '0.16.0', true).map((r) => r.version)).toEqual(['0.16.0', '0.15.2', '0.15.1'])
    expect(notesSince('0.15.2', '0.16.0', true).map((r) => r.version)).toEqual(['0.16.0'])
    expect(notesSince(null, '0.16.0', true).map((r) => r.version)).toEqual(['0.16.0'])
    expect(notesSince('0.1.0', '0.16.0', true)).toHaveLength(5)
  })
  it('leaves writing buddy notes out of the No-AI versions', () => {
    expect(notesSince('0.15.0', '0.16.0', false).map((r) => r.version)).toEqual(['0.16.0', '0.15.2'])
  })
})
