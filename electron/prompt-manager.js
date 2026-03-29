const os = require('os')
const path = require('path')
const { execFile } = require('child_process')

const OSC_CWD_PREFIX = '\u001b]633;Cwd='
const OSC_TERMINATOR = '\u0007'
const OSC_COMPLETE_PATTERN = /\u001b]633;Cwd=([\s\S]*?)(?:\u0007|\u001b\\)/g
const OSC_TERMINATOR_PATTERN = /(?:\u0007|\u001b\\)/
const GIT_TIMEOUT_MS = 2000
const GIT_REFRESH_DEBOUNCE_MS = 60

const promptSessions = new Map()

function getUserIdentity() {
  const username = os.userInfo().username
  const hostname = os.hostname()

  return {
    username,
    hostname,
    userHost: `${username}@${hostname}`
  }
}

function clonePromptState(state) {
  return {
    ...state,
    git: { ...state.git }
  }
}

function normalizeCwd(cwd) {
  if (!cwd || typeof cwd !== 'string') {
    return os.homedir()
  }

  return cwd.trim() || os.homedir()
}

function formatDisplayCwd(cwd) {
  const normalizedCwd = normalizeCwd(cwd).replace(/\\/g, '/')
  const normalizedHome = os.homedir().replace(/\\/g, '/')

  if (process.platform === 'win32') {
    const cwdLower = normalizedCwd.toLowerCase()
    const homeLower = normalizedHome.toLowerCase()

    if (cwdLower === homeLower) {
      return '~'
    }

    if (cwdLower.startsWith(`${homeLower}/`)) {
      return `~${normalizedCwd.slice(normalizedHome.length)}`
    }

    return normalizedCwd
  }

  if (normalizedCwd === normalizedHome) {
    return '~'
  }

  if (normalizedCwd.startsWith(`${normalizedHome}/`)) {
    return `~${normalizedCwd.slice(normalizedHome.length)}`
  }

  return normalizedCwd
}

function notifyPromptUpdate(id) {
  const session = promptSessions.get(id)
  if (!session) {
    return
  }

  session.onUpdate?.({
    id,
    prompt: clonePromptState(session.state)
  })
}

function updatePromptState(id, updater) {
  const session = promptSessions.get(id)
  if (!session) {
    return
  }

  updater(session.state)
  session.state.displayCwd = formatDisplayCwd(session.state.cwd)
  session.state.updatedAt = new Date().toISOString()
  notifyPromptUpdate(id)
}

function buildShellEnvironment(shell, baseEnv = process.env) {
  const env = { ...baseEnv }
  const shellName = path.basename(shell).toLowerCase()

  if (shellName === 'cmd.exe') {
    const basePrompt = typeof env.PROMPT === 'string' && env.PROMPT.trim() ? env.PROMPT : '$P$G$S'
    env.PROMPT = `$E]633;Cwd=$P${OSC_TERMINATOR}${basePrompt}`
    return env
  }

  if (['bash', 'zsh', 'sh'].includes(shellName)) {
    const markerCommand = 'printf "\\033]633;Cwd=%s\\007" "$PWD"'
    env.PROMPT_COMMAND = env.PROMPT_COMMAND ? `${env.PROMPT_COMMAND}; ${markerCommand}` : markerCommand
  }

  return env
}

function registerPromptSession({ id, cwd, shell, shellLabel, onUpdate }) {
  const userIdentity = getUserIdentity()
  const state = {
    ...userIdentity,
    cwd: normalizeCwd(cwd),
    displayCwd: formatDisplayCwd(cwd),
    git: {
      available: true,
      branch: null,
      inRepo: false,
      isDirty: false,
      status: 'unknown'
    },
    shell,
    shellLabel,
    terminated: false,
    updatedAt: new Date().toISOString()
  }

  promptSessions.set(id, {
    id,
    onUpdate,
    pendingMarkerData: '',
    refreshQueued: false,
    refreshTimer: null,
    refreshing: false,
    state
  })

  notifyPromptUpdate(id)
  scheduleGitRefresh(id)

  return clonePromptState(state)
}

function splitBufferedPromptData(text) {
  const markerIndex = text.lastIndexOf(OSC_CWD_PREFIX)

  if (markerIndex === -1) {
    return {
      consumable: text,
      remainder: ''
    }
  }

  const tail = text.slice(markerIndex)
  if (OSC_TERMINATOR_PATTERN.test(tail)) {
    return {
      consumable: text,
      remainder: ''
    }
  }

  return {
    consumable: text.slice(0, markerIndex),
    remainder: tail
  }
}

