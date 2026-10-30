import type { StashApi } from '../shared/types'

declare global {
  interface Window {
    stash: StashApi
  }
}
