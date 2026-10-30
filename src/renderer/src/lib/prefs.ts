// Settings for this computer only (not saved in any wiki): which editing style to use.
import { create } from 'zustand'

const SIMPLE_KEY = 'sw-simple-editing'

function load(): boolean {
  try {
    return localStorage.getItem(SIMPLE_KEY) === '1'
  } catch {
    return false
  }
}

interface Prefs {
  /**
   * Simple editing: type straight onto the page as it looks when reading (saved automatically), with
   * "+ Character"-style buttons in the sidebar. Off: the classic editor with a Save button.
   */
  simple: boolean
  setSimple(on: boolean): void
}

export const usePrefs = create<Prefs>((set) => ({
  simple: load(),
  setSimple(on) {
    try {
      localStorage.setItem(SIMPLE_KEY, on ? '1' : '0')
    } catch {
      // still applies for this session
    }
    set({ simple: on })
  }
}))
