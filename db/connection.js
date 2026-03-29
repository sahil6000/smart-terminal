async function connectDatabase() {
  return {
    ok: true,
    message: 'MongoDB connection scaffolded. Install mongoose and add your local URI in Phase 3.'
  }
}

module.exports = { connectDatabase }