function sanitizeTerminalData(id, data) {
  const session = promptSessions.get(id)
  if (!session || typeof data !== 'string' || data.length === 0) {
    return data
  }

  const combined = `${session.pendingMarkerData}${data}`
  const { consumable, remainder } = splitBufferedPromptData(combined)
  session.pendingMarkerData = remainder

  let nextCwd = null
  const cleanData = consumable.replace(OSC_COMPLETE_PATTERN, (_match, cwd) => {
    nextCwd = normalizeCwd(cwd)
    return ''
  })

  if (nextCwd && nextCwd !== session.state.cwd) {
    updatePromptState(id, (state) => {
      state.cwd = nextCwd
      state.terminated = false
    })
  }

  if (nextCwd) {
    scheduleGitRefresh(id)
  }

  return cleanData
}

function parseGitBranch(statusLine) {
  const normalizedLine = statusLine.replace(/^##\s*/, '').trim()
  if (!normalizedLine) {
    return null
  }

  if (normalizedLine.startsWith('HEAD')) {
    return 'detached'
  }

  if (normalizedLine.startsWith('No commits yet on ')) {
    return normalizedLine.slice('No commits yet on '.length).trim()
  }

  if (normalizedLine.startsWith('Initial commit on ')) {
    return normalizedLine.slice('Initial commit on '.length).trim()
  }

  return normalizedLine.split('...')[0].trim()
}

function getGitStateForDirectory(cwd) {
  return new Promise((resolve) => {
    execFile(
      'git',
      ['status', '--porcelain', '--branch'],
      {
        cwd,
        timeout: GIT_TIMEOUT_MS,
        windowsHide: true
      },
      (error, stdout = '', stderr = '') => {
        if (error) {
          if (error.code === 'ENOENT') {
            resolve({
              available: false,
              branch: null,
              inRepo: false,
              isDirty: false,
              status: 'unavailable'
            })
            return
          }

          const failureText = `${stdout}\n${stderr}\n${error.message}`.toLowerCase()
          const isNotRepo = failureText.includes('not a git repository')

          resolve({
            available: true,
            branch: null,
            inRepo: false,
            isDirty: false,
            status: isNotRepo ? 'not-repo' : 'error'
          })
          return
        }

        const lines = stdout
          .split(/\r?\n/)
          .map((line) => line.trimEnd())
          .filter(Boolean)

        const branch = parseGitBranch(lines[0] ?? '')
        const isDirty = lines.slice(1).length > 0

        resolve({
          available: true,
          branch,
          inRepo: true,
          isDirty,
          status: isDirty ? 'modified' : 'clean'
        })
      }
    )
  })
}

async function refreshGitState(id) {
  const session = promptSessions.get(id)
  if (!session) {
    return
  }

  if (session.refreshing) {
    session.refreshQueued = true
    return
  }

  session.refreshing = true
  const currentCwd = session.state.cwd

  try {
    const gitState = await getGitStateForDirectory(currentCwd)
    const latestSession = promptSessions.get(id)

    if (!latestSession || latestSession.state.cwd !== currentCwd) {
      return
    }

    updatePromptState(id, (state) => {
      state.git = gitState
    })
  } finally {
    const latestSession = promptSessions.get(id)
    if (!latestSession) {
      return
    }

    latestSession.refreshing = false

    if (latestSession.refreshQueued) {
      latestSession.refreshQueued = false
      scheduleGitRefresh(id)
    }
  }
}

function scheduleGitRefresh(id) {
  const session = promptSessions.get(id)
  if (!session) {
    return
  }

  if (session.refreshTimer) {
    clearTimeout(session.refreshTimer)
  }

  session.refreshTimer = setTimeout(() => {
    const activeSession = promptSessions.get(id)
    if (!activeSession) {
      return
    }

    activeSession.refreshTimer = null
    refreshGitState(id)
  }, GIT_REFRESH_DEBOUNCE_MS)
}

function markPromptSessionExited(id) {
  const session = promptSessions.get(id)
  if (!session) {
    return
  }

  updatePromptState(id, (state) => {
    state.terminated = true
  })
}

function disposePromptSession(id) {
  const session = promptSessions.get(id)
  if (!session) {
    return
  }

  if (session.refreshTimer) {
    clearTimeout(session.refreshTimer)
  }

  promptSessions.delete(id)
}

function getPromptState(id) {
  const session = promptSessions.get(id)
  return session ? clonePromptState(session.state) : null
}

module.exports = {
  buildShellEnvironment,
  disposePromptSession,
  getPromptState,
  markPromptSessionExited,
  registerPromptSession,
  sanitizeTerminalData
}
