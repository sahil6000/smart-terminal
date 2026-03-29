const os = require('os')
const path = require('path')
const pty = require('node-pty')
const {
  buildShellEnvironment,
  disposePromptSession,
  getPromptState,
  markPromptSessionExited,
  registerPromptSession,
  sanitizeTerminalData
} = require('./prompt-manager')

const sessions = new Map()

function resolveShell() {
  if (process.platform === 'win32') {
    return {
      shell: process.env.COMSPEC || 'C:\\Windows\\System32\\cmd.exe',
      args: []
    }
  }

  return {
    shell: process.env.SHELL || '/bin/bash',
    args: ['-l']
  }
}

function createTerminalSession({
  cols = 120,
  rows = 32,
  cwd = os.homedir(),
  onData,
  onExit,
  onPrompt
} = {}) {
  const id = `session-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
  const { shell, args } = resolveShell()
  const promptState = registerPromptSession({
    id,
    cwd,
    shell,
    shellLabel: path.basename(shell),
    onUpdate: onPrompt
  })

  let ptyProcess

  try {
    ptyProcess = pty.spawn(shell, args, {
      name: 'xterm-256color',
      cols,
      rows,
      cwd,
      env: buildShellEnvironment(shell, {
        ...process.env,
        TERM: 'xterm-256color'
      })
    })
  } catch (error) {
    disposePromptSession(id)
    const message = error instanceof Error ? error.message : 'Unknown PTY startup error'
    throw new Error(`Unable to start shell "${shell}": ${message}`)
  }

  const sessionRecord = {
    process: ptyProcess,
    exited: false
  }

  ptyProcess.onData((data) => {
    if (sessionRecord.exited) {
      return
    }

    const cleanData = sanitizeTerminalData(id, data)
    if (cleanData) {
      onData?.({ id, data: cleanData })
    }
  })

  ptyProcess.onExit((event) => {
    sessionRecord.exited = true
    markPromptSessionExited(id)
    onExit?.({
      id,
      exitCode: event.exitCode,
      signal: event.signal
    })
    sessions.delete(id)
  })

  sessions.set(id, sessionRecord)

  return {
    id,
    shell,
    shellLabel: path.basename(shell),
    cwd,
    prompt: promptState
  }
}

function writeToTerminalSession(id, data) {
  const session = sessions.get(id)
  if (!session || session.exited || typeof data !== 'string' || data.length === 0) {
    return
  }

  try {
    session.process.write(data)
  } catch (_error) {
    session.exited = true
    markPromptSessionExited(id)
    sessions.delete(id)
  }
}

function resizeTerminalSession(id, cols, rows) {
  const session = sessions.get(id)
  if (!session || session.exited) {
    return
  }

  const safeCols = Number.isFinite(cols) ? Math.max(20, Math.floor(cols)) : 120
  const safeRows = Number.isFinite(rows) ? Math.max(5, Math.floor(rows)) : 32

  try {
    session.process.resize(safeCols, safeRows)
  } catch (_error) {
    session.exited = true
    markPromptSessionExited(id)
    sessions.delete(id)
  }
}

function disposeTerminalSession(id) {
  if (id) {
    const session = sessions.get(id)
    if (session) {
      session.exited = true
      session.process.kill()
      sessions.delete(id)
    }

    disposePromptSession(id)
    return
  }

  const sessionIds = Array.from(sessions.keys())

  for (const session of sessions.values()) {
    session.exited = true
    session.process.kill()
  }

  sessions.clear()
  disposeAllPromptSessions(sessionIds)
}

function disposeAllPromptSessions(sessionIds) {
  for (const id of sessionIds) {
    disposePromptSession(id)
  }
}

function getTerminalPromptState(id) {
  return getPromptState(id)
}

module.exports = {
  createTerminalSession,
  getTerminalPromptState,
  writeToTerminalSession,
  resizeTerminalSession,
  disposeTerminalSession
}
