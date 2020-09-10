module.exports = function(config) {
  config.set({
    browserNoActivityTimeout: 60000,
    frameworks: ['browserify', 'tap'],
    files: ['./test-build/test/**/*.js'],
    preprocessors: {
      './test-build/**/*.js': ['browserify'],
    },
    reporters: ['dots'],
    browsers: ['ChromeHeadless'],
    singleRun: true,
  })
}
