# Smart Terminal

Custom desktop terminal emulator built with Electron, React, xterm.js, and node-pty.

## Current Status

- Phase 1 terminal shell is working in Electron.
- Windows dev startup now auto-selects a free renderer port.
- Electron cache and GPU cache paths are redirected to app-owned directories.
- The repo structure for later phases is scaffolded under `api/`, `db/`, `docker/`, `n8n/`, and `src/components/`.

## Run

```powershell
npm install
npm run dev
```

## Production-style launch

```powershell
npm start
```

## Planned Phases

1. Working shell terminal
2. Themes, tabs, split panes, and settings UI
3. Local Express API and MongoDB persistence
4. Docker container shell sessions
5. N8N webhook automation commands
