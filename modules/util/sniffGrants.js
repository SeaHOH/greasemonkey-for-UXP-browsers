const EXPORTED_SYMBOLS = ["sniffGrants"];

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


function sniffGrants(aScript) {
  let src = GM_util.getScriptSource(aScript);
  let grants = [];

  for (let i = 0, iLen = GM_CONSTANTS.addonAPI.length; i < iLen; i++) {
    let apiName = GM_CONSTANTS.addonAPI[i];
    if (src.indexOf(apiName) !== -1) {
      grants.push(apiName);
    }
  }
  if (grants.length == 0) {
    return ["none"];
  }

  return grants;
}
