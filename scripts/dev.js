const fs = require('fs')
const http = require('http')
const net = require('net')
const path = require('path')
const { spawn, spawnSync } = require('child_process')

const projectRoot = path.resolve(__dirname, '..')
const viteCli = path.join(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js')
const electronCli = path.join(projectRoot, 'node_modules', 'electron', 'cli.js')
const devStateFile = path.join(projectRoot, '.smart-terminal-dev.json')
const host = '127.0.0.1'

let shuttingDown = false
let viteProcess
let electronProcess

function readDevState() {
  try {
    const content = fs.readFileSync(devStateFile, 'utf8')
    return JSON.parse(content)
  } catch (_error) {
    return null
  }
}

function writeDevState() {
  const state = {
    vitePid: viteProcess?.pid ?? null,
    electronPid: electronProcess?.pid ?? null
  }

  fs.writeFileSync(devStateFile, JSON.stringify(state, null, 2))
}

function removeDevState() {
  try {
    fs.rmSync(devStateFile, { force: true })
  } catch (_error) {
    // Ignore cleanup failures during shutdown.
  }
}

function terminateProcessTree(pid) {
  if (!pid || pid === process.pid) {
    return
  }

  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], {
      stdio: 'ignore'
    })
    return
  }

  try {
    process.kill(pid, 'SIGTERM')
  } catch (_error) {
    // Ignore missing processes.
  }
}

function cleanupPreviousDevRun() {
  const previousState = readDevState()
  if (!previousState) {
    return
  }

  const previousPids = [previousState.electronPid, previousState.vitePid]
    .filter((pid) => Number.isInteger(pid) && pid > 0)

  if (previousPids.length > 0) {
    console.log('[dev] Cleaning up previous Smart Terminal dev instance')
  }

  previousPids.forEach((pid) => {
    terminateProcessTree(pid)
  })

  removeDevState()
}

function findFreePort(start = 5173, end = 5199) {
  return new Promise((resolve, reject) => {
    const tryPort = (port) => {
      if (port > end) {
        reject(new Error(`No free port found between ${start} and ${end}.`))
        return
      }

      const server = net.createServer()

      server.once('error', () => {
        tryPort(port + 1)
      })

      server.once('listening', () => {
        server.close(() => resolve(port))
      })

      server.listen(port, host)
    }

    tryPort(start)
  })
}

function waitForServer(url, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now()

    const attempt = () => {
      const request = http.get(url, (response) => {
        response.resume()
        resolve()
      })

      request.on('error', () => {
        if (Date.now() - startedAt >= timeoutMs) {
          reject(new Error(`Timed out waiting for ${url}`))
          return
        }

        setTimeout(attempt, 300)
      })
    }

    attempt()
  })
}

function killChild(child) {
  if (!child || child.killed) {
    return
  }

  child.kill('SIGTERM')
}

function shutdown(code = 0) {
  if (shuttingDown) {
    return
  }

  shuttingDown = true
  killChild(electronProcess)
  killChild(viteProcess)
  removeDevState()
  setTimeout(() => process.exit(code), 100)
}

async function main() {
  cleanupPreviousDevRun()

  const port = await findFreePort()
  const rendererUrl = `http://${host}:${port}`

  console.log(`[dev] Starting renderer on ${rendererUrl}`)

  viteProcess = spawn(process.execPath, [viteCli, '--host', host, '--port', String(port), '--force'], {
    cwd: projectRoot,
    stdio: 'inherit',
    env: process.env
  })
  writeDevState()

  viteProcess.on('exit', (code) => {
    if (!shuttingDown) {
      console.error(`[dev] Renderer exited with code ${code ?? 1}`)
      shutdown(code ?? 1)
    }
  })

  await waitForServer(rendererUrl)

  console.log('[dev] Renderer ready, launching Electron')

  electronProcess = spawn(process.execPath, [electronCli, '.'], {
    cwd: projectRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      ELECTRON_RENDERER_URL: rendererUrl,
      ELECTRON_DISABLE_SECURITY_WARNINGS: 'true'
    }
  })
  writeDevState()

  electronProcess.on('exit', (code) => {
    shutdown(code ?? 0)
  })
}

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))

main().catch((error) => {
  console.error(`[dev] ${error.message}`)
  shutdown(1)
})
