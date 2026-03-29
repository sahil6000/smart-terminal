const express = require('express')

const router = express.Router()

router.get('/', (_req, res) => {
  res.json({ items: [], message: 'Alias endpoint scaffolded for Phase 3.' })
})

router.post('/', (req, res) => {
  res.status(202).json({
    item: req.body ?? {},
    message: 'Alias creation will be persisted once MongoDB wiring is enabled.'
  })
})

module.exports = router
