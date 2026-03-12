const EXPORTED_SYMBOLS = ["newUserScript"];

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


function newUserScript(aWin) {
  Cc["@mozilla.org/embedcomp/window-watcher;1"].getService(Ci.nsIWindowWatcher)
      .openWindow(
          aWin,
          "chrome://greasemonkey/content/newScript.xul", null,
          "chrome,dependent,centerscreen,resizable,dialog", null);
}
