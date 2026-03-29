const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('terminalApi', {
  createSession: (options) => ipcRenderer.invoke('terminal:create', options),
  getPromptState: (payload) => ipcRenderer.invoke('terminal:get-prompt-state', payload),
  readClipboardText: () => ipcRenderer.invoke('clipboard:read-text'),
  sendInput: (payload) => ipcRenderer.send('terminal:input', payload),
  resize: (payload) => ipcRenderer.send('terminal:resize', payload),
  dispose: (payload) => ipcRenderer.send('terminal:dispose', payload),
  writeClipboardText: (text) => ipcRenderer.invoke('clipboard:write-text', text),
  onData: (callback) => {
    const listener = (_event, data) => callback(data)
    ipcRenderer.on('terminal:data', listener)
    return () => ipcRenderer.removeListener('terminal:data', listener)
  },
  onExit: (callback) => {
    const listener = (_event, data) => callback(data)
    ipcRenderer.on('terminal:exit', listener)
    return () => ipcRenderer.removeListener('terminal:exit', listener)
  },
  onPromptState: (callback) => {
    const listener = (_event, data) => callback(data)
    ipcRenderer.on('terminal:prompt', listener)
    return () => ipcRenderer.removeListener('terminal:prompt', listener)
  }
})
