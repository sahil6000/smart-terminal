import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/app.css'

function isIgnorableRendererWarning(message) {
  if (!message) {
    return false
  }

  return (
    message.includes('ResizeObserver loop completed with undelivered notifications.') ||
    message.includes('ResizeObserver loop limit exceeded')
  )
}

function renderFatalError(title, detail) {
  const root = document.getElementById('root')
  if (!root) {
    return
  }

  root.innerHTML = `
    <main style="min-height:100vh;padding:24px;background:#0b1220;color:#e2e8f0;font-family:'Segoe UI',sans-serif;">
      <section style="max-width:860px;margin:0 auto;border:1px solid rgba(248,113,113,.28);border-radius:18px;background:rgba(15,23,42,.92);padding:20px;box-shadow:0 18px 50px rgba(2,6,23,.38);">
        <p style="margin:0 0 8px;color:#fca5a5;font-size:12px;letter-spacing:.12em;text-transform:uppercase;">Renderer Error</p>
        <h1 style="margin:0 0 12px;font-size:28px;">${title}</h1>
        <pre style="margin:0;white-space:pre-wrap;word-break:break-word;line-height:1.5;color:#cbd5e1;">${detail}</pre>
      </section>
    </main>
  `
}

class RendererErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('RendererErrorBoundary', error, errorInfo)
  }

  render() {
    if (this.state.error) {
      return (
        <main style={{ minHeight: '100vh', padding: 24, background: '#0b1220', color: '#e2e8f0', fontFamily: "'Segoe UI',sans-serif" }}>
          <section
            style={{
              maxWidth: 860,
              margin: '0 auto',
              border: '1px solid rgba(248,113,113,.28)',
              borderRadius: 18,
              background: 'rgba(15,23,42,.92)',
              padding: 20,
              boxShadow: '0 18px 50px rgba(2,6,23,.38)'
            }}
          >
            <p style={{ margin: '0 0 8px', color: '#fca5a5', fontSize: 12, letterSpacing: '.12em', textTransform: 'uppercase' }}>
              Renderer Error
            </p>
            <h1 style={{ margin: '0 0 12px', fontSize: 28 }}>App failed to render</h1>
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.5, color: '#cbd5e1' }}>
              {this.state.error?.stack || this.state.error?.message || String(this.state.error)}
            </pre>
          </section>
        </main>
      )
    }

    return this.props.children
  }
}

window.addEventListener('error', (event) => {
  const message = event.error?.stack || event.message || 'Unknown renderer error'

  if (isIgnorableRendererWarning(event.message || event.error?.message || message)) {
    event.preventDefault()
    console.warn('Ignoring benign renderer warning', message)
    return
  }

  console.error('window.error', message)
  renderFatalError('Uncaught renderer error', message)
})

window.addEventListener('unhandledrejection', (event) => {
  const reason =
    event.reason?.stack ||
    event.reason?.message ||
    (typeof event.reason === 'string' ? event.reason : JSON.stringify(event.reason, null, 2))

  if (isIgnorableRendererWarning(reason)) {
    event.preventDefault()
    console.warn('Ignoring benign renderer rejection', reason)
    return
  }

  console.error('window.unhandledrejection', reason)
  renderFatalError('Unhandled promise rejection', reason || 'Unknown promise rejection')
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <RendererErrorBoundary>
    <App />
  </RendererErrorBoundary>
)
