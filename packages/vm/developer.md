# Developer Documentation

## TESTING

### Running Tests

Tests can be found in the `tests` directory. There are test runners for [State tests](http://www.ethdocs.org/en/latest/contracts-and-transactions/ethereum-tests/state_tests/index.html) and [Blockchain tests](http://www.ethdocs.org/en/latest/contracts-and-transactions/ethereum-tests/blockchain_tests/index.html). VM tests are disabled since Frontier gas costs are not supported any more. Tests are then executed by the [ethereumjs-testing](https://github.com/ethereumjs/ethereumjs-testing) utility library using the official client-independent [Ethereum tests](https://github.com/ethereum/tests).

For a wider picture about how to use tests to implement EIPs you can have a look at this [Reddit post](https://www.reddit.com/r/ethereum/comments/6kc5g3/ethereumjs_team_is_seeking_contributors/)
or the associated YouTube video introduction to [Core Development with Ethereumjs-vm](https://www.youtube.com/watch?v=L0BVDl6HZzk).

#### Running different Test Types

Running the State tests:

`ts-node ./tests/tester --state`

Running the Blockchain tests:

`ts-node ./tests/tester --blockchain`

Tests run against source by default. They can be run with the `--dist` flag:

`yarn run build:dist && node ./tests/tester --state --dist`

See `package.json` for all the scripts in the `test:` namespace, such as `yarn run test:state` which would execute the above.

Use `--fork` to pass in the desired hardfork:

`ts-node ./tests/tester --state --fork='Constantinople'`

or

`yarn run test:state --fork='Constantinople'`

By default it is set to use the latest hardfork (`FORK_CONFIG` in `tests/tester.js`).

State tests run significantly faster than Blockchain tests, so it is often a good choice to start fixing State tests.

#### Running Specific Tests

Running all the blockchain tests in a file:

`ts-node ./tests/tester --blockchain --file='randomStatetest303'`

Running tests from a specific directory:

`ts-node ./tests/tester --blockchain --dir='bcBlockGasLimitTest'`

Running a specific state test case:

`ts-node ./tests/tester --state --test='stackOverflow'`

Only run test cases with selected `data`, `gas` and/or `value` values (see
[attribute description](http://ethereum-tests.readthedocs.io/en/latest/test_types/state_tests.html) in
test docs), provided by the index of the array element in the test `transaction` section:

`ts-node ./tests/tester --state --test='CreateCollisionToEmpty' --data=0 --gas=1 --value=0`

Run a state test from a specified source file not under the `tests` directory:
`ts-node ./tests/tester --state --customStateTest='{path_to_file}'`

#### Running tests with a reporter/formatter

`yarn run formatTest -t [npm script name OR node command]` will pipe to `tap-spec` by default.

To pipe the results of the API tests through `tap-spec`:

`yarn run formatTest -- -t test:API`

To pipe the results of tests run with a node command through `tap-spec`:

`yarn run formatTest -- -t "./tests/tester --blockchain --dir='bcBlockGasLimitTest'"`

The `-with` flag allows the specification of a formatter of your choosing:

`npm install -g tap-mocha-reporter`
`yarn run formatTest -- -t test:API -with 'tap-mocha-reporter json'`

#### Skipping Tests

There are three types of skip lists (`BROKEN`, `PERMANENT` and `SLOW`) which
can be found in `tests/tester.js`. By default tests from all skip lists are omitted.

You can change this behaviour with:

`ts-node ./tests/tester --state --skip=BROKEN,PERMANENT`

to skip only the `BROKEN` and `PERMANENT` tests and include the `SLOW` tests.
There are also the keywords `NONE` or `ALL` for convenience.

It is also possible to only run the tests from the skip lists:

`ts-node ./tests/tester --state --runSkipped=SLOW`

### CI Test Integration

Tests and checks are run in CI using [Github Actions](https://github.com/ethereumjs/ethereumjs-vm/actions). The configuration can be found in `.github/workflows`.

### Debugging

#### Local Debugging

For state tests you can use the `--jsontrace` flag to output opcode trace information.

Blockchain tests support `--debug` to verify the postState:

`ts-node ./tests/tester --blockchain --debug --test='ZeroValue_SELFDESTRUCT_ToOneStorageKey_OOGRevert_d0g0v0_EIP158'`

All/most State tests are replicated as Blockchain tests in a `GeneralStateTests` [sub directory](https://github.com/ethereum/tests/tree/develop/BlockchainTests/GeneralStateTests) in the Ethereum tests repo, so for debugging single test cases the Blockchain test version of the State test can be used.

#### Comparing Stack Traces

Other client implementations often also provide functionality for output trace information.

A convenient way is to use a local `geth` installation (can be the binary installation and doesn't has to be build from source or something) and then use the included `evm` tool like:

```shell
evm --json --nomemory statetest node_modules/ethereumjs-testing/tests/GeneralStateTests/stCreate2/create2collisionCode2.json
```

If you want to have only the output for a specific fork you can go into the referenced json test file and temporarily delete the `post` section for the non-desired fork outputs (or, more safe and also more convenient on triggering later: copy the test files you are interested in to your working directory and then modify without further worrying).

#### Debugging Tools

For comparing `EVM` traces [here](https://gist.github.com/cdetrio/41172f374ae32047a6c9e97fa9d09ad0) are some instructions for setting up `pyethereum` to generate corresponding traces for state tests.

Compare TAP output from blockchain/state tests and produces concise diff of the differences between them (example):

```
curl https://gist.githubusercontent.com/jwasinger/6cef66711b5e0787667ceb3db6bea0dc/raw/0740f03b4ce90d0955d5aba1e0c30ce698c7145a/gistfile1.txt > output-wip-byzantium.txt
curl https://gist.githubusercontent.com/jwasinger/e7004e82426ff0a7137a88d273f11819/raw/66fbd58722747ebe4f7006cee59bbe22461df8eb/gistfile1.txt > output-master.txt
python utils/diffTestOutput.py output-wip-byzantium.txt output-master.txt
```

An extremely rich and powerful toolbox is the [evmlab](https://github.com/holiman/evmlab) from `holiman`, both for debugging and creating new test cases or example data.

## Profiling

[Clinic](https://github.com/nearform/node-clinic) allows profiling the VM in the node environment. It supports various profiling methods, among them is [flame](https://github.com/nearform/node-clinic-flame) which can be used for generating flamegraphs to highlight bottlenecks and hot paths. As an example, to generate a flamegraph for the VM blockchain tests, you can run:

```sh
NODE_OPTIONS="--max-old-space-size=4096" clinic flame -- node ./tests/tester.js --blockchain --excludeDir='GeneralStateTests'
```

## Benchmarks

This helps us see how the VM performs when running mainnet blocks.

View the historical benchmark data for the master branch on the [github page](http://ethereumjs.github.io/ethereumjs-vm/dev/bench/).

We want to use the compiled JS so `ts-node` does not show up in the profile. So run:

`yarn run build:benchmarks`

Then:

`yarn run benchmarks`

To define the number of samples to be run pass in a number like so: `yarn run benchmarks -- 10`

If you want to get a more detailed look to find bottlenecks we can use [0x](https://github.com/davidmarkclements/0x).

So run:

```
npm i -g 0x
0x scripts/benchmarks/mainnetBlocks.js scripts/benchmarks/fixture/blocks-prestate.json
```

and open the link it generates.

For a high-level introduction on flame graphs see e.g. [this](https://blog.codecentric.de/en/2017/09/jvm-fire-using-flame-graphs-analyse-performance/) blog article (the non-Java part).
