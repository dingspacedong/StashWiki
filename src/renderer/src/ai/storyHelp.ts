// Starting the writing buddy from a story screen (e.g. the "✦ Summarize" button in the chapter editor).
import { useAi, type StoryMode } from './aiStore'

/** Open the buddy on the page being looked at and send it a message (e.g. after importing a character). */
export function askBuddy(text: string): void {
  const s = useAi.getState()
  if (!s.settings?.enabled) return
  useAi.setState({ open: true, includePage: true })
  void s.send(text)
}

export function askStoryBuddy(mode: StoryMode, text: string): void {
  const s = useAi.getState()
  if (!s.settings?.enabled) return
  useAi.setState({ open: true, storyMode: mode, includePage: true })
  void s.send(text)
}
