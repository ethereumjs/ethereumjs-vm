module.exports = {
  entryPoints: ['src'],
  out: 'docs',
  plugin: 'typedoc-plugin-markdown',
  readme: 'none',
  gitRevision: 'master',
  exclude: ['src/index.ts', 'test/*.ts'],
  excludePrivate: true,
  excludeProtected: true,
}
