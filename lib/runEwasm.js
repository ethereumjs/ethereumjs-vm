const Contract = require('./ewasm').Contract

module.exports = (opts, cb) => {
  if (!(opts.code instanceof Contract)) {
    throw new Error('Invalid ewasm contract')
  }

  const results = opts.code.run(opts)
  results.account = opts.account
  cb(results.exceptionError, results)
}
