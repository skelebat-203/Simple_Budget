import { Component, type ReactNode } from 'react'

/** Keeps a render error from blanking the page (security-v0.2 8.5). */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() { return { failed: true } }

  componentDidCatch(error: unknown) {
    // Name and message only; never the data that caused it (security-v0.2 8.6).
    console.error('Render error:', error instanceof Error ? `${error.name}: ${error.message}` : 'unknown')
  }

  render() {
    if (!this.state.failed) return this.props.children
    return <StartupError message="Something went wrong while showing your budget. Your saved data is safe. Reload the page to try again." />
  }
}

/** Full-page message used when the app can't start or render. */
export function StartupError({ message }: { message: string }) {
  return (
    <main className="main">
      <h1 className="title">Simple Budget</h1>
      <div className="banner" role="alert">
        <h2 className="banner-title">Error: The app couldn’t load</h2>
        <p>{message}</p>
      </div>
    </main>
  )
}
