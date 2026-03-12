const EXPORTED_SYMBOLS = ["getService"];

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


function getService() {
  return Cc[GM_CONSTANTS.addonServiceContractID].getService().wrappedJSObject;
}
