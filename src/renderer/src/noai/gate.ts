// Stand-ins for the writing buddy in the no-AI build (used instead of ai/gate.ts): nothing to show, nothing to do.
const state = { settings: null as { enabled: boolean } | null, open: false }
type State = typeof state

export function useAi<T>(select: (s: State) => T): T {
  return select(state)
}
useAi.getState = () => ({ ...state, loadSettings: async (): Promise<void> => {}, setOpen: (_open: boolean): void => {}, clear: (): void => {} })

export function AiPanel(): null {
  return null
}
export function AiSettingsSection(): null {
  return null
}
export function askStoryBuddy(_mode: string, _text: string): void {}
export function askBuddy(_text: string): void {}
