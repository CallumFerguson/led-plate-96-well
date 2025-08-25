import './App.css'
import { useState } from 'react'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <main className="min-h-screen grid place-items-center">
        <div className="text-3xl font-bold">Test</div>
      </main>
    </>
  )
}

export default App
