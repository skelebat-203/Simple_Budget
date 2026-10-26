import { AddBudget } from './screens/AddBudget'
import { Budget } from './screens/Budget'

function App() {
  return (
    <main style={{ fontFamily: 'var(--font-family)', color: 'var(--color-fg)', background: 'var(--color-bg)', minHeight: '100vh' }}>
      <AddBudget />
      <hr style={{ margin: 'var(--space-lg) 0', border: 'none', borderTop: '1px solid var(--color-border)' }} />
      <Budget />
    </main>
  )
}

export default App
