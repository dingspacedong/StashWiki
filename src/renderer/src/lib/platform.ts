export const isMac = /Mac/i.test(navigator.userAgent)

/** Shortcut label for the platform: ⌘B on a Mac, Ctrl+B elsewhere. */
export function kb(key: string): string {
  return isMac ? `⌘${key}` : `Ctrl+${key}`
}

/** The Command key on a Mac, Ctrl elsewhere. */
export function isModKey(e: KeyboardEvent): boolean {
  return isMac ? e.metaKey : e.ctrlKey
}

export const BACK_LABEL = isMac ? '⌘[' : 'Alt+Left'
export const FORWARD_LABEL = isMac ? '⌘]' : 'Alt+Right'

/** Back/forward: ⌘[ / ⌘] on a Mac (Option+Arrow moves by word there), Alt+Arrow elsewhere. */
export function historyKey(e: KeyboardEvent): 'back' | 'forward' | null {
  if (isMac) {
    if (e.metaKey && e.key === '[') return 'back'
    if (e.metaKey && e.key === ']') return 'forward'
  } else {
    if (e.altKey && e.key === 'ArrowLeft') return 'back'
    if (e.altKey && e.key === 'ArrowRight') return 'forward'
  }
  return null
}
