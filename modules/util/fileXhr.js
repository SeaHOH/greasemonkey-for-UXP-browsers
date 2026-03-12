"use strict";

const EXPORTED_SYMBOLS = ["fileXhr"];

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

Cu.importGlobalProperties(["XMLHttpRequest"]);


const FILE_PROTOCOL_SCHEME_REGEXP = new RegExp(
    GM_CONSTANTS.fileProtocolSchemeRegexp, "");

// Sync XHR.
// It's just meant to fetch file:// URLs
// that aren't otherwise accessible in content.
// Don't use it in the parent process or for web URLs.
function fileXhr(aUrl, aMimetype, aResponseType) {
  if (!FILE_PROTOCOL_SCHEME_REGEXP.test(aUrl)) {
    throw new Error("fileXhr - used for non-file URL:" + "\n" + aUrl);
  }
  let xhr = new XMLHttpRequest();
  xhr.open("open", aUrl, false);
  if (aResponseType) {
    xhr.responseType = aResponseType;
  } else {
    xhr.overrideMimeType(aMimetype);
  }
  xhr.send(null);
  return aResponseType ? xhr.response : xhr.responseText;
}
