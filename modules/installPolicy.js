// This module is responsible for detecting user scripts
// that are loaded by some means OTHER than HTTP
// (which the http-on-modify-request observer handles), i.e. local files.
const EXPORTED_SYMBOLS = [];

if (typeof Cc === "undefined") {
  var Cc = Components.classes;
}
if (typeof Ci === "undefined") {
  var Ci = Components.interfaces;
}
if (typeof Cu === "undefined") {
  var Cu = Components.utils;
}
if (typeof Cr === "undefined") {
  var Cr = Components.results;
}

Cu.import("chrome://greasemonkey-modules/content/constants.js");

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");

Cu.import("chrome://greasemonkey-modules/content/util.js");


const ACCEPT = Ci.nsIContentPolicy.ACCEPT;
const REJECT = Ci.nsIContentPolicy.REJECT_REQUEST;

const FILE_SCRIPT_EXTENSION_REGEXP = new RegExp(
    GM_CONSTANTS.fileScriptExtensionRegexp + "$", ""); 

var gHaveDoneInit = false;

////////////////////////////////////////////////////////////////////////////////

var InstallPolicy = {
  "_classDescription": GM_CONSTANTS.addonInstallPolicyClassDescription,
  "_classID": GM_CONSTANTS.addonInstallPolicyClassID,
  "_contractID": GM_CONSTANTS.addonInstallPolicyContractID,

  "init": function () {
    try {
      let registrar = Components.manager.QueryInterface(
          Ci.nsIComponentRegistrar);
      registrar.registerFactory(
          this._classID, this._classDescription, this._contractID, this);
    } catch (e) {
      if (e.name == "NS_ERROR_FACTORY_EXISTS") {
        // No-op, ignore these.
        // But why do they happen?!
      } else {
        GM_util.logError(
            GM_CONSTANTS.info.scriptHandler + " - "
            + "Install Policy factory - Error registering:"
            + "\n" + e, false,
            e.fileName, e.lineNumber);
      }
      return undefined;
    }

    let catMan = Cc["@mozilla.org/categorymanager;1"]
        .getService(Ci.nsICategoryManager);
    catMan.addCategoryEntry(
        "content-policy", this._contractID, this._contractID, false, true);
  },

  "QueryInterface": XPCOMUtils.generateQI([
    Ci.nsIContentPolicy,
    Ci.nsIFactory,
    Ci.nsISupportsWeakReference
  ]),

/////////////////////////////// nsIContentPolicy ///////////////////////////////

  "shouldLoad": function (aContentType, aContentURI, aOriginURI, aContext) {
    // Ignore everything that isn't a file:// .
    if (aContentURI.scheme != "file") {
      return ACCEPT;
    }
    // Ignore everything that isn't a top-level document navigation.
    if (aContentType != Ci.nsIContentPolicy.TYPE_DOCUMENT) {
      return ACCEPT;
    }
    // Ignore everything when GM is not enabled.
    if (!GM_util.getEnabled()) {
      return ACCEPT;
    }
    // Ignore everything that isn't a user script.
    if (!FILE_SCRIPT_EXTENSION_REGEXP.test(aContentURI.spec)) {
      return ACCEPT;
    }
    // Ignore temporary files, e.g. "Show script source".
    let tmpResult = Services.cpmm.sendSyncMessage(
        "greasemonkey:url-is-temp-file", {
          "url": aContentURI.spec,
        });
    if (tmpResult.length && tmpResult[0]) {
      return ACCEPT;
    }

    Services.cpmm.sendAsyncMessage(
        "greasemonkey:script-install", {
          "url": aContentURI.spec,
        });

    return REJECT;
  },

  "shouldProcess": function () {
    return ACCEPT;
  },

////////////////////////////////// nsIFactory //////////////////////////////////

  "createInstance": function (aOuter, aIid) {
    if (aOuter) {
      throw Cr.NS_ERROR_NO_AGGREGATION;
    }
    return this.QueryInterface(aIid);
  },
};

////////////////////////////////////////////////////////////////////////////////

if (!gHaveDoneInit) {
  gHaveDoneInit = true;
  InstallPolicy.init();
}
