import { useState } from 'react'
import { AddBudget } from './screens/AddBudget'
import { Budget } from './screens/Budget'

function App() {
  const [refreshKey, setRefreshKey] = useState(0)
  return (
    <div style={{ background: 'var(--color-primary)', minHeight: '100vh' }}>
      <main style={{ fontFamily: 'var(--font-family)', color: 'var(--color-fg)', background: 'var(--color-bg)', minHeight: '100vh', maxWidth: 1440, minWidth: 320, margin: '0 auto', padding: 'var(--space-md)' }}>
        <h1 style={{ color: 'var(--color-fg)' }}>Simple Budget</h1>
        <AddBudget onSaved={() => setRefreshKey(k => k + 1)} />
        <hr style={{ margin: 'var(--space-lg) 0', border: 'none', borderTop: '1px solid var(--color-border)' }} />
        <Budget refreshKey={refreshKey} />
      </main>
    </div>
  )
}

export default App
