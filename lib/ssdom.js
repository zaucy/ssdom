"use strict";

// Builtin Modules
var fs      = require("fs")
  , path    = require("path")
  , events  = require("events")
  , url     = require("url")
  , http    = require("http")

// External modules
  , mime     = require("mime")
  , jsdom    = require("jsdom")
  , UglifyJS = require("uglify-js")

// End of Modules
;

// TODO: Use defaultConfig for paths and main html file.
var defaultConfig = require("./default-config.js");
var Session = require("./classes/session.js");

function parseList(str) {
  var items = str.split("&");
  var list = {};
  for(let i=0; items.length > i; i++) {
    let item = items[i];
    let keyAndVal = item.split("=");
    if(keyAndVal.length < 2) continue;

    let key = keyAndVal[0];
    let val = keyAndVal[1];

    list[key] = val.split(",");
  }
}

function stringifyList(list) {
  var str = "";
  for(var key in list) {
    str += key + "=" + list[key].join(",") + "&";
  }

  return str.substr(0, str.length-1);
}

// Redefine addEventListener for ssdom
(function() {
  var doc = jsdom.jsdom();
  var win = doc.defaultView;

  var elementAddEventListener = win.Element.prototype.addEventListener;

  win.Element.prototype.addEventListener = function(type, callback) {
    if(!type.startsWith("DOM")) {
      var ssdomAttribute = this.getAttribute("data-ssdom");
      var list = {};
      var evId = Math.round(Math.random() * 10000);
      if(ssdomAttribute) {
        list = parseList(ssdomAttribute);
      }

      if(typeof list[type] == "undefined") {
        list[type] = [];
      }

      list[type].push(evId);

      this.setAttribute("data-ssdom", stringifyList(list));
    }

    return elementAddEventListener.apply(this, arguments);
  };

}());

class ServerSideDOM {

  constructor(options) {
    var self = this;
    this._htmlPathString = options.htmlPathString || defaultConfig.main;

    this._httpServer = http.createServer(function(req, res) {
      self._handleHttpRequest(req, res);
    });

  }

  gethtmlPathString(hostname) {
    var str = this._htmlPathString;
    str = str.replace(/\{\w*HOSTNAME\w*\}/, hostname);

    str = path.resolve(str);
    return str;
  }

  _handleHttpRequest(req, res) {
    var hostname = req.headers.host;
    var colonIndex = hostname.indexOf(":");
    if(colonIndex > -1) {
      hostname = hostname.substr(0, colonIndex);
    }

    if(req.method == "post" && req.url.beginsWith("")) {

    }

    new Session(this.gethtmlPathString(hostname), req, res);
  }

  listen() {
    return this._httpServer.listen.apply(this._httpServer, arguments);
  }
}

module.exports = function ssdom(options) {
  var mainHtmlPathname = "main.html";

  if(typeof options == "string") {
    mainHtmlPathname = options;
  } else
  if(typeof options == "object") {

  }

  return new ServerSideDOM({
    htmlPathString: mainHtmlPathname
  });
};
