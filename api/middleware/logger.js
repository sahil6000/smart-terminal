function logger(req, _res, next) {
  console.log(`[api] ${req.method} ${req.originalUrl}`)
  next()
}

module.exports = logger
