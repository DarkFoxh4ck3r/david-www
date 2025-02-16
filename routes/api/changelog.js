module.exports = function (app, changelog) {
  app.get('/package/:pkg/changes.json', function (req, res) {
    changelog.getChanges(req.params.pkg, req.query.from, req.query.to, function (err, changes) {
      if (err) {
        console.warn(err)
        return res.status(500).send({error: 'Failed to get changes'})
      }
      res.send(changes)
    })
  })
}
