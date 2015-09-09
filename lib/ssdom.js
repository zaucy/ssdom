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

class ServerSideDOM {

  constructor(options) {
    var self = this;
    this._htmlPathString = options.htmlPathString || "main.html";

    this._httpServer = http.createServer(function(req, res) {
      self._handleHttpRequest(req, res);
    });

  }

  gethtmlPathString(hostname) {
    var str = this._htmlPathString;
    str = str.replace(/\{\w*HOSTNAME\w*\}/, hostname);

    return path.resolve(str);
  }

  _handleHttpRequest(req, res) {
    var hostname = req.headers.host;
    var colonIndex = hostname.indexOf(":");
    if(colonIndex > -1) {
      hostname = hostname.substr(0, colonIndex);
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

    this.document = null;
    this.window = null;
    this.baseDir = path.isAbsolute(htmlPathname) ?
      path.dirname(htmlPathname) : path.dirname(path.resolve(htmlPathname));

    if(!this.servePublic()) {
      fs.readFile(htmlPathname, function(err, data) {
        self.loadMarkup(data);
      });
    }
  }

  get hostname() {
    return this.request.headers.host;
  }

  get url() {
    return this.request.url;
  }

  get publicDir() {
    return path.resolve(this.baseDir, "./public");
  }

  get privateDir() {
    return path.resolve(this.baseDir, "./private");
  }

  get served() {
    return this._served === true;
  }

  loadMarkup(markup) {
    var self = this;

    var doc = jsdom.jsdom(markup, {
      url: this.hostname + this.url,
      resourceLoader: function(resource, callback) { self.loadResource(resource, callback); },
      features: {
        FetchExternalResources: ["script"],
        ProcessExternalResources: ["script"],
        SkipExternalResources: false
      },
      virtualConsole: jsdom.createVirtualConsole().sendTo(console)
    });

    this.document = doc;
    this.window = doc.defaultView;

    this.processScripts();
    this.serveDocument();

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

    if(filePath == path.dirname(filePath)) {
      return false;
    }

    try { fs.accessSync(filePath, fs.R_OK); }
    catch(err) { return false; }

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
    var html = jsdom.serializeDocument(this.document);

    this.response.writeHead(200, {
      "Content-Type": "text/html",
      "Content-Length": html.length
    });

    this.response.end(html);

    return true;
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
    return UglifyJS.minify("const SERVER = true;" + source, {
      fromString: true
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
          scriptSrc = this.getPrivateResource(scriptEl.getAttribute("src"));
          scriptEl.removeAttribute("src");
        } else {
          scriptSrc = scriptEl.textContent;
        }

        scriptEl.textContent = this.processServerScriptSource(scriptSrc);
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

    if(context == "server-only") {

    } else
    if(context == "server") {

    }
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
