import { useEffect, useMemo, useState } from 'react'
import Prompt from './components/Prompt'
import Settings from './components/Settings'
import SplitPane from './components/SplitPane'
import TabBar from './components/TabBar'
import { appDefaults, themeMap } from './config/settings'

const settingsStorageKey = 'smart-terminal-settings'

function createTab(index) {
  return {
    id: `tab-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`,
    title: `Shell ${index}`
  }
}

function App() {
  const [tabs, setTabs] = useState(() => [createTab(1)])
  const [activeTabId, setActiveTabId] = useState(null)
  const [splitTabId, setSplitTabId] = useState(null)
  const [tabSessionIds, setTabSessionIds] = useState({})
  const [settings, setSettings] = useState(() => {
    try {
      const saved = window.localStorage.getItem(settingsStorageKey)
      return saved ? { ...appDefaults, ...JSON.parse(saved) } : appDefaults
    } catch (error) {
      console.error('Failed to load saved settings, falling back to defaults.', error)
      window.localStorage.removeItem(settingsStorageKey)
      return appDefaults
    }
  })

  useEffect(() => {
    if (!activeTabId && tabs[0]) {
      setActiveTabId(tabs[0].id)
    }
  }, [activeTabId, tabs])

  useEffect(() => {
    window.localStorage.setItem(settingsStorageKey, JSON.stringify(settings))
  }, [settings])

  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0]
  const secondaryTab =
    settings.splitView && tabs.length > 1
      ? tabs.find((tab) => tab.id === splitTabId && tab.id !== activeTab?.id) ??
        tabs.find((tab) => tab.id !== activeTab?.id)
      : null
  const activeSessionId = activeTab ? tabSessionIds[activeTab.id] ?? null : null

  const appearance = useMemo(() => {
    const selectedTheme = themeMap[settings.theme] ?? themeMap[appDefaults.theme]

    return {
      fontFamily: `${settings.font}, Consolas, monospace`,
      fontSize: settings.fontSize,
      theme: {
        background: selectedTheme.background,
        foreground: selectedTheme.foreground,
        black: '#0f172a',
        brightBlack: '#475569',
        red: '#f87171',
        brightRed: '#fca5a5',
        green: '#4ade80',
        brightGreen: '#86efac',
        yellow: '#facc15',
        brightYellow: '#fde047',
        blue: '#60a5fa',
        brightBlue: '#93c5fd',
        magenta: '#c084fc',
        brightMagenta: '#d8b4fe',
        cyan: '#22d3ee',
        brightCyan: '#67e8f9',
        white: '#e2e8f0',
        brightWhite: '#f8fafc'
      }
    }
  }, [settings.font, settings.fontSize, settings.theme])

  const handleNewTab = () => {
    const nextTab = createTab(tabs.length + 1)
    setTabs((current) => [...current, nextTab])
    setActiveTabId(nextTab.id)

    if (settings.splitView && !splitTabId && activeTab) {
      setSplitTabId(activeTab.id)
    }
  }

  const handleActivateTab = (tabId) => {
    if (settings.splitView && tabId !== activeTabId) {
      setSplitTabId(activeTabId)
    }

    setActiveTabId(tabId)
  }

  const handleCloseTab = (tabId) => {
    setTabSessionIds((current) => {
      const next = { ...current }
      delete next[tabId]
      return next
    })

    setTabs((current) => {
      const remaining = current.filter((tab) => tab.id !== tabId)

      if (remaining.length === 0) {
        const fallback = createTab(1)
        setActiveTabId(fallback.id)
        setSplitTabId(null)
        return [fallback]
      }

      if (tabId === activeTabId) {
        setActiveTabId(remaining[0].id)
      }

      if (tabId === splitTabId) {
        setSplitTabId(remaining.find((tab) => tab.id !== activeTabId)?.id ?? null)
      }

      return remaining
    })
  }

  const handleToggleSplit = () => {
    const nextEnabled = !settings.splitView
    setSettings((current) => ({ ...current, splitView: nextEnabled }))

    if (nextEnabled) {
      const nextSplit = tabs.find((tab) => tab.id !== activeTab?.id)
      if (nextSplit) {
        setSplitTabId(nextSplit.id)
      } else {
        const nextTab = createTab(tabs.length + 1)
        setTabs((current) => [...current, nextTab])
        setSplitTabId(nextTab.id)
      }
    } else {
      setSplitTabId(null)
    }
  }

  const handleSettingChange = (key, value) => {
    setSettings((current) => ({ ...current, [key]: value }))
  }

  const handleFontStep = (step) => {
    setSettings((current) => ({
      ...current,
      fontSize: Math.max(12, Math.min(24, current.fontSize + step))
    }))
  }

  const handleSessionChange = (tabId, sessionId) => {
    setTabSessionIds((current) => {
      if (current[tabId] === sessionId) {
        return current
      }

      const next = { ...current }

      if (sessionId) {
        next[tabId] = sessionId
      } else {
        delete next[tabId]
      }

      return next
    })
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Desktop Terminal</p>
          <h1>Custom PC Terminal Emulator</h1>
        </div>
        <p className="header-copy">
          Real shell access now, with live theme controls, tabs, and split panes on top of the desktop terminal core.
        </p>
      </header>

      <section className="workspace-layout">
        <aside className="sidebar-card">
          <TabBar
            tabs={tabs}
            activeTabId={activeTab?.id}
            splitTabId={secondaryTab?.id ?? splitTabId}
            splitView={settings.splitView}
            onActivate={handleActivateTab}
            onClose={handleCloseTab}
            onNewTab={handleNewTab}
            onToggleSplit={handleToggleSplit}
          />
          <Prompt activeTab={activeTab} sessionId={activeSessionId} />
          <Settings settings={settings} onChange={handleSettingChange} onFontStep={handleFontStep} />
        </aside>

        <section className="terminal-panel">
          <SplitPane
            terminals={tabs}
            activeTabId={activeTab?.id ?? null}
            secondaryTabId={secondaryTab?.id ?? null}
            appearance={appearance}
            splitView={settings.splitView}
            onActivateTab={handleActivateTab}
            onSessionChange={handleSessionChange}
          />
        </section>
      </section>
    </main>
  )
}

export default App
