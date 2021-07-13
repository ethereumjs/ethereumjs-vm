/*
  This script injects the `resolutions.json` file created by the e2e-resolutions.js script into each package json in the hardhat monorepo.
 */

  const fs = require("fs");
  const packages = fs.readdirSync('hardhat/packages');
  
  let packageJson;
  let resolutions = require(`${process.cwd()}/resolutions.json`);

  for (package of packages){
    try {
      packageJson = require(`${process.cwd()}/hardhat/packages/${package}/package.json`);
      const newPackageJson = {...packageJson, resolutions: {...resolutions}}
      fs.writeFileSync(`${process.cwd()}/hardhat/packages/${package}/package.json`, JSON.stringify(newPackageJson, null, 2));
    } catch(e){
      console.log(e)
    }
  }
  packageJson = require(`${process.cwd()}/hardhat/package.json`);
  const newPackageJson = {...packageJson, resolutions: {...resolutions}}
  fs.writeFileSync(`${process.cwd()}/hardhat/package.json`, JSON.stringify(newPackageJson, null, 2));