const express = require('express')
const logger = require('./middleware/logger')
const historyRoutes = require('./routes/history')
const aliasRoutes = require('./routes/aliases')
const settingsRoutes = require('./routes/settings')

function createApiServer() {
  const app = express()

  app.use(express.json())
  app.use(logger)
  app.use('/history', historyRoutes)
  app.use('/aliases', aliasRoutes)
  app.use('/settings', settingsRoutes)

  app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'smart-terminal-api' })
  })

  return app
}

module.exports = { createApiServer }
