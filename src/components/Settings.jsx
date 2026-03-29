import { fontOptions, themeCatalog } from '../config/settings'

function Settings({ settings, onChange, onFontStep }) {
  return (
    <section className="info-card">
      <div className="section-heading">
        <h2>Appearance</h2>
      </div>
      <div className="kv-list">
        <div>
          <span className="kv-label">Theme</span>
          <select
            className="control-input"
            value={settings.theme}
            onChange={(event) => onChange('theme', event.target.value)}
          >
            {themeCatalog.map((theme) => (
              <option key={theme.name} value={theme.name}>
                {theme.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <span className="kv-label">Font</span>
          <select
            className="control-input"
            value={settings.font}
            onChange={(event) => onChange('font', event.target.value)}
          >
            {fontOptions.map((font) => (
              <option key={font} value={font}>
                {font}
              </option>
            ))}
          </select>
        </div>
        <div>
          <span className="kv-label">Font Size</span>
          <div className="stepper">
            <button className="icon-button" type="button" onClick={() => onFontStep(-1)}>
              -
            </button>
            <strong>{settings.fontSize}px</strong>
            <button className="icon-button" type="button" onClick={() => onFontStep(1)}>
              +
            </button>
          </div>
        </div>
      </div>
      <p className="muted-copy">Theme and font changes now apply live to every open terminal session.</p>
    </section>
  )
}

export default Settings
