var npm = require('npm')
var moment = require('moment')
var semver = require('semver')
var cycle = require('cycle')

function Package (name, version) {
  this.name = name
  this.version = version
  this.deps = {}
  this.expires = moment().add(Package.TTL).valueOf()
}

Package.TTL = moment.duration({days: 1})

/**
 * Recursively removes the expires property from a decycled Package.
 *
 * Necessary until https://github.com/douglascrockford/JSON-js/pull/50 is pulled or a better solution becomes available.
 *
 * @param {Object} decycledPkg A decycled Package
 * @return {Object} decycledPkg
 */
function deleteExpires (decycledPkg) {
  delete decycledPkg.expires

  Object.keys(decycledPkg.deps).forEach(function (depName) {
    // Delete expires from this dependency if it isn't a decycle reference
    if (!decycledPkg.deps[depName].$ref) {
      deleteExpires(decycledPkg.deps[depName])
    }
  })

  return decycledPkg
}

var dependencies = {}

/**
 * Get the dependency graph for a given NPM dependency name and version.
 *
 * Must be executed in `npm.load()` callback.
 *
 * @param depName Package name
 * @param version
 * @param cb
 */
function getDependencyGraph (depName, version, cb) {
  dependencies[depName] = dependencies[depName] || {}

  var dep = dependencies[depName][version]

  if (dep) {
    if (dep.expires > new Date()) {
      return cb(null, dep)
    }

    dep.deps = {}
    dep.expires = moment().add(Package.TTL).valueOf()
  } else {
    dep = dependencies[depName][version] = new Package(depName, version)
  }

  process.nextTick(function () {
    npm.commands.view([depName + '@' + version, 'dependencies'], function (err, data) {
      if (err) return cb(err)

      var depDeps = data[version] ? data[version].dependencies ? data[version].dependencies : {} : {}
      var depDepNames = depDeps ? Object.keys(depDeps) : []

      // No dependencies?
      if (!depDepNames.length) {
        return cb(null, dep)
      }

      var got = 0

      depDepNames.forEach(function (depDepName) {
        var depDepRange = depDeps[depDepName]

        latestSatisfying(depDepName, depDepRange, function (err, depDepVersion) {
          if (err && err.code !== 'E404') return cb(err)

          // There should be a version that satisfies!
          // But...
          // The range could be a tag, or a git repo
          if (!depDepVersion) {
            // Add a dummy package with the range as it's version
            dep.deps[depDepName] = new Package(depDepName, depDepRange)

            got++

            if (got === depDepNames.length) {
              dependencies[depName][version] = dep
              cb(null, dep)
            }
          } else {
            getDependencyGraph(depDepName, depDepVersion, function (err, depDep) {
              if (err) return cb(err)

              dep.deps[depDepName] = depDep

              got++

              if (got === depDepNames.length) {
                dependencies[depName][version] = dep
                cb(null, dep)
              }
            })
          }
        }) // npm
      })
    })
  })
}

/**
 * Get the latest version for the passed dependency name that satisfies the passed range.
 *
 * Must be executed in `npm.load()` callback.
 *
 * @param depName
 * @param range
 * @param cb
 */
function latestSatisfying (depName, range, cb) {
  npm.commands.view([depName, 'versions'], function (err, data) {
    if (err) return cb(err)

    var keys = Object.keys(data)

    // `npm view 0 versions` returns {} - ensure some data was returned
    if (!keys.length) {
      return cb()
    }

    if (range === 'latest') {
      range = ''
    }

    // Get the most recent version that satisfies the range
    var version = semver.maxSatisfying(data[keys[0]].versions, range, true)

    cb(null, version)
  })
}

module.exports = function (db, npmConfig) {
  var Graph = {
    /**
     * Get dependency graph for a non-NPM project
     *
     * @param name
     * @param version
     * @param deps
     * @param {Function} cb Second parameter is decycled dependency graph
     * @see https://github.com/douglascrockford/JSON-js/blob/master/cycle.js
     */
    getProjectDependencyGraph: function (name, version, deps, cb) {
      var projectGraphKey = 'graph/project/' + name + '/' + version

      db.get(projectGraphKey, function (err, project) {
        if (err && !err.notFound) return cb(err)

        if (project) {
          if (project.expires > Date.now()) {
            console.log('Using cached project dependency graph', projectGraphKey)
            return cb(null, deleteExpires(project))
          }

          project.deps = {}
          project.expires = moment().add(Package.TTL).valueOf()
        } else {
          project = new Package(name, version)
        }

        npm.load(npmConfig.options, function (err) {
          if (err) return cb(err)

          var depNames = Object.keys(deps)
          var done = 0

          if (!depNames.length) {
            project = cycle.decycle(project)

            return db.put(projectGraphKey, project, function (err) {
              if (err) return cb(err)
              cb(null, deleteExpires(project))
            })
          }

          depNames.forEach(function (depName) {
            var range = deps[depName]

            latestSatisfying(depName, range, function (err, version) {
              if (err && err.code !== 'E404') return cb(err)

              // There should be a version that satisfies!
              // But...
              // The range could be a tag, or a git repo
              if (!version) {
                // Add a dummy package with the range as it's version
                project.deps[depName] = new Package(depName, range)

                done++

                if (done === depNames.length) {
                  project = cycle.decycle(project)

                  db.put(projectGraphKey, project, function (err) {
                    if (err) return cb(err)
                    cb(null, deleteExpires(project))
                  })
                }
              } else {
                getDependencyGraph(depName, version, function (err, dep) {
                  if (err) return cb(err)

                  project.deps[depName] = dep

                  done++

                  if (done === depNames.length) {
                    project = cycle.decycle(project)

                    db.put(projectGraphKey, project, function (err) {
                      if (err) return cb(err)
                      cb(null, deleteExpires(project))
                    })
                  }
                })
              }
            })
          })
        })
      })
    }
  }

  return Graph
}
