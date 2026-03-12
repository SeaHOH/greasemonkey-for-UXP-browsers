const EXPORTED_SYMBOLS = ["getUriFromFile"];

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


function getUriFromFile(aFile) {
  return GM_CONSTANTS.ioService.newFileURI(aFile);
}
