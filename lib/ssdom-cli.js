#!/usr/bin/env node

"use strict";

// Built-in Modules
var fs = require("fs")
  , child_process = require("child_process")

// External Modules
  , commander = require("commander")

// Local Modules
  , ssdom = require(__dirname + "/ssdom.js")
  , defaultConfig = require(__dirname + "/default-config.js")

// End of Modules
;

commander
  .arguments("<path-string>", "Path string to a directory, html file, or JSON config file. The path string may include {HOSTNAME} which will be replaced by the requesting hostname.")
  .version(JSON.parse(fs.readFileSync(__dirname + "/../package.json")).version)
  .option("-p, --port <number>", "Port to use. Default is 80.")
  .option("--background", "Run as background process.")
  .option("--config <path>", "Path to config file. Use --print-default-config to see default values.")
  .option("--private-dir <path>", "Set the private directory. This overrides any config.")
  .option("--public-dir <path>", "Set the public directory. This overrides any config.")
  .option("--print-default-config", "Prints the default config values.")
  .parse(process.argv);

function print(name, value) {
  if(typeof value == "string" || typeof value == "number") {
    console.log(name + " = " + value);
  } else
  if(Array.isArray(value)) {
    console.log(name + " = " + JSON.stringify(value));
  } else
  if(typeof value == "object") {
    console.log(name + ":");
    for(var objPropName in value) {
      print("  " + objPropName, value[objPropName]);
    }
  }
}

if(commander.printDefaultConfig) {

  for(var configPropName in defaultConfig) {
    var configPropValue = defaultConfig[configPropName];
    print(configPropName, configPropValue);
  }

  process.exit(0);
}

if(commander.background) {
  var bkgProcArgs = process.argv;
  bkgProcArgs.shift();
  bkgProcArgs.shift();
  bkgProcArgs = [`${__dirname}/ssdom-bkg.js`].concat(bkgProcArgs);

  child_process.spawn("node", bkgProcArgs, {
    stdio: 'ignore',
    detached: true
  }).unref();

  process.exit(0);
} else {
  var pathString = commander.args[0];
  var port = parseInt(commander.port) || 80;

  ssdom(pathString).listen(port);
}
