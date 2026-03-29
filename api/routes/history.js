const express = require('express')

const router = express.Router()

router.get('/', (_req, res) => {
  res.json({ items: [], message: 'History endpoint scaffolded for Phase 3.' })
})

module.exports = router
