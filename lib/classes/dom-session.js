/*
Session object available in server scripts via `window.ssdom`.
*/
"use strict";

var
// Builtin Modules
    EventEmitter = require("events")

// End Modules
;

class DOMSession extends EventEmitter {

  constructor(session) {
    super();

    // Method names of Session that should be present
    // on the DOMSession as well.
    const sessionFuncNames = [
      "loadContent",
      "loadData",
      "changeLocation",
      "maintainSession",
      "destroySession"
    ];

    for(let funcName of sessionFuncNames) {
      this[funcName] = session[funcName].bind(session);
    }
  }

};

Object.defineProperty(module, "exports", {
  get() { return DOMSession; }
});
