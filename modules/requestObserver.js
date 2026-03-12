"use strict";

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

Cu.import("chrome://greasemonkey-modules/content/constants.js");

Cu.import("resource://gre/modules/Services.jsm");

Cu.import("chrome://greasemonkey-modules/content/prefManager.js");
Cu.import("chrome://greasemonkey-modules/content/util.js");


const FILE_SCRIPT_EXTENSION_REGEXP = new RegExp(
    GM_CONSTANTS.fileScriptExtensionRegexp + "$", ""); 

var SCHEMES_DISALLOWED = {
  "chrome": 1,
  "view-source": 1,
};
SCHEMES_DISALLOWED[GM_CONSTANTS.addonScriptProtocolScheme] = 1;
Object.freeze(SCHEMES_DISALLOWED);

// \\ // \\ // \\ // \\ // \\ // \\ // \\ // \\ // \\ // \\ // \\ // \\ // \\ //

function checkScriptRefresh(aChannel) {
  // .loadInfo is part of nsiChannel -> implicit QI needed.
  if (!(aChannel instanceof Ci.nsIChannel)) {
    return undefined;
  }
  if (!aChannel.loadInfo) {
    return undefined;
  }

  // Firefox 44+
  // External types only.
  // http://bugzil.la/1182571
  let type = aChannel.loadInfo.externalContentPolicyType
      ? aChannel.loadInfo.externalContentPolicyType
      : aChannel.loadInfo.contentPolicyType;

  // Only check for updated scripts when tabs/frames/iframes are loaded.
  if ((type != Ci.nsIContentPolicy.TYPE_DOCUMENT)
      && (type != Ci.nsIContentPolicy.TYPE_SUBDOCUMENT)) {
    return undefined;
  }

  // Forward compatibility: http://bugzil.la/1124477
  let browser = aChannel.loadInfo.topFrameElement;

  if (!browser && aChannel.notificationCallbacks) {
    // Current API: http://bugzil.la/1123008#c7
    let loadCtx = aChannel.notificationCallbacks.QueryInterface(
        Ci.nsIInterfaceRequestor).getInterface(Ci.nsILoadContext);
    browser = loadCtx.topFrameElement;
  }

  let windowId = aChannel.loadInfo.innerWindowID;

  GM_util.getService().scriptRefresh(aChannel.URI.spec, windowId, browser);
}

// \\ // \\ // \\ // \\ // \\ // \\ // \\ // \\ // \\ // \\ // \\ // \\ // \\ //

function installObserver(aSubject, aTopic, aData) {
  // When observing a new request, inspect it to determine
  // if it should be a user script install.
  // If so, abort and restart as an install rather than a navigation.
  if (!GM_util.getEnabled()) {
    return undefined;
  }

  let channel = aSubject.QueryInterface(Ci.nsIChannel);
  if (!channel || !channel.loadInfo) {
    return undefined;
  }

  // http://bugzil.la/1182571
  let type = channel.loadInfo.externalContentPolicyType
      || channel.loadInfo.contentPolicyType;
  if (type != Ci.nsIContentPolicy.TYPE_DOCUMENT) {
    return undefined;
  }

  if (channel.URI.scheme in SCHEMES_DISALLOWED) {
    return undefined;
  }

  let httpChannel;
  try {
    httpChannel = channel.QueryInterface(Ci.nsIHttpChannel);
    if (httpChannel.requestMethod == "POST") {
      return undefined;
    }
  } catch (e) {
    // Ignore completely, e.g. file:// URIs.
  }

  if (!FILE_SCRIPT_EXTENSION_REGEXP.test(channel.URI.spec)) {
    return undefined;
  }

  // We've done an early return above for all non-user-script navigations.
  // If execution has proceeded to this point, we want to cancel
  // the existing request (i.e. navigation) and instead of start
  // a script installation for this same URI.
  let request;
  try {
    request = channel.QueryInterface(Ci.nsIRequest);
    // See #1717.
    if (request.isPending()) {
      request.suspend();
    }

    let browser = channel
        .QueryInterface(Ci.nsIHttpChannel)
        .notificationCallbacks
        .getInterface(Ci.nsILoadContext)
        .topFrameElement;

    GM_util.showInstallDialog(channel.URI.spec, browser, request);
  } catch (e) {
    dump(GM_CONSTANTS.info.scriptHandler + " "
        + "could not do script install:" + "\n" + e + "\n");
    // Ignore.
    return undefined;
  }
}

// \\ // \\ // \\ // \\ // \\ // \\ // \\ // \\ // \\ // \\ // \\ // \\ // \\ //

Services.obs.addObserver({
  "observe": function (aSubject, aTopic, aData) {
    try {
      installObserver(aSubject, aTopic, aData);
    } catch (e) {
      dump(GM_CONSTANTS.info.scriptHandler + " "
          + "install observer failed:" + "\n" + e + "\n");
    }
    try {
      checkScriptRefresh(aSubject);
    } catch (e) {
      dump(GM_CONSTANTS.info.scriptHandler + " "
          + "refresh observer failed:" + "\n" + e + "\n");
    }
  },
}, "http-on-modify-request", false);
