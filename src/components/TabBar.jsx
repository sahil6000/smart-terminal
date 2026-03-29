function TabBar({ tabs, activeTabId, splitTabId, splitView, onActivate, onClose, onNewTab, onToggleSplit }) {
  return (
    <section className="info-card">
      <div className="section-heading">
        <h2>Sessions</h2>
        <span className="pill">{splitView ? 'Split On' : 'Single View'}</span>
      </div>
      <div className="tab-list">
        {tabs.map((tab) => (
          <div key={tab.id} className={`tab-chip ${activeTabId === tab.id ? 'active' : ''}`}>
            <button className="tab-chip__button" type="button" onClick={() => onActivate(tab.id)}>
              {tab.title}
            </button>
            {splitView && splitTabId === tab.id ? <span className="split-marker">Split</span> : null}
            {tabs.length > 1 ? (
              <button className="tab-chip__close" type="button" onClick={() => onClose(tab.id)}>
                x
              </button>
            ) : null}
          </div>
        ))}
      </div>
      <div className="action-row">
        <button className="action-button" type="button" onClick={onNewTab}>
          New Tab
        </button>
        <button className="action-button secondary" type="button" onClick={onToggleSplit}>
          {splitView ? 'Disable Split' : 'Enable Split'}
        </button>
      </div>
      <p className="muted-copy">
        Each tab runs in its own PTY-backed shell session. Split view shows the active tab beside a second session.
      </p>
    </section>
  )
}

export default TabBar
