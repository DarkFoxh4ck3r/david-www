var GitHubApi = require('github')

module.exports = function (githubConfig) {
  var apiOptions = {
    protocol: githubConfig.api.protocol,
    host: githubConfig.api.host,
    port: githubConfig.api.port,
    version: githubConfig.api.version,
    pathPrefix: githubConfig.api.pathPrefix,
    timeout: 5000
  }

  var defaultInstance = new GitHubApi(apiOptions)

  if (githubConfig.token) {
    defaultInstance.authenticate({type: 'oauth', token: githubConfig.token})
  }

  var Github = {
    /**
     * Create an authenticated instance of the GitHub API accessor.
     *
     * @param {String} authToken OAuth access token
     * - If a user-specific token is not supplied, uses the master OAuth token
     */
    getInstance: function (authToken) {
      if (!authToken) return defaultInstance
      var instance = new GitHubApi(apiOptions)
      instance.authenticate({type: 'oauth', token: authToken})
      return instance
    }
  }

  return Github
}
