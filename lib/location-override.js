"use strict";

module.exports = function(window) {
  var _location = window.location;
  var location = {};

  function checkLocationChange(propName, oldVal) {
    if(propName !== "hash" && _location[propName] !== oldVal) {
      window.changeLocation(location.href);
    }
  }

  for(let name in _location) {
    let prop = _location[name];
    if(typeof prop !== "string") {
      Object.defineProperty(location, name, {
        get: function() { return _location[name]; },
        set: function(val) { _location[name] = val; }
      });
    } else {
      Object.defineProperty(location, name, {
        get: function() { return _location[name]; },
        set: function(val) {
          var oldVal = _location[name];
          _location[name] = val;
          checkLocationChange(name, oldVal);
        }
      });
    }
  }

  Object.defineProperty(window, "location", {
    value: location
  });

};
