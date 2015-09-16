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
const defaultConfig = JSON.parse(fs.readFileSync(__dirname + "/default-config.json"));

const ssdomVirtualConsole = jsdom.createVirtualConsole().sendTo(console);
ssdomVirtualConsole.on("jsdomError", function(error) {
  const errString = error.stack.toString();
  // Ignore error about navigation not implemented in jsdom.
  // We interrupt this and handle it with ssdom anyways.
  // @HACK - Hack note, because this is pretty hacky.
  if(errString.startsWith("Error: Not implemented: navigation via the location interface")) {
    return;
  }

  console.error(error.stack, error.detail);
});

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

    new ServerSideDOMRequestHandler(this.gethtmlPathString(hostname), req, res);
  }

  listen() {
    return this._httpServer.listen.apply(this._httpServer, arguments);
  }
}

class ServerSideDOMRequestHandler {

  constructor(htmlPathname, request, response) {
    var self = this;

    this.request = request;
    this.response = response;

    this._cachedContent = {};
    this._cachedData = {};

    this.document = null;
    this.window = null;
    this.baseDir = path.isAbsolute(htmlPathname) ?
      path.dirname(htmlPathname) : path.dirname(path.resolve(htmlPathname));

    if(this.baseDir == htmlPathname) {

    }

    if(!this.servePublic()) {
      fs.readFile(htmlPathname, function(err, data) {
        self.loadMarkup(data);
      });
    }
  }

  get protocol() {
    return "http://";
  }

  get hostname() {
    return this.request.headers.host;
  }

  get url() {
    return this.request.url;
  }

  get publicDir() {
    return path.resolve(this.baseDir, defaultConfig.paths.public);
  }

  get privateDir() {
    return path.resolve(this.baseDir, "./private");
  }

  get contentDir() {
    return path.resolve(this.baseDir, defaultConfig.paths.content);
  }

  get dataDir() {
    return path.resolve(this.baseDir, defaultConfig.paths.data);
  }

  get scriptsDir() {
    return path.resolve(this.baseDir, defaultConfig.paths.scripts);
  }

  get served() {
    return this._served === true;
  }

