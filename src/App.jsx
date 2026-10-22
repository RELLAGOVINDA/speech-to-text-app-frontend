import { useEffect, useRef, useState } from 'react'
import { AudioLines, Mic, Square, Save, Search, Pencil, Trash2, X, Check, Clock3, Languages, FileText, AlertCircle, RefreshCw } from 'lucide-react'

const API = 'http://localhost:8080/api'
const LANGUAGES = [
  { label: 'English (India)', value: 'en-IN' },
  { label: 'Hindi', value: 'hi-IN' },
  { label: 'English (US)', value: 'en-US' },
]
const displayLanguage = code => LANGUAGES.find(l => l.value === code)?.label || code || 'English'

export default function App() {
  const [language, setLanguage] = useState('en-IN')
  const [title, setTitle] = useState('')
  const [transcript, setTranscript] = useState('')
  const [history, setHistory] = useState([])
  const [search, setSearch] = useState('')
  const [recording, setRecording] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [editing, setEditing] = useState(null)
  const recognitionRef = useRef(null)
  const baseTextRef = useRef('')

  async function request(path = '', options = {}) {
    const response = await fetch(`${API}/transcriptions${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    })
    if (!response.ok) {
      let message = `Request failed (${response.status})`
      try { message = (await response.json()).error || message } catch {}
      throw new Error(message)
    }
    if (response.status === 204) return null
    return response.json()
  }

  async function loadHistory() {
    setLoading(true)
    try { setHistory(await request()) ; setError('') }
    catch (e) { setError(`${e.message}. Is the Spring Boot backend and MySQL running?`) }
    finally { setLoading(false) }
  }
  useEffect(() => { loadHistory() }, [])

  function startRecording() {
    setError(''); setNotice('')
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setError('Live speech recognition is not supported by this browser. Try the latest Google Chrome or connect a streaming speech engine.')
      return
    }
    const recognition = new SpeechRecognition()
    recognition.lang = language
    recognition.continuous = true
    recognition.interimResults = true
    recognition.maxAlternatives = 1
    baseTextRef.current = transcript ? `${transcript.trim()} ` : ''
    recognition.onresult = event => {
      let interim = ''
      let finalPart = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const phrase = event.results[i][0].transcript
        if (event.results[i].isFinal) finalPart += phrase + ' '
        else interim += phrase
      }
      if (finalPart) baseTextRef.current += finalPart
      setTranscript(baseTextRef.current + interim)
    }
    recognition.onerror = event => {
      setError(event.error === 'not-allowed' ? 'Microphone permission was denied. Allow microphone access in your browser.' : `Speech recognition error: ${event.error}`)
    }
    recognition.onend = () => setRecording(false)
    recognitionRef.current = recognition
    try { recognition.start(); setRecording(true) }
    catch (e) { setError(`Could not start recording: ${e.message}`) }
  }
  function stopRecording() {
    recognitionRef.current?.stop()
    recognitionRef.current = null
    setRecording(false)
  }

  async function saveTranscript() {
    const text = transcript.trim()
    if (!text) { setError('Record or type some text before saving.'); return }
    setLoading(true); setError(''); setNotice('')
    const payload = {
      title: title.trim() || `Transcription ${new Date().toLocaleString()}`,
      transcribedText: text,
      language: displayLanguage(language),
    }
    try {
      if (editing) await request(`/${editing.id}`, { method: 'PUT', body: JSON.stringify(payload) })
      else await request('', { method: 'POST', body: JSON.stringify(payload) })
      setNotice(editing ? 'Transcription updated.' : 'Transcription saved.')
      setTranscript(''); setTitle(''); setEditing(null)
      await loadHistory()
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }
  function editItem(item) {
    stopRecording()
    setEditing(item); setTitle(item.title); setTranscript(item.transcribedText)
    const match = LANGUAGES.find(l => l.label === item.language)
    if (match) setLanguage(match.value)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  async function deleteItem(item) {
    if (!window.confirm(`Delete "${item.title}"? This cannot be undone.`)) return
    setError(''); setNotice('')
    try {
      await request(`/${item.id}`, { method: 'DELETE' })
      setHistory(old => old.filter(row => row.id !== item.id))
      setNotice('Transcription deleted.')
      if (editing?.id === item.id) cancelEdit()
    } catch (e) { setError(e.message) }
  }
  function cancelEdit() { setEditing(null); setTitle(''); setTranscript('') }

  const filtered = history.filter(item => `${item.title} ${item.transcribedText} ${item.language}`.toLowerCase().includes(search.toLowerCase()))

  return <div className="app-shell">
    <header className="topbar">
      <a className="brand" href="#"><span className="brand-icon"><AudioLines size={22}/></span><span>Vocal<span className="brand-light">Note</span></span></a>
      <div className="top-right"><span className="status-dot"/><span>Speech workspace</span><span className="avatar">ST</span></div>
    </header>
    <main className="main">
      <section className="hero">
        <div className="eyebrow"><span className="eyebrow-line"/> SPEECH TO TEXT STUDIO</div>
        <h1>Your voice,<br/><span>captured in words.</span></h1>
        <p className="hero-copy">Turn spoken thoughts into searchable notes. Record, review, and manage your transcriptions in one place.</p>
        <div className="stats-row">
          <div className="stat"><FileText size={17}/><span><b>{history.length}</b> saved notes</span></div>
          <div className="stat"><Languages size={17}/><span>Hindi & English</span></div>
          <div className="stat"><Clock3 size={17}/><span>Live capture</span></div>
        </div>
      </section>

      {error && <div className="alert error"><AlertCircle size={18}/><span>{error}</span><button className="icon-btn" onClick={() => setError('')} aria-label="Dismiss"><X size={17}/></button></div>}
      {notice && <div className="alert success"><Check size={18}/><span>{notice}</span><button className="icon-btn" onClick={() => setNotice('')} aria-label="Dismiss"><X size={17}/></button></div>}

      <section className="workspace-grid">
        <div className="panel compose-panel">
          <div className="panel-heading"><div><div className="section-kicker">WORKSPACE / 01</div><h2>{editing ? 'Edit transcription' : 'New transcription'}</h2></div><span className={`record-state ${recording ? 'is-recording' : ''}`}><i/>{recording ? 'Recording' : 'Ready'}</span></div>
          <label className="field-label" htmlFor="note-title">Note title <span>OPTIONAL</span></label>
          <input id="note-title" className="text-input" placeholder="e.g. Meeting notes, daily idea..." value={title} onChange={e => setTitle(e.target.value)} maxLength={120}/>
          <div className="field-row"><label className="field-label" htmlFor="language">Recognition language</label><select id="language" className="select-input" value={language} onChange={e => setLanguage(e.target.value)} disabled={recording}>{LANGUAGES.map(l => <option value={l.value} key={l.value}>{l.label}</option>)}</select></div>
          <div className="transcript-wrap">
            <div className="transcript-top"><label className="field-label" htmlFor="transcript">TRANSCRIPT</label><span>{transcript.trim() ? transcript.trim().split(/\s+/).length : 0} words</span></div>
            <textarea id="transcript" value={transcript} onChange={e => setTranscript(e.target.value)} placeholder="Your recognized speech will appear here... You can also type or edit text manually." rows={8}/>
            {recording && <div className="listening"><span className="wave"><i/><i/><i/><i/><i/></span> Listening to your voice...</div>}
          </div>
          <div className="action-row">
            {!recording ? <button className="btn btn-primary" onClick={startRecording}><Mic size={17}/> Start recording</button> : <button className="btn btn-stop" onClick={stopRecording}><Square size={15} fill="currentColor"/> Stop recording</button>}
            <button className="btn btn-dark" onClick={saveTranscript} disabled={loading}><Save size={17}/>{loading ? 'Saving...' : editing ? 'Update note' : 'Save note'}</button>
            {editing && <button className="btn btn-quiet" onClick={cancelEdit}><X size={16}/> Cancel</button>}
          </div>
          <p className="helper">Allow microphone access when prompted. For best browser speech recognition support, use Chrome over localhost or HTTPS.</p>
        </div>

        <aside className="side-column">
          <div className="panel tip-panel"><div className="tip-icon"><Mic size={19}/></div><h3>Make it a habit.</h3><p>Capture an idea the moment it arrives. You can edit and revisit every saved transcription below.</p><div className="tip-bottom"><span className="tiny-dot"/> Your notes are saved to your database</div></div>
          <div className="panel workflow-panel"><div className="section-kicker">HOW IT WORKS</div><div className="workflow-step"><span>01</span><div><b>Speak naturally</b><small>Record in your selected language</small></div></div><div className="workflow-step"><span>02</span><div><b>Review the words</b><small>Edit text before saving</small></div></div><div className="workflow-step"><span>03</span><div><b>Keep it organized</b><small>Search, update, or delete notes</small></div></div></div>
        </aside>
      </section>

      <section className="history-section">
        <div className="history-heading"><div><div className="section-kicker">YOUR LIBRARY / 02</div><h2>Transcription history <span className="count-badge">{history.length}</span></h2><p>All your saved voice notes, together.</p></div><button className="btn btn-outline" onClick={loadHistory} disabled={loading}><RefreshCw size={15} className={loading ? 'spin' : ''}/> Refresh</button></div>
        <div className="search-wrap"><Search size={18}/><input aria-label="Search transcriptions" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by title, text, or language..."/>{search && <button className="icon-btn" onClick={() => setSearch('')}><X size={16}/></button>}</div>
        {loading && history.length === 0 ? <div className="empty-state"><RefreshCw className="spin" size={25}/><p>Loading your notes...</p></div> :
          filtered.length === 0 ? <div className="empty-state"><div className="empty-icon"><FileText size={24}/></div><h3>{search ? 'No matching notes' : 'Your library is waiting'}</h3><p>{search ? 'Try a different search phrase.' : 'Save your first transcription and it will appear here.'}</p></div> :
          <div className="history-list">{filtered.map(item => <article className="history-card" key={item.id}><div className="history-card-icon"><FileText size={19}/></div><div className="history-card-body"><div className="history-card-title"><h3>{item.title}</h3><span className="language-pill"><Languages size={12}/>{item.language}</span></div><p>{item.transcribedText}</p><div className="history-meta"><Clock3 size={13}/>{new Date(item.createdAt).toLocaleString()}{item.updatedAt !== item.createdAt && <span> · Updated {new Date(item.updatedAt).toLocaleString()}</span>}</div></div><div className="card-actions"><button className="icon-btn edit-btn" title="Edit" onClick={() => editItem(item)}><Pencil size={16}/></button><button className="icon-btn delete-btn" title="Delete" onClick={() => deleteItem(item)}><Trash2 size={16}/></button></div></article>)}</div>
        }
      </section>
      <footer className="footer"><span><AudioLines size={16}/> VocalNote</span><span>Built with React · Spring Boot · MySQL</span></footer>
    </main>
  </div>
}
