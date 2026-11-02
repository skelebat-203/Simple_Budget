import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/tokens.css'
import './index.css'
import './App.css'
import App from './App.tsx'
import { seedCategories } from './storage/seed'
import { ErrorBoundary, StartupError } from './components/ErrorBoundary'

const root = createRoot(document.getElementById('root')!)

/** Plain-language reason the database couldn't open (security-v0.2 8.1). */
function startupMessage(err: unknown): string {
  const name = err instanceof Error ? err.name : ''
  if (name === 'QuotaExceededError') return 'Your device is out of storage space. Free up some space, then reload the page.'
  if (name === 'VersionError') return 'This copy of the app is older than your saved data. Reload the page to get the latest version.'
  if (name === 'DatabaseClosedError' || name === 'OpenFailedError' || name === 'InvalidStateError' || name === 'MissingAPIError')
    return 'Your browser is blocking storage for this app, for example in a private window. Open the app in a normal window, then reload.'
  return 'Your budget data couldn’t be opened. Reload the page to try again. If this keeps happening, export a backup from another device or browser where the app works.'
}

seedCategories()
  .then(() => {
    root.render(
      <StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </StrictMode>,
    )
  })
  .catch(err => {
    console.error('Startup error:', err instanceof Error ? `${err.name}: ${err.message}` : 'unknown')
    root.render(<StartupError message={startupMessage(err)} />)
  })
