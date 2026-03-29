const { app, BrowserWindow, clipboard, ipcMain } = require('electron')
const fs = require('fs')
const path = require('path')
const {
  createTerminalSession,
  disposeTerminalSession,
  getTerminalPromptState,
  resizeTerminalSession,
  writeToTerminalSession
} = require('./pty-manager')

const rendererUrl = process.env.ELECTRON_RENDERER_URL
const rendererBuildPath = path.join(__dirname, '..', 'dist', 'index.html')
const runtimeDataPath = path.join(app.getPath('appData'), 'SmartTerminal')
const sessionDataPath = path.join(runtimeDataPath, 'session')
const cacheDataPath = path.join(runtimeDataPath, 'cache')
const enableRendererDebug = process.env.SMART_TERMINAL_DEBUG_RENDERER === '1'

let mainWindow

fs.mkdirSync(runtimeDataPath, { recursive: true })
fs.mkdirSync(sessionDataPath, { recursive: true })
fs.mkdirSync(cacheDataPath, { recursive: true })

app.setPath('userData', runtimeDataPath)
app.setPath('sessionData', sessionDataPath)
app.commandLine.appendSwitch('disk-cache-dir', cacheDataPath)
app.commandLine.appendSwitch('disable-http-cache')

if (process.platform === 'win32') {
  app.disableHardwareAcceleration()
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 760,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0b1220',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  if (rendererUrl) {
    mainWindow.loadURL(rendererUrl)
  } else if (fs.existsSync(rendererBuildPath)) {
    mainWindow.loadFile(rendererBuildPath)
  } else {
    throw new Error(
      'Renderer entry not found. Run "npm run dev" for development or "npm start" to build and launch the app.'
    )
  }

  if (rendererUrl) {
    if (enableRendererDebug) {
      mainWindow.webContents.on('did-finish-load', () => {
        console.log('[renderer] did-finish-load')
        mainWindow.webContents
          .executeJavaScript(
            `JSON.stringify({
              rootLength: document.getElementById('root')?.innerHTML.length ?? -1,
              bodyLength: document.body?.innerText?.length ?? -1,
              title: document.title
            })`,
            true
          )
          .then((snapshot) => {
            console.log(`[renderer] snapshot ${snapshot}`)
          })
          .catch((error) => {
            console.error(`[renderer] snapshot-error ${error.message}`)
          })
      })
    }

    mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
      console.error(`[renderer] did-fail-load ${errorCode} ${errorDescription} ${validatedURL}`)
    })

    if (enableRendererDebug) {
      mainWindow.webContents.on('console-message', (details) => {
        console.log(
          `[renderer:${details.level}] ${details.message} (${details.sourceId}:${details.lineNumber})`
        )
      })
    }

    mainWindow.webContents.on('render-process-gone', (_event, details) => {
      console.error(`[renderer] render-process-gone ${details.reason}`)
    })
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

ipcMain.handle('terminal:create', (event, options = {}) => {
  return createTerminalSession({
    cols: options.cols,
    rows: options.rows,
    cwd: options.cwd,
    onData: (payload) => {
      event.sender.send('terminal:data', payload)
    },
    onExit: (payload) => {
      event.sender.send('terminal:exit', payload)
    },
    onPrompt: (payload) => {
      event.sender.send('terminal:prompt', payload)
    }
  })
})

ipcMain.handle('terminal:get-prompt-state', (_event, payload) => {
  return getTerminalPromptState(payload?.id)
})

ipcMain.handle('clipboard:read-text', () => {
  return clipboard.readText()
})

ipcMain.handle('clipboard:write-text', (_event, text) => {
  clipboard.writeText(typeof text === 'string' ? text : '')
  return true
})

ipcMain.on('terminal:input', (_event, payload) => {
  writeToTerminalSession(payload?.id, payload?.data ?? '')
})

ipcMain.on('terminal:resize', (_event, payload) => {
  resizeTerminalSession(payload?.id, payload?.cols, payload?.rows)
})

ipcMain.on('terminal:dispose', (_event, payload) => {
  disposeTerminalSession(payload?.id)
})

app.on('before-quit', () => {
  disposeTerminalSession()
})
