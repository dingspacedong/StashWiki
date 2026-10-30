import { Component, type ReactNode } from 'react'

/** Keeps a failing part of the screen from taking the whole window down with it. */
export default class ErrorBoundary extends Component<
  { children: ReactNode; fallback: (error: Error, reset: () => void) => ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error): { error: Error } {
    return { error }
  }

  componentDidCatch(error: Error): void {
    console.error('Part of the screen failed:', error)
  }

  render(): ReactNode {
    if (this.state.error) return this.props.fallback(this.state.error, () => this.setState({ error: null }))
    return this.props.children
  }
}
