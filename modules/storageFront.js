// The "front end" implementation of GM_ScriptStorageFront().
// This is loaded into the content process scope
// and simply delegates to the back end.

const EXPORTED_SYMBOLS = ["GM_ScriptStorageFront"];

if (typeof Cc === "undefined") {
  var Cc = Components.classes;
}
if (typeof Ci === "undefined") {
  var Ci = Components.interfaces;
}
if (typeof Cu === "undefined") {
  var Cu = Components.utils;
}

Cu.import("chrome://greasemonkey-modules/content/constants.js");

Cu.import("resource://gre/modules/Services.jsm");

Cu.import("chrome://greasemonkey-modules/content/prefManager.js");
Cu.import("chrome://greasemonkey-modules/content/util.js");


const MESSAGE_ERROR_PREFIX = "Script storage front end: ";
const CACHE_AFTER_N_GETS = 3;
const CACHE_MAX_VALUE = 4096;
const CACHE_SIZE = 1024;

// \\ // \\ // \\ // \\ // \\ // \\ // \\ // \\ // \\ // \\ // \\ // \\ // \\ //

var cache = new Map();
var cacheHitCounter = new Map();

Services.cpmm.addMessageListener("greasemonkey:value-invalidate",
    function (aMessage) {
      let data = aMessage.data;
      data.keys.forEach(invalidateCache);
    });

function invalidateCache(aKey) {
  cache["delete"](aKey);
  cacheHitCounter["delete"](aKey);
}

function cacheKey(aScript, aName) {
  return aScript.uuid + ":" + aName;
}

// \\ // \\ // \\ // \\ // \\ // \\ // \\ // \\ // \\ // \\ // \\ // \\ // \\ //

function GM_ScriptStorageFront(
    aMessageManager, aWrappedContentWin, aSandbox, aScript) {
  this._db = null;
  this._messageManager = aMessageManager;
  this._sandbox = aSandbox;
  this._script = aScript;
  this._wrappedContentWin = aWrappedContentWin;
}

Object.defineProperty(GM_ScriptStorageFront.prototype, "db", {
  "get": function GM_ScriptStorageFront_getDb() {
    throw new Error(
        MESSAGE_ERROR_PREFIX
        + GM_CONSTANTS.localeStringBundle.createBundle(
            GM_CONSTANTS.localeGreasemonkeyProperties)
            .GetStringFromName("error.storage.db.noConnection"));
  },
  "enumerable": true,
});

Object.defineProperty(GM_ScriptStorageFront.prototype, "dbFile", {
  "get": function GM_ScriptStorageFront_getDbFile() {
    throw new Error(
        MESSAGE_ERROR_PREFIX
        + GM_CONSTANTS.localeStringBundle.createBundle(
            GM_CONSTANTS.localeGreasemonkeyProperties)
            .GetStringFromName("error.storage.db.noFile"));
  },
  "enumerable": true,
});

GM_ScriptStorageFront.prototype.close = function () {
  throw new this._wrappedContentWin.Error(
      MESSAGE_ERROR_PREFIX
      + GM_CONSTANTS.localeStringBundle.createBundle(
          GM_CONSTANTS.localeGreasemonkeyProperties)
          .GetStringFromName("error.storage.db.noConnection"),
      this._script.fileURL, null);
};

GM_ScriptStorageFront.prototype.setValue = function (aName, aVal) {
  if (arguments.length !== 2) {
    throw new this._wrappedContentWin.Error(
        GM_CONSTANTS.localeStringBundle.createBundle(
            GM_CONSTANTS.localeGreasemonkeyProperties)
            .GetStringFromName("error.setValue.arguments"),
            this._script.fileURL, null);
  }

  aName = String(aName);

  let key = cacheKey(this._script, aName);

  invalidateCache(key);

  if (typeof aVal == "undefined") {
    aVal = null;
  }
  this._messageManager.sendRpcMessage(
      "greasemonkey:scriptVal-set", {
        "scriptId": this._script.id,
        "name": aName,
        "val": aVal,
      });
};

GM_ScriptStorageFront.prototype.getValue = function (aName, aDefVal) {
  let value;

  aName = String(aName);

  let key = cacheKey(this._script, aName);

  if (cache.has(key)) {
    value = cache.get(key);
  } else {
    let count = (cacheHitCounter.get(key) || 0) + 1;
    let intentToCache = count > CACHE_AFTER_N_GETS;

    value = this._messageManager.sendRpcMessage(
        "greasemonkey:scriptVal-get", {
          "cacheKey": key,
          "name": aName,
          "scriptId": this._script.id,
          "willCache": intentToCache,
        });
    value = value.length && value[0];

    // Avoid caching large values.
    if ((typeof value == "string") && (value.length > CACHE_MAX_VALUE)) {
      count = 0;
      intentToCache = false;
    }

    try {
      value = JSON.parse(value);
    } catch (e) {
      GM_util.logError(
          MESSAGE_ERROR_PREFIX.trim() + "\n" + e, false,
          e.fileName, e.lineNumber);
      return aDefVal;
    }

    if (intentToCache) {
      // Clean caches if scripts dynamically generate lots of keys.
      if (cache.size > CACHE_SIZE) {
        cache.clear();
        cacheHitCounter.clear();
      }
      cache.set(key, value);
    }

    cacheHitCounter.set(key, count);
  }

  if (typeof aDefVal == "undefined") {
    aDefVal = undefined;
  }
  if ((typeof value == "undefined") || (value === null)) {
    return aDefVal;
  }

  return Cu.cloneInto(value, this._sandbox, {
    "wrapReflectors": true,
  });
};

GM_ScriptStorageFront.prototype.deleteValue = function (aName) {
  aName = String(aName);

  let key = cacheKey(this._script, aName);

  invalidateCache(key);

  this._messageManager.sendRpcMessage(
      "greasemonkey:scriptVal-delete", {
        "cacheKey": key,
        "name": aName,
        "scriptId": this._script.id,
      });
};

GM_ScriptStorageFront.prototype.listValues = function () {
  var value = this._messageManager.sendRpcMessage(
      "greasemonkey:scriptVal-list", {
        "scriptId": this._script.id,
      });
  value = value.length && value[0] || [];

  try {
    value = JSON.parse(JSON.stringify(value));
    return Cu.cloneInto(value, this._sandbox, {
      "wrapReflectors": true,
    });
  } catch (e) {
    GM_util.logError(
        MESSAGE_ERROR_PREFIX.trim() + "\n" + e, false,
        e.fileName, e.lineNumber);
    return Cu.cloneInto([], this._sandbox);
  }
};
