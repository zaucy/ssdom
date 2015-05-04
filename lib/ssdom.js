// Builtin Modules
var fs      = require("fs")
  , path    = require("path")
  , events  = require("events")

// External modules
  , jsdom   = require("jsdom")

// End of Modules
;

function SSDOMInstance(opts) {
  events.EventEmitter.call(this);

  if(opts.resourceRoots) {
    if(typeof opts.resourceRoots == "string") {
      this.resourceRoots = {
        "default": opts.resourceRoots
      }
    } else {
      this.resourceRoots = opts.resourceRoots;
    }
  }

}

SSDOMInstance.prototype = Object.create(events.EventEmitter.prototype);

SSDOMInstance.prototype.resourceRoots = {
  "default": "./resources"
};

SSDOMInstance.prototype.runServerSideScript = function(window, doc, scriptEl) {

  Object.defineProperty(doc, "currentScript", { configurable: true, value: scriptEl });

  var scriptSrc = scriptEl.textContent;

  if(scriptEl.src) {
    var scriptPath = scriptEl.src;
    var scriptRoot = this.resourceRoots.script || this.resourceRoots.default;
    if(scriptPath[0] == "/") {
      scriptPath = scriptRoot + scriptPath;
    } else {
      var parsedPath = path.parse(scriptRoot + window.location.pathname);
      if(parsedPath.extname) {
        scriptPath = parsedPath.dir + "/" + scriptEl.src;
      } else {
        scriptPath = parsedPath.dir + "/" + parsedPath.name + "/" + scriptPath;
      }
    }

    scriptSrc = fs.readFileSync(scriptPath);
  }

  try {
    eval(`with(window) { ${scriptSrc} }`);
  } catch(err) {
    console.error(err);
  }

  Object.defineProperty(doc, "currentScript", { configurable:true, value: null });
}

SSDOMInstance.prototype.runServerSideScripts = function(win, doc) {
  var i, scriptEl, scriptEls = doc.getElementsByTagName("script");

  for(i=0; scriptEls.length > i; i++) {
    scriptEl = scriptEls[i];
    var context = scriptEl.getAttribute("context");

    if(context) switch(context) {
      case 'server-only':
        this.runServerSideScript(win, doc, scriptEl);
        scriptEl.parentElement.removeChild(scriptEl);
        break;
      case 'server':
        this.runServerSideScript(win, doc, scriptEl);
        scriptEl.removeAttribute("context");
        break;
      case 'client':
      case 'client-only':
        break;
      default:
        throw Error(`Invalid Script Context Attribute: '${context}'`);
    }
  }
}

SSDOMInstance.prototype.getDoctype = function(body) {
  var defaultDoctype = "<!DOCTYPE html>\n";
  var doctype = body.match(/<\s*\!\s*DOCTYPE\s+[^>]*/);

  return doctype ? doctype + ">\n" : defaultDoctype;
}

SSDOMInstance.prototype.run = function(body, callback) {
  var self = this;

  jsdom.env(body, function(errors, window) {
    if(errors) {
      console.log(errors);
      callback(null, body);
      window.close();
      return;
    }

    window.server = {
      state: self.state
    };

    self.runServerSideScripts(window, window.document);

    callback(null, self.getDoctype(body) + window.document.body.parentElement.outerHTML);
    window.close();
  });
}

module.exports = function(opts) {

  var ssdomi = new SSDOMInstance(opts || {});

  return function *(next) {

    yield next;

    if(!this.response.is('html')) return;

    var body = this.body;
    if(!body || body.pipe) return;

    if(Buffer.isBuffer(body)) body = body.toString();

    this.body = yield ssdomi.run.bind(ssdomi, body);
  }

};
