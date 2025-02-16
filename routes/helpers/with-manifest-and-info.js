var errors = require('./errors')

/**
 * Common callback boilerplate of getting a manifest and info for the status page and badge
 */
module.exports = function (manifest, brains) {
  return function (req, res, opts, cb) {
    // Allow callback to be passed as third parameter
    if (!cb) {
      cb = opts
      opts = {}
    }

    opts = opts || {}

    req.session.get('session/access-token', function (err, authToken) {
      if (errors.happened(err, req, res, 'Failed to get session access token')) {
        return
      }

      manifest.getManifest(req.params.user, req.params.repo, req.query.path, req.params.ref, authToken, opts, function (err, manifest) {
        if (errors.happened(err, req, res, 'Failed to get package.json')) {
          return
        }

        brains.getInfo(manifest, opts, function (err, info) {
          if (errors.happened(err, req, res, 'Failed to get dependency info')) {
            return
          }

          cb(manifest, info)
        })
      })
    })
  }
}
