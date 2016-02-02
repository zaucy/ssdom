"use strict";

const
// Builtin Modules
    path           = require("path")
  , url            = require("url")
  , http           = require("http")
  , fs             = require("fs")
  , child_process  = require("child_process")

// External Modules
  , jsdom    = require("jsdom")

// Local Modules
  , Session = require("./classes/session.js")
  , defaultConfig = require("./default-config.js")

// End of Modules
;

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
    this._htmlPathString = options.main || defaultConfig.main;
    this._extensions = options.extensions || defaultConfig.extensions;

    this.initExtensions();

    this._httpServer = http.createServer(function(req, res) {
      self._handleHttpRequest(req, res);
    });

  }

  initExtensions() {
    for(let i=0; this._extensions.length > i; i++) {
      this.initExtension(this._extensions[i]);
    }
  }

  extAll_preServe(session) {
    for(let i=0; this._extensions.length > i; i++) {
      this.ext_preServe(this._extensions[i], session);
    }
  }

  extAll_postServe(session) {
    for(let i=0; this._extensions.length > i; i++) {
      this.ext_postServe(this._extensions[i], session);
    }
  }

  ext_preServe(extension, session) {
    var extensionName = `ssdom-ext-${extension}`;
    var extensionModule(extensionName);

    if(extensionModule.preServe) {
      extensionModule.preServe(session);
    }
  }

  ext_postServe(extension, session) {
    var extensionName = `ssdom-ext-${extension}`;
    var extensionModule(extensionName);

    if(extensionModule.postServe) {
      extensionModule.postServe(session);
    }
  }

  initExtension(extension) {
    var extensionName = `ssdom-ext-${extension}`;
    var extResolved = require.resolve(extensionName);
    if(!extResolved) {
      child_process.execSync(`npm install ${extensionName}`);
    }

    var extensionModule = require(extensionName);
    if(extensionModule.initialize) {
      extensionModule.initialize(this);
    }
  }

  gethtmlPathString(hostname) {
    var str = this._htmlPathString;
    str = str.replace(/\{\w*HOSTNAME\w*\}/, hostname);

    str = path.resolve(str);
    return str;
  }

  _handleHttpRequest(req, res) {
    var hostname = req.headers.host;
    if(!hostname) {
      res.end();
      return;
    }
    var colonIndex = hostname.indexOf(":");
    if(colonIndex > -1) {
      hostname = hostname.substr(0, colonIndex);
    }

    if(req.method == "post" && req.url.beginsWith("")) {

    }

    var session = new Session(this.gethtmlPathString(hostname), req, res);
    this.extAll_preServe(session);
    session.serve(function() {
      this.extAll_postServe(session);
    }.bind(this));
  }

  listen() {
    return this._httpServer.listen.apply(this._httpServer, arguments);
  }
}

module.exports = function ssdom(options) {
  var config = defaultConfig;

  if(typeof options == "string") {
    config.main = options;
  } else
  if(typeof options == "object") {
    for(var propName in options) {
      var propValue = options[propName];

      if(!defaultConfig.hasOwnProperty(propName)) {
        console.log("Invalid config property '%s' ignoring.", propName);
      }

      config[propName] = propValue;
    }
  }

  return new ServerSideDOM(config);
};
