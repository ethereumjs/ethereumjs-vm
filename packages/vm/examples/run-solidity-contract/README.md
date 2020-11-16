# Running a Solidity smart contract using ethereumjs-vm

This directory contains an example on how to run smart contracts written in Solidity.

The example does these things:

1. Compiles the contract `contracts/Greeter.sol`
1. Instantiates a VM
1. Creates an account
1. Funds the account with 1 ETH
1. Deploys the Greeter contract
1. Calls a constant function
1. Sends a transaction to the contract, modifying its state
1. Calls a constant function to verify the state change

## Installation

1. Run `npm install` in the root of this project
1. Run `npm install` in this directory

## Running the example

1. Run `yarn run build:dist` in the root of this project
1. Run `yarn run example` in this directory
