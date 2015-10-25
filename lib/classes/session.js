"use strict";

var
// Builtin Modules
    fs      = require("fs")
  , path    = require("path")
  , events  = require("events")
  , url     = require("url")
  , http    = require("http")

// External Modules
  , mime     = require("mime")
  , jsdom    = require("jsdom")
  , UglifyJS = require("uglify-js")

// Local Modules
  , DOMSession    = require("./dom-session.js")
  , defaultConfig = require("./../default-config.js")

// End of Modules
;

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

const RegisterEventsInlineScript =
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

class Session {

    constructor(htmlPathname, request, response) {
      this._domSession = new DOMSession(this);
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

    maintainSession() {

    }

    destroySession() {

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

      var asterisk = pathname.indexOf("*");
      if(asterisk > -1) {
        var dirname = pathname.substr(0, asterisk);
        var extname = pathname.substr(asterisk+1);

        var absDirname = dirname;
        if(absDirname[0] == '/' || absDirname[1] == '\\') {
          absDirname = '.' + absDirname;
        } else {
          absDirname = path.normalize(location.pathname + '/' + absDirname);
        }
        absDirname = path.resolve(this.dataDir, absDirname);

        var files = fs.readdirSync(absDirname);

        var multiData = { };

        for(var i=0; files.length > i; i++) {
          var file = files[i];
          if(extname && !file.endsWith(extname)) continue;
          if(!fs.statSync(absDirname + "/" + file).isFile()) continue;
          var filename = file;
          if(extname) {
            filename = filename.substr(0, filename.lastIndexOf(extname));
          }

          var partData = this.loadData(dirname + file, copied);
          if(partData) {
            multiData[filename] = partData;
          }
        }

        return multiData;
      }

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

        try { data = fs.readFileSync(this.publicDir + pathname); } catch(err2) {
          console.log(`[ssdom: loadScriptSource()] Could not find file named '${pathname}' in scriptsDir '${this.scriptsDir}' or publicDir '${this.publicDir}'. `);
        }
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
          require(__dirname + "/../location-override.js")(window);
          self.document = window.document;
          self.window = window;
          window.ssdom = self._domSession;

          self._domSession.emit("request", null);

          window.loadContent = function() {
            console.warn("[ssdom] window.loadContent() is deprecated please use ssdom.loadContent() instead.");
            window.loadContent = window.ssdom.loadContent.bind(this);
            return window.ssdom.loadContent.apply(this, arguments);
          }.bind(self);

          window.loadData = function() {
            console.warn("[ssdom] window.loadData() is deprecated please use ssdom.loadData() instead.");
            window.loadData = window.ssdom.loadData.bind(this);
            return window.ssdom.loadData.apply(this, arguments);
          }.bind(self);

          window.changeLocation = function() {
            console.warn("[ssdom] window.changeLocation() is deprecated please use ssdom.changeLocation() instead.");
            window.changeLocation = window.ssdom.changeLocation.bind(this);
            return window.ssdom.changeLocation.apply(this, arguments);
          }.bind(self);
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

      scriptEl.textContent = RegisterEventsInlineScript;

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

        this._domSession.emit("pre-send");
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
};

module.exports = Session;
