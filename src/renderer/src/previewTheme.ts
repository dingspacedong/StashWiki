import { useEffect } from 'react'
import { create } from 'zustand'
import type { PageTheme } from '@shared/types'

/** The per-page colors currently shown on top of the wiki theme (while reading or editing a page). */
export const usePreviewTheme = create<{ theme: PageTheme | null }>(() => ({ theme: null }))

export function useApplyPageTheme(theme: PageTheme | null | undefined): void {
  const json = JSON.stringify(theme ?? null)
  useEffect(() => {
    usePreviewTheme.setState({ theme: JSON.parse(json) })
  }, [json])
  useEffect(() => () => usePreviewTheme.setState({ theme: null }), [])
}
