<p align="center">
  <img src="https://user-images.githubusercontent.com/47108/78779352-d0839500-796a-11ea-9468-fd2a0b3fe1ef.png" width=280>
</p>

# EthereumJS Monorepo

[![Code Coverage][coverage-badge]][coverage-link]
[![Discord][discord-badge]][discord-link]

This was originally the EthereumJS VM repository. On Q1 2020 we brought some of its building blocks together to simplify development. Below you can find the packages included in this repository.

🚧 Please note that the `master` branch is updated on a daily basis, and to inspect code related to a specific package version, refer to the [tags](https://github.com/ethereumjs/ethereumjs-vm/tags).

| package                                     | npm                                                         | issues                                                                  | tests                                                                  | coverage                                                                |
| ------------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| [@ethereumjs/block][block-package]           | [![NPM Package][block-npm-badge]][block-npm-link]           | [![Block Issues][block-issues-badge]][block-issues-link]                | [![Actions Status][block-actions-badge]][block-actions-link]           | [![Code Coverage][block-coverage-badge]][block-coverage-link]           |
| [@ethereumjs/blockchain][blockchain-package] | [![NPM Package][blockchain-npm-badge]][blockchain-npm-link] | [![Blockchain Issues][blockchain-issues-badge]][blockchain-issues-link] | [![Actions Status][blockchain-actions-badge]][blockchain-actions-link] | [![Code Coverage][blockchain-coverage-badge]][blockchain-coverage-link] |
| [@ethereumjs/common][common-package]         | [![NPM Package][common-npm-badge]][common-npm-link]         | [![Common Issues][common-issues-badge]][common-issues-link]             | [![Actions Status][common-actions-badge]][common-actions-link]         | [![Code Coverage][common-coverage-badge]][common-coverage-link]         |
| [@ethereumjs/ethash][ethash-package]         | [![NPM Package][ethash-npm-badge]][ethash-npm-link]         | [![Ethash Issues][ethash-issues-badge]][ethash-issues-link]             | [![Actions Status][ethash-actions-badge]][ethash-actions-link]         | [![Code Coverage][ethash-coverage-badge]][ethash-coverage-link]         |
| [@ethereumjs/tx][tx-package]                 | [![NPM Package][tx-npm-badge]][tx-npm-link]                 | [![Tx Issues][tx-issues-badge]][tx-issues-link]                         | [![Actions Status][tx-actions-badge]][tx-actions-link]                 | [![Code Coverage][tx-coverage-badge]][tx-coverage-link]                 |
| [@ethereumjs/vm][vm-package]                 | [![NPM Package][vm-npm-badge]][vm-npm-link]                 | [![VM Issues][vm-issues-badge]][vm-issues-link]                         | [![Actions Status][vm-actions-badge]][vm-actions-link]                 | [![Code Coverage][vm-coverage-badge]][vm-coverage-link]                 |

## Coverage report

Detailed version can be seen on [Codecov.io][coverage-link]

[![Code Coverage](https://codecov.io/gh/ethereumjs/ethereumjs-vm/branch/master/graphs/icicle.svg)][coverage-link]

## Package dependency relationship

<p align="center">
 <img width="409" alt="diagram" src="https://mermaid.ink/svg/eyJjb2RlIjoiZ3JhcGggVERcbiAgdm17Vk19XG4gIGNvbW1vbiAtLT4gYmxvY2tjaGFpblxuICBjb21tb24gLS0-IGJsb2NrXG4gIGNvbW1vbiAtLT4gdm1cbiAgY29tbW9uIC0tPiB0eFxuICBldGhhc2ggLS0-IGJsb2NrY2hhaW5cbiAgYmxvY2sgLS0-IGJsb2NrY2hhaW5cbiAgYmxvY2tjaGFpbiAtLT4gdm1cbiAgYmxvY2sgLS0-IHZtXG4gIHR4IC0tPiB2bVxuICB0eCAtLT4gYmxvY2tcbiAgIiwibWVybWFpZCI6eyJ0aGVtZSI6ImRlZmF1bHQiLCJ0aGVtZVZhcmlhYmxlcyI6eyJiYWNrZ3JvdW5kIjoid2hpdGUiLCJwcmltYXJ5Q29sb3IiOiIjRUNFQ0ZGIiwic2Vjb25kYXJ5Q29sb3IiOiIjZmZmZmRlIiwidGVydGlhcnlDb2xvciI6ImhzbCg4MCwgMTAwJSwgOTYuMjc0NTA5ODAzOSUpIiwicHJpbWFyeUJvcmRlckNvbG9yIjoiaHNsKDI0MCwgNjAlLCA4Ni4yNzQ1MDk4MDM5JSkiLCJzZWNvbmRhcnlCb3JkZXJDb2xvciI6ImhzbCg2MCwgNjAlLCA4My41Mjk0MTE3NjQ3JSkiLCJ0ZXJ0aWFyeUJvcmRlckNvbG9yIjoiaHNsKDgwLCA2MCUsIDg2LjI3NDUwOTgwMzklKSIsInByaW1hcnlUZXh0Q29sb3IiOiIjMTMxMzAwIiwic2Vjb25kYXJ5VGV4dENvbG9yIjoiIzAwMDAyMSIsInRlcnRpYXJ5VGV4dENvbG9yIjoicmdiKDkuNTAwMDAwMDAwMSwgOS41MDAwMDAwMDAxLCA5LjUwMDAwMDAwMDEpIiwibGluZUNvbG9yIjoiIzMzMzMzMyIsInRleHRDb2xvciI6IiMzMzMiLCJtYWluQmtnIjoiI0VDRUNGRiIsInNlY29uZEJrZyI6IiNmZmZmZGUiLCJib3JkZXIxIjoiIzkzNzBEQiIsImJvcmRlcjIiOiIjYWFhYTMzIiwiYXJyb3doZWFkQ29sb3IiOiIjMzMzMzMzIiwiZm9udEZhbWlseSI6IlwidHJlYnVjaGV0IG1zXCIsIHZlcmRhbmEsIGFyaWFsIiwiZm9udFNpemUiOiIxNnB4IiwibGFiZWxCYWNrZ3JvdW5kIjoiI2U4ZThlOCIsIm5vZGVCa2ciOiIjRUNFQ0ZGIiwibm9kZUJvcmRlciI6IiM5MzcwREIiLCJjbHVzdGVyQmtnIjoiI2ZmZmZkZSIsImNsdXN0ZXJCb3JkZXIiOiIjYWFhYTMzIiwiZGVmYXVsdExpbmtDb2xvciI6IiMzMzMzMzMiLCJ0aXRsZUNvbG9yIjoiIzMzMyIsImVkZ2VMYWJlbEJhY2tncm91bmQiOiIjZThlOGU4IiwiYWN0b3JCb3JkZXIiOiJoc2woMjU5LjYyNjE2ODIyNDMsIDU5Ljc3NjUzNjMxMjglLCA4Ny45MDE5NjA3ODQzJSkiLCJhY3RvckJrZyI6IiNFQ0VDRkYiLCJhY3RvclRleHRDb2xvciI6ImJsYWNrIiwiYWN0b3JMaW5lQ29sb3IiOiJncmV5Iiwic2lnbmFsQ29sb3IiOiIjMzMzIiwic2lnbmFsVGV4dENvbG9yIjoiIzMzMyIsImxhYmVsQm94QmtnQ29sb3IiOiIjRUNFQ0ZGIiwibGFiZWxCb3hCb3JkZXJDb2xvciI6ImhzbCgyNTkuNjI2MTY4MjI0MywgNTkuNzc2NTM2MzEyOCUsIDg3LjkwMTk2MDc4NDMlKSIsImxhYmVsVGV4dENvbG9yIjoiYmxhY2siLCJsb29wVGV4dENvbG9yIjoiYmxhY2siLCJub3RlQm9yZGVyQ29sb3IiOiIjYWFhYTMzIiwibm90ZUJrZ0NvbG9yIjoiI2ZmZjVhZCIsIm5vdGVUZXh0Q29sb3IiOiJibGFjayIsImFjdGl2YXRpb25Cb3JkZXJDb2xvciI6IiM2NjYiLCJhY3RpdmF0aW9uQmtnQ29sb3IiOiIjZjRmNGY0Iiwic2VxdWVuY2VOdW1iZXJDb2xvciI6IndoaXRlIiwic2VjdGlvbkJrZ0NvbG9yIjoicmdiYSgxMDIsIDEwMiwgMjU1LCAwLjQ5KSIsImFsdFNlY3Rpb25Ca2dDb2xvciI6IndoaXRlIiwic2VjdGlvbkJrZ0NvbG9yMiI6IiNmZmY0MDAiLCJ0YXNrQm9yZGVyQ29sb3IiOiIjNTM0ZmJjIiwidGFza0JrZ0NvbG9yIjoiIzhhOTBkZCIsInRhc2tUZXh0TGlnaHRDb2xvciI6IndoaXRlIiwidGFza1RleHRDb2xvciI6IndoaXRlIiwidGFza1RleHREYXJrQ29sb3IiOiJibGFjayIsInRhc2tUZXh0T3V0c2lkZUNvbG9yIjoiYmxhY2siLCJ0YXNrVGV4dENsaWNrYWJsZUNvbG9yIjoiIzAwMzE2MyIsImFjdGl2ZVRhc2tCb3JkZXJDb2xvciI6IiM1MzRmYmMiLCJhY3RpdmVUYXNrQmtnQ29sb3IiOiIjYmZjN2ZmIiwiZ3JpZENvbG9yIjoibGlnaHRncmV5IiwiZG9uZVRhc2tCa2dDb2xvciI6ImxpZ2h0Z3JleSIsImRvbmVUYXNrQm9yZGVyQ29sb3IiOiJncmV5IiwiY3JpdEJvcmRlckNvbG9yIjoiI2ZmODg4OCIsImNyaXRCa2dDb2xvciI6InJlZCIsInRvZGF5TGluZUNvbG9yIjoicmVkIiwibGFiZWxDb2xvciI6ImJsYWNrIiwiZXJyb3JCa2dDb2xvciI6IiM1NTIyMjIiLCJlcnJvclRleHRDb2xvciI6IiM1NTIyMjIiLCJjbGFzc1RleHQiOiIjMTMxMzAwIiwiZmlsbFR5cGUwIjoiI0VDRUNGRiIsImZpbGxUeXBlMSI6IiNmZmZmZGUiLCJmaWxsVHlwZTIiOiJoc2woMzA0LCAxMDAlLCA5Ni4yNzQ1MDk4MDM5JSkiLCJmaWxsVHlwZTMiOiJoc2woMTI0LCAxMDAlLCA5My41Mjk0MTE3NjQ3JSkiLCJmaWxsVHlwZTQiOiJoc2woMTc2LCAxMDAlLCA5Ni4yNzQ1MDk4MDM5JSkiLCJmaWxsVHlwZTUiOiJoc2woLTQsIDEwMCUsIDkzLjUyOTQxMTc2NDclKSIsImZpbGxUeXBlNiI6ImhzbCg4LCAxMDAlLCA5Ni4yNzQ1MDk4MDM5JSkiLCJmaWxsVHlwZTciOiJoc2woMTg4LCAxMDAlLCA5My41Mjk0MTE3NjQ3JSkifX19">
</p>

<!-- CREATED WITH MERMAID
https://mermaid-js.github.io/mermaid-live-editor/#/edit/eyJjb2RlIjoiZ3JhcGggVERcbiAgdm17Vk19XG4gIGNvbW1vbiAtLT4gYmxvY2tjaGFpblxuICBjb21tb24gLS0-IGJsb2NrXG4gIGNvbW1vbiAtLT4gdm1cbiAgY29tbW9uIC0tPiB0eFxuICBldGhhc2ggLS0-IGJsb2NrY2hhaW5cbiAgYmxvY2sgLS0-IGJsb2NrY2hhaW5cbiAgYmxvY2tjaGFpbiAtLT4gdm1cbiAgYmxvY2sgLS0-IHZtXG4gIHR4IC0tPiB2bVxuICB0eCAtLT4gYmxvY2tcbiAgIiwibWVybWFpZCI6eyJ0aGVtZSI6ImRlZmF1bHQiLCJ0aGVtZVZhcmlhYmxlcyI6eyJiYWNrZ3JvdW5kIjoid2hpdGUiLCJwcmltYXJ5Q29sb3IiOiIjRUNFQ0ZGIiwic2Vjb25kYXJ5Q29sb3IiOiIjZmZmZmRlIiwidGVydGlhcnlDb2xvciI6ImhzbCg4MCwgMTAwJSwgOTYuMjc0NTA5ODAzOSUpIiwicHJpbWFyeUJvcmRlckNvbG9yIjoiaHNsKDI0MCwgNjAlLCA4Ni4yNzQ1MDk4MDM5JSkiLCJzZWNvbmRhcnlCb3JkZXJDb2xvciI6ImhzbCg2MCwgNjAlLCA4My41Mjk0MTE3NjQ3JSkiLCJ0ZXJ0aWFyeUJvcmRlckNvbG9yIjoiaHNsKDgwLCA2MCUsIDg2LjI3NDUwOTgwMzklKSIsInByaW1hcnlUZXh0Q29sb3IiOiIjMTMxMzAwIiwic2Vjb25kYXJ5VGV4dENvbG9yIjoiIzAwMDAyMSIsInRlcnRpYXJ5VGV4dENvbG9yIjoicmdiKDkuNTAwMDAwMDAwMSwgOS41MDAwMDAwMDAxLCA5LjUwMDAwMDAwMDEpIiwibGluZUNvbG9yIjoiIzMzMzMzMyIsInRleHRDb2xvciI6IiMzMzMiLCJtYWluQmtnIjoiI0VDRUNGRiIsInNlY29uZEJrZyI6IiNmZmZmZGUiLCJib3JkZXIxIjoiIzkzNzBEQiIsImJvcmRlcjIiOiIjYWFhYTMzIiwiYXJyb3doZWFkQ29sb3IiOiIjMzMzMzMzIiwiZm9udEZhbWlseSI6IlwidHJlYnVjaGV0IG1zXCIsIHZlcmRhbmEsIGFyaWFsIiwiZm9udFNpemUiOiIxNnB4IiwibGFiZWxCYWNrZ3JvdW5kIjoiI2U4ZThlOCIsIm5vZGVCa2ciOiIjRUNFQ0ZGIiwibm9kZUJvcmRlciI6IiM5MzcwREIiLCJjbHVzdGVyQmtnIjoiI2ZmZmZkZSIsImNsdXN0ZXJCb3JkZXIiOiIjYWFhYTMzIiwiZGVmYXVsdExpbmtDb2xvciI6IiMzMzMzMzMiLCJ0aXRsZUNvbG9yIjoiIzMzMyIsImVkZ2VMYWJlbEJhY2tncm91bmQiOiIjZThlOGU4IiwiYWN0b3JCb3JkZXIiOiJoc2woMjU5LjYyNjE2ODIyNDMsIDU5Ljc3NjUzNjMxMjglLCA4Ny45MDE5NjA3ODQzJSkiLCJhY3RvckJrZyI6IiNFQ0VDRkYiLCJhY3RvclRleHRDb2xvciI6ImJsYWNrIiwiYWN0b3JMaW5lQ29sb3IiOiJncmV5Iiwic2lnbmFsQ29sb3IiOiIjMzMzIiwic2lnbmFsVGV4dENvbG9yIjoiIzMzMyIsImxhYmVsQm94QmtnQ29sb3IiOiIjRUNFQ0ZGIiwibGFiZWxCb3hCb3JkZXJDb2xvciI6ImhzbCgyNTkuNjI2MTY4MjI0MywgNTkuNzc2NTM2MzEyOCUsIDg3LjkwMTk2MDc4NDMlKSIsImxhYmVsVGV4dENvbG9yIjoiYmxhY2siLCJsb29wVGV4dENvbG9yIjoiYmxhY2siLCJub3RlQm9yZGVyQ29sb3IiOiIjYWFhYTMzIiwibm90ZUJrZ0NvbG9yIjoiI2ZmZjVhZCIsIm5vdGVUZXh0Q29sb3IiOiJibGFjayIsImFjdGl2YXRpb25Cb3JkZXJDb2xvciI6IiM2NjYiLCJhY3RpdmF0aW9uQmtnQ29sb3IiOiIjZjRmNGY0Iiwic2VxdWVuY2VOdW1iZXJDb2xvciI6IndoaXRlIiwic2VjdGlvbkJrZ0NvbG9yIjoicmdiYSgxMDIsIDEwMiwgMjU1LCAwLjQ5KSIsImFsdFNlY3Rpb25Ca2dDb2xvciI6IndoaXRlIiwic2VjdGlvbkJrZ0NvbG9yMiI6IiNmZmY0MDAiLCJ0YXNrQm9yZGVyQ29sb3IiOiIjNTM0ZmJjIiwidGFza0JrZ0NvbG9yIjoiIzhhOTBkZCIsInRhc2tUZXh0TGlnaHRDb2xvciI6IndoaXRlIiwidGFza1RleHRDb2xvciI6IndoaXRlIiwidGFza1RleHREYXJrQ29sb3IiOiJibGFjayIsInRhc2tUZXh0T3V0c2lkZUNvbG9yIjoiYmxhY2siLCJ0YXNrVGV4dENsaWNrYWJsZUNvbG9yIjoiIzAwMzE2MyIsImFjdGl2ZVRhc2tCb3JkZXJDb2xvciI6IiM1MzRmYmMiLCJhY3RpdmVUYXNrQmtnQ29sb3IiOiIjYmZjN2ZmIiwiZ3JpZENvbG9yIjoibGlnaHRncmV5IiwiZG9uZVRhc2tCa2dDb2xvciI6ImxpZ2h0Z3JleSIsImRvbmVUYXNrQm9yZGVyQ29sb3IiOiJncmV5IiwiY3JpdEJvcmRlckNvbG9yIjoiI2ZmODg4OCIsImNyaXRCa2dDb2xvciI6InJlZCIsInRvZGF5TGluZUNvbG9yIjoicmVkIiwibGFiZWxDb2xvciI6ImJsYWNrIiwiZXJyb3JCa2dDb2xvciI6IiM1NTIyMjIiLCJlcnJvclRleHRDb2xvciI6IiM1NTIyMjIiLCJjbGFzc1RleHQiOiIjMTMxMzAwIiwiZmlsbFR5cGUwIjoiI0VDRUNGRiIsImZpbGxUeXBlMSI6IiNmZmZmZGUiLCJmaWxsVHlwZTIiOiJoc2woMzA0LCAxMDAlLCA5Ni4yNzQ1MDk4MDM5JSkiLCJmaWxsVHlwZTMiOiJoc2woMTI0LCAxMDAlLCA5My41Mjk0MTE3NjQ3JSkiLCJmaWxsVHlwZTQiOiJoc2woMTc2LCAxMDAlLCA5Ni4yNzQ1MDk4MDM5JSkiLCJmaWxsVHlwZTUiOiJoc2woLTQsIDEwMCUsIDkzLjUyOTQxMTc2NDclKSIsImZpbGxUeXBlNiI6ImhzbCg4LCAxMDAlLCA5Ni4yNzQ1MDk4MDM5JSkiLCJmaWxsVHlwZTciOiJoc2woMTg4LCAxMDAlLCA5My41Mjk0MTE3NjQ3JSkifX19
-->

## Development quick start

First, make sure you have the `ethereum-tests` git submodule, by running: 

```sh
git submodule init
git submodule update
```

This monorepo uses [Lerna](https://lerna.js.org/). It links the local packages together, making development a lot easier.
This monorepo uses Yarn workspaces

TLDR: Setup
```sh
yarn
yarn run build
```

Above is the quickest way to set you up. Going down the road, there are two sets of commands: *project* and *package-specific* commands. You can find them at `./package.json` and `./packages/*/package.json`, respectively. Here's a breakdown:

### Project scripts — run from repository root

#### `yarn`
Installs root and all sub-packages dependencies.

#### `yarn run build`

Builds all monorepo packages by default. If a scope is provided, it will only build that particular package.

Scoped example, that will only build the VM package: 
  yarn run build --scope @ethereumjs/vm


#### `yarn run build:tree -- --scope @ethereumjs/blockchain`

Builds all local packages that the provided package depends on (e.g.: @ethereumjs/blockchain), and builds itself. 

If no scope is provided, `yarn run build:tree`, will build all sub-packages.

#### `npm run clean`

Removes root and packages `node_modules` directories, and other generated files, like `coverage`, `dist` and others. This is useful to run after changing branches, to have a clean slate to work with.

#### `npm run lint` and `npm run lint:fix`

These scripts execute `lint` and `lint:fix` respectively, to all monorepo packages. Worth noting that there is a git hook in place that runs `npm run lint` for every `git push`. This check can be skipped using `git push [command] --no-verify`.

### Package scripts — run from `./packages/<name>`

There's a set of rather standardized commands you will find in each package of this repository.

#### `yarn run build`

Uses TypeScript compiler to build source files. The resulting files can be found at `packages/<name>/dist` and `packages/<name>/dist.browser`.

#### `yarn run coverage`

Runs the command `yarn run test` script, capturing testing coverage information. At the end, it displays a coverage table. Additional reports can be found at `packages/<name>/coverage/`.

#### `yarn run docs:build`

Generates package documentation and saves them to `./packages/<name>/docs`.

#### `yarn run lint`

Checks code style according to the rules defined in [ethereumjs-config](https://github.com/ethereumjs/ethereumjs-config).

#### `yarn run lint:fix`

Fixes code style according to the rules. Differently from `yarn run lint`, this command actually writes to files.

#### `yarn run test`

Runs the package tests. 

_Note that the VM has several test scopes - refer to [packages/vm/package.json](https://github.com/ethereumjs/ethereumjs-vm/blob/master/packages/vm/package.json) for more info._

### Going further

As this project is powered by Lerna, you can install it globally to enjoy lots more options. Refer to [Lerna docs](https://github.com/lerna/lerna/tree/master/commands/run) for additional commands.

- `yarn global add lerna`
- `lerna run`
- `lerna exec`

#### Cleaning `node_modules` and all build and test files

`yarn run clean`

### Testing packages locally on other projects

There are some ways you can link this repository packages to other projects before publishing. You can symlink dependencies with [`yarn link <package>`](https://classic.yarnpkg.com/en/docs/cli/link/), or install packages from the filesystem using [`yarn add file:/path/to/package`](https://classic.yarnpkg.com/en/docs/cli/add/). But they are subject to some externalities and most importantly with how your package manager handles the lifecycle of packages during installs. 

_Note: Git references do not work with monorepo setups out of the box due to the lack of directory traversal on the syntax. E.g.:_

  yarn add git@github.com:ethereumjs/ethereumjs-vm.git

_One way to fetch packages remotely from GitHub before publishing is using [gitpkg.now.sh](https://gitpkg.now.sh/)._

But there's a cleaner way to manage your dependencies using Verdaccio. 

#### Install Verdaccio

Verdaccio is an npm registry and proxy that can be of great help to test packages locally. Check out their [Getting Started guide](https://github.com/verdaccio/verdaccio#get-started).

#### Installs, hoists dependencies and builds packages
yarn

#### Publish monorepo packages to Verdaccio
lerna exec "npm publish --registry http://localhost:4873 --ignore-scripts"

#### Unpublish all monorepo packages from Verdaccio
lerna exec "npm unpublish \$LERNA_PACKAGE_NAME --registry http://localhost:4873 --force"

#### Setup @ethereumjs scope to local Verdaccio server
  npm config set @ethereumjs:registry http://localhost:4873

#### Teardown @ethereumjs scope to local Verdaccio server
  npm config delete @ethereumjs:registry


# EthereumJS

See our organizational [documentation](https://ethereumjs.readthedocs.io) for an introduction to `EthereumJS` as well as information on current standards and best practices.

If you want to join for work or do improvements on the libraries have a look at our [contribution guidelines](https://ethereumjs.readthedocs.io/en/latest/contributing.html).

# LICENSE

[MIT](https://opensource.org/licenses/MIT)

[coverage-badge]: https://codecov.io/gh/ethereumjs/ethereumjs-vm/branch/master/graph/badge.svg
[coverage-link]: https://codecov.io/gh/ethereumjs/ethereumjs-vm
[discord-badge]: https://img.shields.io/static/v1?logo=discord&label=discord&message=Join&color=blue
[discord-link]: https://discord.gg/TNwARpR
[stackexchange-badge]: https://img.shields.io/badge/ethereumjs-stackexchange-brightgreen
[stackexchange-link]: https://ethereum.stackexchange.com/questions/tagged/ethereumjs
[block-package]: ./packages/block
[block-npm-badge]: https://img.shields.io/npm/v/@ethereumjs/block.svg
[block-npm-link]: https://www.npmjs.com/package/@ethereumjs/block
[block-issues-badge]: https://img.shields.io/github/issues/ethereumjs/ethereumjs-vm/package:%20block?label=issues
[block-issues-link]: https://github.com/ethereumjs/ethereumjs-vm/issues?q=is%3Aopen+is%3Aissue+label%3A"package%3A+block"
[block-actions-badge]: https://github.com/ethereumjs/ethereumjs-vm/workflows/Block/badge.svg
[block-actions-link]: https://github.com/ethereumjs/ethereumjs-vm/actions?query=workflow%3A%22Block%22
[block-coverage-badge]: https://codecov.io/gh/ethereumjs/ethereumjs-vm/branch/master/graph/badge.svg?flag=block
[block-coverage-link]: https://codecov.io/gh/ethereumjs/ethereumjs-vm/tree/master/packages/block
[blockchain-package]: ./packages/blockchain
[blockchain-npm-badge]: https://img.shields.io/npm/v/@ethereumjs/blockchain.svg
[blockchain-npm-link]: https://www.npmjs.com/package/@ethereumjs/blockchain
[blockchain-issues-badge]: https://img.shields.io/github/issues/ethereumjs/ethereumjs-vm/package:%20blockchain?label=issues
[blockchain-issues-link]: https://github.com/ethereumjs/ethereumjs-vm/issues?q=is%3Aopen+is%3Aissue+label%3A"package%3A+blockchain"
[blockchain-actions-badge]: https://github.com/ethereumjs/ethereumjs-vm/workflows/Blockchain/badge.svg
[blockchain-actions-link]: https://github.com/ethereumjs/ethereumjs-vm/actions?query=workflow%3A%22Blockchain%22
[blockchain-coverage-badge]: https://codecov.io/gh/ethereumjs/ethereumjs-vm/branch/master/graph/badge.svg?flag=blockchain
[blockchain-coverage-link]: https://codecov.io/gh/ethereumjs/ethereumjs-vm/tree/master/packages/blockchain
[common-package]: ./packages/common
[common-npm-badge]: https://img.shields.io/npm/v/@ethereumjs/common.svg
[common-npm-link]: https://www.npmjs.com/package/@ethereumjs/common
[common-issues-badge]: https://img.shields.io/github/issues/ethereumjs/ethereumjs-vm/package:%20common?label=issues
[common-issues-link]: https://github.com/ethereumjs/ethereumjs-vm/issues?q=is%3Aopen+is%3Aissue+label%3A"package%3A+common"
[common-actions-badge]: https://github.com/ethereumjs/ethereumjs-vm/workflows/Common/badge.svg
[common-actions-link]: https://github.com/ethereumjs/ethereumjs-vm/actions?query=workflow%3A%22Common%22
[common-coverage-badge]: https://codecov.io/gh/ethereumjs/ethereumjs-vm/branch/master/graph/badge.svg?flag=common
[common-coverage-link]: https://codecov.io/gh/ethereumjs/ethereumjs-vm/tree/master/packages/common
[ethash-package]: ./packages/ethash
[ethash-npm-badge]: https://img.shields.io/npm/v/@ethereumjs/ethash.svg
[ethash-npm-link]: https://www.npmjs.org/package/@ethereumjs/ethash
[ethash-issues-badge]: https://img.shields.io/github/issues/ethereumjs/ethereumjs-vm/package:%20ethash?label=issues
[ethash-issues-link]: https://github.com/ethereumjs/ethereumjs-vm/issues?q=is%3Aopen+is%3Aissue+label%3A"package%3A+ethash"
[ethash-actions-badge]: https://github.com/ethereumjs/ethereumjs-vm/workflows/Ethash/badge.svg
[ethash-actions-link]: https://github.com/ethereumjs/ethereumjs-vm/actions?query=workflow%3A%22Ethash%22
[ethash-coverage-badge]: https://codecov.io/gh/ethereumjs/ethereumjs-vm/branch/master/graph/badge.svg?flag=ethash
[ethash-coverage-link]: https://codecov.io/gh/ethereumjs/ethereumjs-vm/tree/master/packages/ethash
[tx-package]: ./packages/tx
[tx-npm-badge]: https://img.shields.io/npm/v/@ethereumjs/tx.svg
[tx-npm-link]: https://www.npmjs.com/package/@ethereumjs/tx
[tx-issues-badge]: https://img.shields.io/github/issues/ethereumjs/ethereumjs-vm/package:%20tx?label=issues
[tx-issues-link]: https://github.com/ethereumjs/ethereumjs-vm/issues?q=is%3Aopen+is%3Aissue+label%3A"package%3A+tx"
[tx-actions-badge]: https://github.com/ethereumjs/ethereumjs-vm/workflows/Tx/badge.svg
[tx-actions-link]: https://github.com/ethereumjs/ethereumjs-vm/actions?query=workflow%3A%22Tx%22
[tx-coverage-badge]: https://codecov.io/gh/ethereumjs/ethereumjs-vm/branch/master/graph/badge.svg?flag=tx
[tx-coverage-link]: https://codecov.io/gh/ethereumjs/ethereumjs-vm/tree/master/packages/tx
[vm-package]: ./packages/vm
[vm-npm-badge]: https://img.shields.io/npm/v/@ethereumjs/vm.svg
[vm-npm-link]: https://www.npmjs.com/package/@ethereumjs/vm
[vm-issues-badge]: https://img.shields.io/github/issues/ethereumjs/ethereumjs-vm/package:%20vm?label=issues
[vm-issues-link]: https://github.com/ethereumjs/ethereumjs-vm/issues?q=is%3Aopen+is%3Aissue+label%3A"package%3A+vm"
[vm-actions-badge]: https://github.com/ethereumjs/ethereumjs-vm/workflows/VM/badge.svg
[vm-actions-link]: https://github.com/ethereumjs/ethereumjs-vm/actions?query=workflow%3A%22VM%22
[vm-coverage-badge]: https://codecov.io/gh/ethereumjs/ethereumjs-vm/branch/master/graph/badge.svg?flag=vm
[vm-coverage-link]: https://codecov.io/gh/ethereumjs/ethereumjs-vm/tree/master/packages/vm
