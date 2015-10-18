#!/usr/bin/env node

"use strict";

// Built-in Modules
var fs = require("fs")
  , child_process = require("child_process")

// External Modules
  , commander = require("commander")

// Local Modules
  , ssdom = require(__dirname + "/ssdom.js")

// End of Modules
;

commander
  .version(JSON.parse(fs.readFileSync(__dirname + "/../package.json")).version)
  .option("-p, --port <number>", "Port to use. Default is 80.")
  .option("--background", "Run as background process")
  .arguments("<html-path>")
  .parse(process.argv);

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
  var port = parseInt(commander.port) || 80;
  var htmlPath = commander.args[0];
  ssdom(htmlPath).listen(port);
}
