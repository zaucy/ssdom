#!/usr/bin/env iojs

"use strict";

// Built-in Modules
var fs = require("fs")

// External Modules
  , commander = require("commander")

// Local Modules
  , ssdom = require(__dirname + "/ssdom.js")

// End of Modules
;

commander
  .version(JSON.parse(fs.readFileSync(__dirname + "/../package.json")).version)
  .option("-p, --port <number>")
  .arguments("<html-path>")
  .parse(process.argv);

var port = parseInt(commander.port) || 80;
var htmlPath = commander.args[0];
ssdom(htmlPath).listen(port);
console.log(htmlPath);
