import Terminal from './Terminal'

function SplitPane({ terminals, activeTabId, secondaryTabId, appearance, splitView, onActivateTab, onSessionChange }) {
  const visibleTabIds = new Set(splitView ? [activeTabId, secondaryTabId].filter(Boolean) : [activeTabId].filter(Boolean))

  return (
    <div className={`split-pane ${splitView ? 'is-split' : ''}`}>
      {terminals.map((terminal) => {
        const isVisible = visibleTabIds.has(terminal.id)
        const shouldFocus = activeTabId === terminal.id
        const isActive = activeTabId === terminal.id

        return (
          <div
            key={terminal.id}
            className={`split-pane__panel ${isVisible ? 'is-visible' : 'is-hidden'} ${isActive ? 'is-active' : ''}`}
          >
            <Terminal
              tabId={terminal.id}
              title={terminal.title}
              appearance={appearance}
              isVisible={isVisible}
              shouldFocus={shouldFocus}
              layoutMode={splitView ? 'split' : 'single'}
              onActivate={onActivateTab}
              onSessionChange={onSessionChange}
            />
          </div>
        )
      })}
    </div>
  )
}

export default SplitPane
