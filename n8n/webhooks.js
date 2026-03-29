const triggerMap = {
  deploy: 'http://localhost:5678/webhook/deploy',
  'backup-db': 'http://localhost:5678/webhook/backup-db'
}

async function triggerWorkflow(keyword) {
  return {
    ok: false,
    keyword,
    url: triggerMap[keyword] ?? null,
    message: 'N8N webhook integration is scaffolded for Phase 5.'
  }
}

module.exports = { triggerMap, triggerWorkflow }
