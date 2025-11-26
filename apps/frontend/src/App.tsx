import { useEffect, useMemo, useState } from 'react'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8080'
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:9001'

type Patient = { id: string; name: string; dob: string }

export default function App() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'))
  const [patients, setPatients] = useState<Patient[]>([])
  const [wsEvents, setWsEvents] = useState<string[]>([])

  useEffect(() => {
    if (!token) return
    fetch(`${API_BASE}/patients`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => setPatients(data))
      .catch(() => {})
  }, [token])

  useEffect(() => {
    const ws = new WebSocket(WS_URL)
    ws.onmessage = (ev) => {
      setWsEvents((prev) => [ev.data as string, ...prev].slice(0, 10))
    }
    return () => ws.close()
  }, [])

  const canLogin = useMemo(() => username.length > 0 && password.length > 0, [username, password])

  const login = async (e: React.FormEvent) => {
    e.preventDefault()
    const body = new URLSearchParams()
    body.append("grant_type", "password")
    body.append("username", username)
    body.append("password", password)
    body.append("scope", "")
    body.append("client_id", "frontend")
    body.append("client_secret", "secret")
    const res = await fetch(`${API_BASE}/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })
    if (res.ok) {
      const data = await res.json()
      localStorage.setItem('token', data.access_token)
      setToken(data.access_token)
    } else {
      alert('Login failed')
    }
  }

  const createPatient = async () => {
    const name = prompt('Patient name?')
    const dob = prompt('DOB (YYYY-MM-DD)?')
    if (!name || !dob || !token) return
    const res = await fetch(`${API_BASE}/patients`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name, dob }),
    })
    if (res.ok) {
      const p = await res.json()
      setPatients((prev) => [p, ...prev])
    } else {
      alert('Create failed')
    }
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: 24, maxWidth: 960, margin: '0 auto' }}>
      <h1>Healthcare Platform</h1>
      {!token ? (
        <form onSubmit={login} style={{ display: 'flex', gap: 8 }}>
          <input placeholder="username" value={username} onChange={(e) => setUsername(e.target.value)} />
          <input placeholder="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button type="submit" disabled={!canLogin}>Login</button>
        </form>
      ) : (
        <div style={{ marginBottom: 16 }}>
          <button onClick={() => { localStorage.removeItem('token'); setToken(null) }}>Logout</button>
          <button onClick={createPatient} style={{ marginLeft: 12 }}>New Patient</button>
        </div>
      )}
      <h2>Patients</h2>
      <ul>
        {patients.map((p) => (
          <li key={p.id}>
            {p.name} — {p.dob}
          </li>
        ))}
      </ul>
      <h2>Live Events</h2>
      <pre style={{ background: '#111', color: '#0f0', padding: 12, borderRadius: 6, maxHeight: 240, overflow: 'auto' }}>
        {wsEvents.join('\n')}
      </pre>
    </div>
  )
}