  clensePathname(pathname) {

    if(pathname[0] != "/") {
      let winPathname = this.window.location.pathname;
      pathname = path.dirname(winPathname) + "/" + pathname;
    }

    pathname = pathname.replace(/(\.\.)|\~/g, "");
    pathname = pathname.replace(/\/\//g, "");

    return pathname;
  }

  fullContentPathname(pathname) {
    var fullPathname = this.contentDir + pathname;
    if(fullPathname.substr(-1) == "/") {
      fullPathname += "index.html";
    } else
    if(path.extname(fullPathname) == "") {
      fullPathname += ".html";
    }

    return fullPathname;
  }

  loadContent(pathname, cloned) {

    var pathname = this.clensePathname(pathname);
    var fullPathname = this.fullContentPathname(pathname);

    if(typeof cloned !== "boolean") {
      cloned = false;
    }

    if(typeof this._cachedContent[pathname] == "undefined") {
      let data = null;
      try {
        data = fs.readFileSync(fullPathname);
      } catch(err) {
        console.log("[ssdom: loadContent()] Could not load '%s'", pathname);
        return null;
      }
      var wrapEl = this.document.createElement("ssdom-content-root");
      wrapEl.setAttribute("data-content-pathname", pathname);
      wrapEl.innerHTML = data.toString();

      const originalQuerySelectorAll = wrapEl.querySelectorAll;
      const originalQuerySelector = wrapEl.querySelectorAll;
      wrapEl.querySelectorAll = function() {
        arguments[0] = arguments[0].replace(":root", "ssdom-content-root");
        return originalQuerySelectorAll.apply(this, arguments);
      };

      wrapEl.querySelector = function() {
        arguments[0] = arguments[0].replace(":root", "ssdom-content-root");
        return originalQuerySelector.apply(this, arguments);
      };

      this._cachedContent[pathname] = wrapEl;
    }

    return cloned ? this._cachedContent[pathname].cloneNode(true) : this._cachedContent[pathname];
  }

  loadData(pathname, copied) {

    var pathname = this.clensePathname(pathname);
    var copied = typeof copied == "boolean" ? copied : false;

    if(typeof this._cachedData[pathname] == "undefined") {
      let data = fs.readFileSync(this.dataDir + pathname);
      this._cachedData[pathname] = JSON.parse(data);
    }

    return copied ? JSON.parse(JSON.stringify(this._cachedData[pathname])) : this._cachedData[pathname];
  }

  loadScriptSource(pathname) {
    var pathname = this.clensePathname(pathname);
    var data = "";
    try {
      data = fs.readFileSync(this.scriptsDir + pathname);
    } catch(err) {
      try { data = fs.readFileSync(this.publicDir + pathname); } catch(err) { }
    }

    return data;
  }

  loadMarkup(markup) {
    var self = this;

    var doc = jsdom.jsdom(markup, {
      url: this.protocol + this.hostname + this.url,
      resourceLoader: function(resource, callback) { self.loadResource(resource, callback); },
      features: {
        FetchExternalResources: ["script"],
        ProcessExternalResources: ["script"],
        SkipExternalResources: false
      },
      created: function(err, window) {
        require(__dirname + "/location-override.js")(window);
        self.document = window.document;
        self.window = window;
        window.loadContent = self.loadContent.bind(self);
        window.loadData = self.loadData.bind(self);
        window.changeLocation = self.changeLocation.bind(self);
      },
      virtualConsole: ssdomVirtualConsole
    });

    this.processScripts();
    this.registerEvents();
    this.serveDocument();

  }

  registerEvents() {
    var eventElements = this.document.querySelectorAll("*[data-ssdom]");
    var scriptEl = this.document.createElement("script");
    this.document.body.appendChild(scriptEl);

    scriptEl.textContent =
`(function() {
var els=document.querySelectorAll("*[data-ssdom]");
function parseList(str) {
  var items = str.split("&");
  var list = {};
  for(var i=0; items.length > i; i++) {
    var item = items[i];
    var keyAndVal = item.split("=");
    if(keyAndVal.length < 2) continue;

    var key = keyAndVal[0];
    var val = keyAndVal[1];

    list[key] = val.split(",");
  }
}
function sendSsdomEvent(ev, ids) {

}
for(var i=0; els.length > i; i++) {
  var el = els[i];
  var list = parseList(el.getAttribute("data-ssdom"));
  for(var key in list) {
  (function() {
    var key = key;
    el.addEventListener(key, function(e) {
      e.preventDefault();
      sendSsdomEvent(key, list[key]);
    });
  }());
  }
}
}());`;

    for(let i=0; eventElements.length > i; i++) {
      let eventElement = eventElements[i];
      let eventList = parseList(eventElement.getAttribute("data-ssdom"));

      for(let eventName in eventList) {
        for(let evIdIndex in eventList[eventName]) {
          let evId = eventList[eventName][evIdIndex];

        }
      }
    }
  }

  existsPublically(url) {
    url = url || this.url;
    var filePath = this.publicDir + url;

    try { fs.accessSync(filePath, fs.R_OK); }
    catch(err) { return false; }

    return true;
  }

  // Once this get's called the response is sent to the client.
  servePublic() {
    this._served = true;
    var filePath = this.publicDir + this.url;

    try {
      var stat = fs.statSync(filePath);
    } catch(err) { return false; }

    if(!stat || stat.isDirectory()) {
      return false;
    }

    this.response.writeHead(200, {
      "Content-Type": mime.lookup(filePath)
    });

    var readable = fs.createReadStream(filePath);
    readable.pipe(this.response);

    return true;
  }

  // Once this get's called the response is sent to the client.
  serveDocument() {
    this._served = true;

    if(this._changedLocation) {
      this.response.writeHead(302, {
        "Location": this._changedLocation
      });

      this.response.end();
    } else {

      var html = jsdom.serializeDocument(this.document);

      this.response.writeHead(200, {
        "Content-Type": "text/html",
        "Content-Length": html.length
      });

      this.response.end(html);
    }

    return true;
  }

  changeLocation(newLocation) {
    this._changedLocation = newLocation;
  }

  getPrivateResource(pathname) {
    if(path.isAbsolute(pathname)) {
      pathname = this.privateDir + pathname;
    } else {
      pathname = path.resolve(this.privateDir, path.dirname(this.url), pathname);
    }

    return fs.readFileSync(pathname);
  }

  processServerScriptSource(source) {
    return UglifyJS.minify(source, {
      fromString: true,
      evaluate: true,
      dead_code: true,
      define: {
        SERVER: true
      }
    }).code;
  }

  processScripts() {
    var scriptElements = this.document.getElementsByTagName("script");
    for(var i=0; scriptElements.length > i; i++) {
      var scriptEl = scriptElements[i];
      var context = scriptEl.getAttribute("context") || "client-only";

      if(context == "server-only") {
        scriptEl.parentElement.removeChild(scriptEl);
      } else
      if(context == "server") {
        var scriptSrc = "";
        if(scriptEl.hasAttribute("src")) {
          scriptSrc = this.loadScriptSource(scriptEl.getAttribute("src"));
          scriptEl.removeAttribute("src");
        } else {
          scriptSrc = scriptEl.textContent;
        }

        if(scriptEl.textContent == "") {
          scriptEl.parentElement.removeChild(scriptEl);
        }
      }

      scriptEl.removeAttribute("context");
    }
  }



  loadResource(resource, callback) {
    var pathname = resource.url.pathname;
    var context = resource.element.getAttribute("context") || "client-only";
    context = context.toLowerCase();

    var src = this.loadScriptSource(pathname);

    if(context == "server-only") {

    } else
    if(context == "server") {

    }

    callback(null, src);
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
