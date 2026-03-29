const express = require('express')

const router = express.Router()

router.get('/', (_req, res) => {
  res.json({
    theme: 'Midnight Circuit',
    font: 'Cascadia Mono',
    fontSize: 15,
    shell: 'cmd.exe'
  })
})

router.put('/', (req, res) => {
  res.status(202).json({
    ...req.body,
    message: 'Settings persistence is scaffolded and ready for MongoDB integration.'
  })
})

module.exports = router
