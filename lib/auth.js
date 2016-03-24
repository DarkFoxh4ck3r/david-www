const crypto = require('crypto')
const request = require('request')
const config = require('../config')
const github = require('./github')

module.exports.generateNonce = (len) => crypto.randomBytes(len * 2).toString('hex').slice(0, len)

module.exports.requestAccessToken = (code, cb) => {
  var tokenRequest = {
    url: `${config.github.protocol}://${config.github.host}/login/oauth/access_token`,
    json: {
      client_id: config.github.oauth.id,
      client_secret: config.github.oauth.secret,
      code: code
    }
  }
  request.post(tokenRequest, (err, tokenRes, data) => {
    if (err || tokenRes.statusCode !== 200) {
      return cb(err || new Error('Unable to exchange code for token'))
    }

    data = data || {}
    if (!data.access_token) {
      return cb(new Error('Failed to receive access token from GitHub'))
    }

    var authData = { access_token: data.access_token }
    var gh = github.getInstance(data.access_token)

    gh.user.get({}, (err, data) => {
      if (err) return cb(err)
      if (!data.login) return cb(new Error('Unable to find user from token'))

      authData.user = data.login
      cb(null, authData)
    })
  })
}
