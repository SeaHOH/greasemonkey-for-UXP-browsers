const EXPORTED_SYMBOLS = ["extractMeta"];

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


const SCRIPT_PARSE_META_ALL_REGEXP = new RegExp(
    "^("
    + GM_CONSTANTS.scriptParseBOM
    + ")?"
    + GM_CONSTANTS.scriptParseMetaRegexp,
    "m");

// Get just the stuff between ==UserScript== lines.
function extractMeta(aSource) {
  let meta = aSource.match(SCRIPT_PARSE_META_ALL_REGEXP);
  if (meta) {
    return meta[2].replace(new RegExp("^\\s+", ""), "");
  }

  return "";
}
