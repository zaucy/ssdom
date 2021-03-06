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
  .option("-p, --port <number>")
  .option("--background", "Run as background process")
  .arguments("<html-path>")
  .parse(process.argv);

var port = parseInt(commander.port) || 80;
var htmlPath = commander.args[0];
ssdom(htmlPath).listen(port);
