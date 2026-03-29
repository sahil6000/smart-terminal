import { useEffect, useRef, useState } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { defaultTerminalOptions } from '../config/settings'

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform)

function isCopyShortcut(event, hasSelection) {
  const key = event.key.toLowerCase()
  const modifierPressed = isMac ? event.metaKey : event.ctrlKey

  if (event.shiftKey && !isMac && modifierPressed && key === 'c') {
    return hasSelection
  }

  if (modifierPressed && key === 'insert') {
    return hasSelection
  }

  if (modifierPressed && key === 'c') {
    return hasSelection
  }

  return false
}

function isPasteShortcut(event) {
  const key = event.key.toLowerCase()
  const modifierPressed = isMac ? event.metaKey : event.ctrlKey

  if (event.shiftKey && !isMac && modifierPressed && key === 'v') {
    return true
  }

  if (!isMac && event.shiftKey && key === 'insert') {
    return true
  }

  return modifierPressed && key === 'v'
}

function isSelectAllShortcut(event) {
  const key = event.key.toLowerCase()
  const modifierPressed = isMac ? event.metaKey : event.ctrlKey

  return modifierPressed && !event.shiftKey && !event.altKey && key === 'a'
}

function Terminal({ tabId, appearance, title, isVisible, shouldFocus, layoutMode, onActivate, onSessionChange }) {
  const terminalRef = useRef(null)
  const sessionIdRef = useRef(null)
  const xtermRef = useRef(null)
  const fitAddonRef = useRef(null)
  const resizeFrameRef = useRef(null)
  const hasExitedRef = useRef(false)
  const isVisibleRef = useRef(isVisible)
  const onActivateRef = useRef(onActivate)
  const onSessionChangeRef = useRef(onSessionChange)
  const syncSizeRef = useRef(() => {})
  const scheduleSyncRef = useRef(() => {})
  const lastSizeRef = useRef({ cols: null, rows: null })
  const [status, setStatus] = useState('Connecting to local shell...')

  useEffect(() => {
    onActivateRef.current = onActivate
    onSessionChangeRef.current = onSessionChange
  }, [onActivate, onSessionChange])

  useEffect(() => {
    isVisibleRef.current = isVisible

    if (isVisible) {
      scheduleSyncRef.current()

      if (shouldFocus) {
        xtermRef.current?.focus()
      }
    }
  }, [isVisible, shouldFocus, layoutMode])

  useEffect(() => {
    if (!xtermRef.current || !fitAddonRef.current || !appearance) {
      return
    }

    xtermRef.current.options.fontFamily = appearance.fontFamily
    xtermRef.current.options.fontSize = appearance.fontSize
    xtermRef.current.options.theme = appearance.theme
    scheduleSyncRef.current()
  }, [appearance])

  useEffect(() => {
    if (!terminalRef.current || !window.terminalApi) {
      setStatus('Electron preload bridge not found.')
      return undefined
    }

    const term = new XTerm({
      ...defaultTerminalOptions,
      fontFamily: appearance?.fontFamily ?? defaultTerminalOptions.fontFamily,
      fontSize: appearance?.fontSize ?? defaultTerminalOptions.fontSize,
      theme: appearance?.theme ?? defaultTerminalOptions.theme
    })
    const fitAddon = new FitAddon()

    xtermRef.current = term
    fitAddonRef.current = fitAddon
    hasExitedRef.current = false
    lastSizeRef.current = { cols: null, rows: null }

    term.loadAddon(fitAddon)
    term.open(terminalRef.current)

    const activateCurrentTab = () => {
      if (isVisibleRef.current) {
        onActivateRef.current?.(tabId)
      }
    }

    const copySelection = async () => {
      const selection = term.getSelection()
      if (!selection) {
        return
      }

      try {
        await window.terminalApi.writeClipboardText(selection)
      } catch (_error) {
        // Ignore clipboard errors so shell input remains usable.
      }
    }

    const pasteText = (text) => {
      if (!text || !sessionIdRef.current || hasExitedRef.current) {
        return
      }

      window.terminalApi.sendInput({
        id: sessionIdRef.current,
        data: text
      })
      term.focus()
    }

    const pasteFromClipboard = async () => {
      try {
        const clipboardText = await window.terminalApi.readClipboardText()
        pasteText(clipboardText)
      } catch (_error) {
        // Ignore clipboard errors so shell input remains usable.
      }
    }

    term.attachCustomKeyEventHandler((event) => {
      if (event.type !== 'keydown') {
        return true
      }

      if (isCopyShortcut(event, term.hasSelection())) {
        event.preventDefault()
        void copySelection()
        return false
      }

      if (isSelectAllShortcut(event)) {
        event.preventDefault()
        term.selectAll()
        return false
      }

      if (isPasteShortcut(event)) {
        event.preventDefault()
        void pasteFromClipboard()
        return false
      }

      return true
    })

    syncSizeRef.current = () => {
      if (
        !isVisibleRef.current ||
        !sessionIdRef.current ||
        hasExitedRef.current ||
        !fitAddonRef.current ||
        !xtermRef.current
      ) {
        return
      }

      fitAddonRef.current.fit()
      const nextSize = {
        cols: xtermRef.current.cols,
        rows: xtermRef.current.rows
      }

      if (lastSizeRef.current.cols === nextSize.cols && lastSizeRef.current.rows === nextSize.rows) {
        return
      }

      lastSizeRef.current = nextSize
      window.terminalApi.resize({
        id: sessionIdRef.current,
        cols: nextSize.cols,
        rows: nextSize.rows
      })
    }

    scheduleSyncRef.current = () => {
      if (resizeFrameRef.current !== null) {
        return
      }

      resizeFrameRef.current = window.requestAnimationFrame(() => {
        resizeFrameRef.current = null
        syncSizeRef.current()
      })
    }

    let inputDisposable
    let removeOnData
    let removeOnExit

    const initializeSession = async () => {
      try {
        const session = await window.terminalApi.createSession({
          cols: term.cols,
          rows: term.rows
        })

        sessionIdRef.current = session.id
        onSessionChangeRef.current?.(tabId, session.id)
        setStatus(`${title}: connected to ${session.shellLabel || session.shell}`)

        removeOnData = window.terminalApi.onData((payload) => {
          if (payload.id === session.id) {
            term.write(payload.data)
          }
        })

        removeOnExit = window.terminalApi.onExit((payload) => {
          if (payload.id === session.id) {
            hasExitedRef.current = true
            setStatus(`${title}: exited with code ${payload.exitCode ?? 0}`)
            term.writeln('')
            term.writeln(`[process exited with code ${payload.exitCode ?? 0}]`)
          }
        })

        inputDisposable = term.onData((data) => {
          if (hasExitedRef.current) {
            return
          }

          window.terminalApi.sendInput({
            id: session.id,
            data
          })
        })

        scheduleSyncRef.current()
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown terminal startup error'
        setStatus(`Failed to start shell: ${message}`)
        term.writeln(`\r\nFailed to start shell: ${message}`)
      }
    }

    initializeSession()

    const handleCopy = (event) => {
      if (!term.hasSelection()) {
        return
      }

      const selection = term.getSelection()
      event.preventDefault()
      event.clipboardData?.setData('text/plain', selection)
      void window.terminalApi.writeClipboardText(selection)
    }

    const handlePaste = (event) => {
      const pastedText = event.clipboardData?.getData('text/plain')
      if (!pastedText) {
        return
      }

      event.preventDefault()
      pasteText(pastedText)
    }

    const handlePointerActivate = () => {
      activateCurrentTab()
    }

    terminalRef.current.addEventListener('mousedown', handlePointerActivate)
    terminalRef.current.addEventListener('focusin', handlePointerActivate)
    terminalRef.current.addEventListener('copy', handleCopy)
    terminalRef.current.addEventListener('paste', handlePaste)
    window.addEventListener('resize', scheduleSyncRef.current)

    return () => {
      const sessionId = sessionIdRef.current

      terminalRef.current?.removeEventListener('mousedown', handlePointerActivate)
      terminalRef.current?.removeEventListener('focusin', handlePointerActivate)
      terminalRef.current?.removeEventListener('copy', handleCopy)
      terminalRef.current?.removeEventListener('paste', handlePaste)
      window.removeEventListener('resize', scheduleSyncRef.current)

      if (resizeFrameRef.current !== null) {
        window.cancelAnimationFrame(resizeFrameRef.current)
        resizeFrameRef.current = null
      }

      inputDisposable?.dispose()
      removeOnData?.()
      removeOnExit?.()

      if (sessionId) {
        window.terminalApi.dispose({ id: sessionId })
      }

      onSessionChangeRef.current?.(tabId, null)
      sessionIdRef.current = null
      hasExitedRef.current = true
      lastSizeRef.current = { cols: null, rows: null }
      syncSizeRef.current = () => {}
      scheduleSyncRef.current = () => {}
      term.dispose()
      xtermRef.current = null
      fitAddonRef.current = null
    }
  }, [tabId, title])

  return (
    <div className="terminal-shell">
      <div className="terminal-toolbar">
        <span className="toolbar-dot red" />
        <span className="toolbar-dot yellow" />
        <span className="toolbar-dot green" />
        <span className="terminal-title">{title}</span>
        <span className="terminal-status">{status}</span>
      </div>
      <div ref={terminalRef} className="terminal-viewport" />
    </div>
  )
}

export default Terminal
