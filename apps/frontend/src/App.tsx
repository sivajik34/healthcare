import { useEffect, useMemo, useState } from 'react'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8080'
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:9001'

type Patient = { id: string; name: string; dob: string }
type Appointment = { id: string; patient_id: string; datetime: string; reason: string }

export default function App() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'))
  const [patients, setPatients] = useState<Patient[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [patientName, setPatientName] = useState('')
  const [patientDob, setPatientDob] = useState('')
  const [apptPatientId, setApptPatientId] = useState('')
  const [apptDatetime, setApptDatetime] = useState('')
  const [apptReason, setApptReason] = useState('')
  const [wsEvents, setWsEvents] = useState<string[]>([])

  useEffect(() => {
    if (!token) return;
    // Patients
    fetch(`${API_BASE}/patients/patients`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((r) => r.json())
      .then((data) => setPatients(Array.isArray(data) ? data : []))
      .catch(() => {});
    // Appointments
    fetch(`${API_BASE}/appointments/appointments`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((r) => r.json())
      .then((data) => setAppointments(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [token]);

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

  const createPatient = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = patientName.trim()
    const dob = patientDob.trim()
    if (!name || !dob || !token) return
    const res = await fetch(`${API_BASE}/patients/patients`, {
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
      setPatientName('')
      setPatientDob('')
    } else {
      alert('Create failed')
    }
  }

  const createAppointment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) return
    const patient_id = apptPatientId.trim()
    const reason = apptReason.trim()
    let datetime = apptDatetime.trim()
    if (!patient_id || !datetime || !reason) return
    // Convert datetime-local to ISO if needed
    if (!datetime.endsWith('Z')) {
      const dt = new Date(datetime)
      if (!isNaN(dt.getTime())) datetime = dt.toISOString()
    }
    const res = await fetch(`${API_BASE}/appointments/appointments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ patient_id, datetime, reason }),
    })
    if (res.ok) {
      const a = await res.json()
      setAppointments((prev) => [a, ...prev])
      setApptPatientId('')
      setApptDatetime('')
      setApptReason('')
    } else {
      alert('Appointment create failed')
    }
  }

  return (
    <div className="container">
      <div className="header">
        <div className="title">Healthcare Platform</div>
        {!token ? (
          <form onSubmit={login} className="actions">
            <input className="input" placeholder="username" value={username} onChange={(e) => setUsername(e.target.value)} />
            <input className="input" placeholder="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <button className="btn" type="submit" disabled={!canLogin}>Login</button>
          </form>
        ) : (
          <div className="actions">
            <button className="btn secondary" onClick={() => { localStorage.removeItem('token'); setToken(null); setPatients([]); setAppointments([]) }}>Logout</button>
          </div>
        )}
      </div>

      <div className="row">
        <div className="card">
          <h2>New Patient</h2>
          {!token && <div className="muted">Login to create patients.</div>}
          <form className="form" onSubmit={createPatient}>
            <input className="input" placeholder="Full name" value={patientName} onChange={(e) => setPatientName(e.target.value)} />
            <input className="input" placeholder="DOB" type="date" value={patientDob} onChange={(e) => setPatientDob(e.target.value)} />
            <div className="full">
              <button className="btn" type="submit" disabled={!token}>Create Patient</button>
            </div>
          </form>

          <table className="grid">
            <thead>
              <tr>
                <th>Name</th>
                <th>DOB</th>
                <th>ID</th>
              </tr>
            </thead>
            <tbody>
              {patients.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>{p.dob}</td>
                  <td className="muted">{p.id}</td>
                </tr>
              ))}
              {patients.length === 0 && (
                <tr>
                  <td colSpan={3} className="muted">No patients yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h2>New Appointment</h2>
          {!token && <div className="muted">Login to create appointments.</div>}
          <form className="form" onSubmit={createAppointment}>
            <select className="select" value={apptPatientId} onChange={(e) => setApptPatientId(e.target.value)}>
              <option value="">Select patient</option>
              {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <input className="input" type="datetime-local" value={apptDatetime} onChange={(e) => setApptDatetime(e.target.value)} />
            <input className="input full" placeholder="Reason" value={apptReason} onChange={(e) => setApptReason(e.target.value)} />
            <div className="full">
              <button className="btn" type="submit" disabled={!token}>Create Appointment</button>
            </div>
          </form>

          <table className="grid">
            <thead>
              <tr>
                <th>Datetime</th>
                <th>Reason</th>
                <th>Patient</th>
                <th>Patient ID</th>
              </tr>
            </thead>
            <tbody>
              {appointments.map((a) => {
                const p = patients.find(px => px.id === a.patient_id)
                return (
                  <tr key={a.id}>
                    <td>{a.datetime}</td>
                    <td>{a.reason}</td>
                    <td>{p ? p.name : '-'}</td>
                    <td className="muted">{a.patient_id}</td>
                  </tr>
                )
              })}
              {appointments.length === 0 && (
                <tr>
                  <td colSpan={4} className="muted">No appointments yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ marginTop: 20 }} className="card">
        <h2>Live Events</h2>
        <pre className="input" style={{ height: 200, overflow: 'auto' }}>{wsEvents.join('\\n')}</pre>
      </div>
    </div>
  )
}


