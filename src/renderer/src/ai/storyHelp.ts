// Starting the writing buddy from a story screen (e.g. the "✦ Summarize" button in the chapter editor).
import { useAi, type StoryMode } from './aiStore'

export function askStoryBuddy(mode: StoryMode, text: string): void {
  const s = useAi.getState()
  if (!s.settings?.enabled) return
  useAi.setState({ open: true, storyMode: mode, includePage: true })
  void s.send(text)
}
