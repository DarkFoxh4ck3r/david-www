module.exports = function (app, auth) {
  app.use(function (req, res, next) {
    req.session.get('session/csrf-token', function (err, csrfToken) {
      if (!err && csrfToken) {
        res.locals.csrfToken = csrfToken
        return next()
      }

      csrfToken = res.locals.csrfToken = auth.generateNonce(64)
      req.session.set('session/csrf-token', csrfToken, next)
    })
  })
}
