const EXPORTED_SYMBOLS = ["getChannelFromUri"];

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


function getChannelFromUri(aUri) {
  if (GM_CONSTANTS.ioService.newChannelFromURI2) {
    return GM_CONSTANTS.ioService.newChannelFromURI2(
        aUri, null, Services.scriptSecurityManager.getSystemPrincipal(),
        null, Ci.nsILoadInfo.SEC_NORMAL, Ci.nsIContentPolicy.TYPE_OTHER);
  } else {
    return GM_CONSTANTS.ioService.newChannelFromURI(aUri);
  }
}
