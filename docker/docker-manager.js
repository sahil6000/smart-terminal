function createDockerManager() {
  return {
    listContainers: async () => [],
    startContainerShell: async (image) => ({
      ok: false,
      image,
      message: 'Docker integration is scaffolded for Phase 4.'
    })
  }
}

module.exports = { createDockerManager }
