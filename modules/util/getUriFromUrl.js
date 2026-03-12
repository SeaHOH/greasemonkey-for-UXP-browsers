const EXPORTED_SYMBOLS = ["getUriFromUrl"];

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


function getUriFromUrl(aUrl, aBase) {
  let baseUri = null;
  if (typeof aBase == "string") {
    baseUri = GM_util.getUriFromUrl(aBase);
  } else if (aBase) {
    baseUri = aBase;
  }

  try {
    return GM_CONSTANTS.ioService.newURI(aUrl, null, baseUri);
  } catch (e) {
    return null;
  }
}
getUriFromUrl = GM_util.memoize(getUriFromUrl);
