const EXPORTED_SYMBOLS = ["initScriptProtocol"];

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

Cu.import("chrome://greasemonkey-modules/content/ipcScript.js");
Cu.import("chrome://greasemonkey-modules/content/util.js");


const ADDON_SCRIPT_PROTOCOL_REGEXP = new RegExp(
    GM_CONSTANTS.addonScriptProtocolScheme + ":" + "([-0-9a-f]+)\/(.*)", "");

var gHaveDoneInit = false;
var gScope = this;

function initScriptProtocol() {
  if (gHaveDoneInit) {
    return undefined;
  }

  gHaveDoneInit = true;

  ScriptProtocol.init();
}

////////////////////////////////////////////////////////////////////////////////

function DummyChannel(aUri, aScript) {
  // nsIRequest
  this.loadFlags = 0;
  this.loadGroup = null;
  this.name = aUri.spec;
  this.status = 404;
  this.content = "";

  // nsIChannel
  this.contentCharset = GM_CONSTANTS.fileScriptCharset;
  this.contentLength = this.content.length;
  // The alternative MIME type:
  // "text/plain;charset=" + GM_CONSTANTS.fileScriptCharset.toLowerCase()
  this.contentType = "application/javascript";
  this.notificationCallbacks = null;
  this.originalURI = aUri;
  this.owner = null;
  this.securityInfo = null;
  this.URI = aUri;
}

// nsIChannel
DummyChannel.prototype.asyncOpen = function (aListener, aContext) {};

////////////////////////////////////////////////////////////////////////////////

var ScriptProtocol = {
  "_classDescription": GM_CONSTANTS.addonScriptProtocolClassDescription,
  "_classID": GM_CONSTANTS.addonScriptProtocolClassID,
  "_contractID": GM_CONSTANTS.addonScriptProtocolContractID,

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
            + "Script protocol - Error registering:" + "\n" + e);
      }
      return undefined;
    };
  },

  "QueryInterface": XPCOMUtils.generateQI([
    Ci.nsIFactory,
    Ci.nsIProtocolHandler,
    Ci.nsISupportsWeakReference
  ]),

////////////////////////////// nsIProtocolHandler //////////////////////////////

  "scheme": GM_CONSTANTS.addonScriptProtocolScheme,
  "defaultPort": -1,
  "protocolFlags": 0
      | Ci.nsIProtocolHandler.URI_INHERITS_SECURITY_CONTEXT
      | Ci.nsIProtocolHandler.URI_IS_LOCAL_RESOURCE
      | Ci.nsIProtocolHandler.URI_LOADABLE_BY_ANYONE
      | Ci.nsIProtocolHandler.URI_NOAUTH
      | Ci.nsIProtocolHandler.URI_NON_PERSISTABLE
      | Ci.nsIProtocolHandler.URI_NORELATIVE
  ,

  "allowPort": function (aPort, aScheme) {
    return false;
  },

  "newURI": function (aSpec, aCharset, aBaseUri) {
    let uri = Cc["@mozilla.org/network/simple-uri;1"]
        .createInstance(Ci.nsIURI);
    uri.spec = aSpec;

    return uri;
  },

  "newChannel": function (aUri) {
    let m = aUri.spec.match(ADDON_SCRIPT_PROTOCOL_REGEXP);
    let dummy = new DummyChannel(aUri);

    // Incomplete URI, send a 404.
    if (!m) {
      return dummy;
    }

    let script = IPCScript.getByUuid(m[1]);

    // Fail fast if we couldn't find the script.
    if (!script) {
      return dummy;
    }

    for (let i = 0, iLen = script.resources.length; i < iLen; i++) {
      let resource = script.resources[i];
      if (resource.name == m[2]) {
        let uri = GM_util.getUriFromUrl(resource.file_url);

        // See #2326.
        // Get the channel for the file URI, but set its originalURI
        // to the greasemonkey-script: protocol URI,
        // to ensure it can still be loaded in unprivileged contexts.
        let channel = GM_util.getChannelFromUri(uri);
        channel.originalURI = aUri;

        return channel;
      }
    }

    // Default fall-through case, send a 404.
    return dummy;
  },

////////////////////////////////// nsIFactory //////////////////////////////////

  "createInstance": function (aOuter, aIid) {
    if (aOuter) {
      throw Cr.NS_ERROR_NO_AGGREGATION;
    }
    return this.QueryInterface(aIid);
  },
};
