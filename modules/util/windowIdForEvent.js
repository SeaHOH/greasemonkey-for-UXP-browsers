const EXPORTED_SYMBOLS = ["windowIdForEvent"];

if (typeof Cc === "undefined") {
  var Cc = Components.classes;
}
if (typeof Ci === "undefined") {
  var Ci = Components.interfaces;
}
if (typeof Cu === "undefined") {
  var Cu = Components.utils;
}

Cu.import("chrome://greasemonkey-modules/content/util.js");


function windowIdForEvent(aEvent) {
  let doc = aEvent.originalTarget;
  try {
    doc.QueryInterface(Ci.nsIDOMHTMLDocument);
  } catch (e) {
    return null;
  }

  return GM_util.windowId(doc.defaultView);
}
