import { useState } from 'react'
import { AddBudget } from './screens/AddBudget'
import { Budget } from './screens/Budget'

function App() {
  const [refreshKey, setRefreshKey] = useState(0)
  return (
    <div className="shell">
      <main className="main">
        <h1 className="title">Simple Budget</h1>
        <AddBudget onSaved={() => setRefreshKey(k => k + 1)} />
        <hr className="divider" />
        <Budget refreshKey={refreshKey} defaultRange="day" />
      </main>
    </div>
  )
}

export default App
