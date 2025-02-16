module.exports = function (app, manifest, brains) {
  var withManifestAndInfo = require('./helpers/with-manifest-and-info')(manifest, brains)

  app.get('/:user/:repo/:ref?', function (req, res) {
    withManifestAndInfo(req, res, {noCache: !!res.locals.user}, function (manifest, info) {
      res.render('status', {
        user: req.params.user,
        repo: req.params.repo,
        path: req.query.path,
        ref: req.params.ref ? '/' + req.params.ref : '',
        manifest: manifest,
        info: info
      })
    })
  })
}
