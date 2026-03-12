/**
 * @file scriptProtocol.js
 * @overview Registers the "greasemonkey-script:" custom protocol handler.
 *
 * The protocol is used by GM_getResourceURL() to serve @resource files to
 * web content without exposing their local file:// paths.
 *
 * URI format: greasemonkey-script:<uuid>/<resourceName>
 *
 * When a greasemonkey-script: URI is requested, ScriptProtocol.newChannel()
 * looks up the script by UUID via IPCScript.getByUuid(), finds the named
 * @resource, and returns a channel wrapping its local file:// URI.  The
 * channel's originalURI is set to the greasemonkey-script: URI so it can be
 * loaded by unprivileged content (bug #2326).
 *
 * DummyChannel is returned as a 404-equivalent whenever the URI is malformed
 * or the script/resource is not found.
 *
 * Protocol flags:
 *   - URI_INHERITS_SECURITY_CONTEXT — content inherits caller's origin.
 *   - URI_IS_LOCAL_RESOURCE          — files are local.
 *   - URI_LOADABLE_BY_ANYONE         — no privilege required to load.
 *   - URI_NOAUTH / URI_NON_PERSISTABLE / URI_NORELATIVE — misc restrictions.
 */

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

/**
 * Initialises the greasemonkey-script: protocol handler.
 * Subsequent calls are no-ops (guarded by gHaveDoneInit).
 */
function initScriptProtocol() {
  if (gHaveDoneInit) {
    return undefined;
  }

  gHaveDoneInit = true;

  ScriptProtocol.init();
}

////////////////////////////////////////////////////////////////////////////////

/**
 * Stub nsIChannel returned when a greasemonkey-script: URI cannot be resolved.
 * asyncOpen() is a no-op; the channel reports HTTP status 404 in its fields.
 *
 * @constructor
 * @param {nsIURI}  aUri    - The requested URI.
 * @param {Script}  [aScript] - Unused; kept for call-site symmetry.
 */
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
