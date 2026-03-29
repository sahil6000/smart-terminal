import darkTheme from '../themes/dark.json'
import lightTheme from '../themes/light.json'
import customTheme from '../themes/custom.json'

export const themeCatalog = [darkTheme, lightTheme, customTheme]

export const themeMap = Object.fromEntries(themeCatalog.map((theme) => [theme.name, theme]))

export const fontOptions = ['Cascadia Mono', 'JetBrains Mono', 'Fira Code', 'Consolas']

export const defaultTerminalOptions = {
  cursorBlink: true,
  cursorStyle: 'block',
  convertEol: true,
  fontFamily: 'Cascadia Mono, Consolas, monospace',
  fontSize: 15,
  lineHeight: 1.25,
  scrollback: 5000,
  theme: {
    background: darkTheme.background,
    foreground: darkTheme.foreground,
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

export const appDefaults = {
  theme: darkTheme.name,
  shell: 'cmd.exe',
  font: 'Cascadia Mono',
  fontSize: 15,
  splitView: false
}
