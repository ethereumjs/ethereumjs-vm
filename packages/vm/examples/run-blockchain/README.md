# Run Blockchain example

This directory contains an example on how to run a blockchain.

The example does these things:

1. Instantiates a VM and a Blockchain
1. Creates the accounts from `./test-data.json`'s `pre`
1. Creates a genesis block
1. Puts the blocks from `./test-data.json`'s `blocks` into the Blockchain
1. Runs the Blockchain on the VM.

## Installation

1. Run `npm install` in the root of this project

## Running the example

1. Run `yarn run build:dist` in the root of this project
1. Run `yarn run example` in this directory
