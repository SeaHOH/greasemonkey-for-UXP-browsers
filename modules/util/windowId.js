const EXPORTED_SYMBOLS = ["windowId"];

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

Cu.import("chrome://greasemonkey-modules/content/util.js");


function windowId(aWin, aWhich) {
  try {
    // Do not operate on chrome windows.
    aWin.QueryInterface(Ci.nsIDOMChromeWindow);
    return null;
  } catch (e) {
    // We want this to fail.
    // Catch is no-op.
  }

  let href = null;
  try {
    // Dunno why this is necessary, but sometimes we get non-chrome windows
    // whose locations we cannot access.
    href = aWin.location.href;
    if (!GM_util.isGreasemonkeyable(href)) {
      return null;
    }
  } catch (e) {
    return null;
  }

  let domWindowUtils = aWin
      .QueryInterface(Ci.nsIInterfaceRequestor)
      .getInterface(Ci.nsIDOMWindowUtils);
  let windowId;
  try {
    if (aWhich == "outer") {
      windowId = domWindowUtils.outerWindowID;
    } else if (!aWhich || (aWhich == "inner")) {
      windowId = domWindowUtils.currentInnerWindowID;
    }
  } catch (e) {
    // Ignore.
  }

  if (typeof windowId == "undefined") {
    // Firefox <4.0 does not provide this, use the document instead.
    // https://developer.mozilla.org/en/Inner_and_outer_windows
    // (Document is a property of the window, and should let us dig
    // into the "inner window" rather than always getting
    // the same "outer window", due to bfcache.)
    GM_util.logError(
        GM_CONSTANTS.info.scriptHandler + " - "
        + "windowId (" + aWhich + ") = undefined");
    return aWin.document;
  }

  return windowId;
}
