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

    if(options.config) {
      this.loadConfig(options.config);
    }

    this._htmlPathString = this._htmlPathString || options.main || defaultConfig.main;
    this._extensions = this._extensions || options.extensions || defaultConfig.extensions;
    this._paths = {};

    for(var pathName in defaultConfig.paths) {
      this._paths[pathName] = options.paths[pathName] || defaultConfig.paths[pathName];
    }

    this.extensions = {

    };

    this.initExtensions();

    this._httpServer = http.createServer(function(req, res) {
      self._handleHttpRequest(req, res);
    });

  }

  loadConfig(configPath) {
    if(configPath.search(/\{(.*)\}/) == -1) {
      if(fs.statSync(configPath).isFile()) {
        var configDataStr = fs.readFileSync(configPath);
        var configData = JSON.parse(configDataStr.toString());
        if(configData.main) this._htmlPathString = configData.main;
        if(configData.extensions) this._extensions = configData.extensions;
        if(configData.paths) this.paths = configData.paths;
      }
    }
  }

  initExtensions() {
    for(let i=0; this._extensions.length > i; i++) {
      this.initExtension(this._extensions[i]);
    }
  }

  callExtensionFunction() {
    var funcName = arguments[0];
    var funcArguments = [];
    for(let n=1; arguments.length > n; n++) {
      funcArguments.push(arguments[n]);
    }

    for(let i=0; this._extensions.length > i; i++) {
      let extensionName = this._extensions[i];
      let extensionModule = this.getExtensionModule(extensionName);

      if(typeof extensionModule[funcName] === "function") {
        try {
          extensionModule[funcName].apply(extensionModule, funcArguments);
        } catch(err) {
          console.log("[ssdom extension_uncaught_exception] " + extensionName);
          console.log(err);
        }
      }
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
    var extensionModule = this.getExtensionModule(extension);

    if(extensionModule.preServe) {
      extensionModule.preServe(session);
    }
  }

  ext_postServe(extension, session) {
    var extensionModule = this.getExtensionModule(extension);

    if(extensionModule.postServe) {
      extensionModule.postServe(session);
    }
  }

  getExtensionModule(extension) {
    if(extension.substr(-3) == ".js") {
      var extensionModule = require(path.resolve(extension));
    } else {
      var extensionName = `ssdom-ext-${extension}`;
      var extensionPath = process.cwd() + "/node_modules/" + extensionName;

      try {
        var extensionModule = require(extensionPath);
      } catch(err) {
        console.log(`[ssdom] Installing extension '${extension}' ...`);
        child_process.execSync(`npm install ${extensionName}`);
        var extensionModule = require(extensionPath);
      }
    }

    return extensionModule;
  }

  initExtension(extension) {

    var extensionModule = this.getExtensionModule(extension);

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

  getSessionConfig(hostname) {
    var str = this._htmlPathString;
    str = str.replace(/\{\w*HOSTNAME\w*\}/, hostname);
    var extname = str.substr(str.lastIndexOf("."));
    var sessionConfig = {};

    if(extname == ".json") {

    } else
    if(extname == ".html" || extname == ".htm") {

    }
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

    var session = new Session({
      htmlPath: this.gethtmlPathString(hostname),
      paths: this._paths,
      ssdom: this
    }, req, res);

    this.callExtensionFunction("preServe", session);

    session.serve(function() {
      this.callExtensionFunction("postServe", session);
    }.bind(this));
  }

  listen() {
    return this._httpServer.listen.apply(this._httpServer, arguments);
  }
}

module.exports = function ssdom(options) {
  var config = defaultConfig;

  if(typeof options == "string") {

    if(options[options.length-1] == "/" || options[options.length-1] == "\\") {
      config.main = options + defaultConfig.main;
      config.config = options + defaultConfig.config;
    } else {
      var extname = options.substr(options.lastIndexOf("."));
      if(extname) {
        if(extname == ".json") {
          config.config = options;
        } else
        if(extname == ".html" || extname == ".htm") {
          config.main = options;
        } else {
          // unsupported extname
          // maybe allow extensions to hook here?
          // for other languages such as Jade?
        }
      }
    }
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
