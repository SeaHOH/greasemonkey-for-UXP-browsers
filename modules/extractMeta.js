/**
 * @file extractMeta.js
 * @overview Extracts the raw ==UserScript== metadata block from script source.
 *
 * The regex used is assembled from constants so that it stays in sync with the
 * BOM-handling and meta-block delimiters defined in constants.js.
 */

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

/**
 * Extracts the text between the ==UserScript== … ==/UserScript== delimiters.
 * Strips any leading BOM and leading whitespace from the returned block.
 *
 * @param {string} aSource - Raw source text of the .user.js file.
 * @returns {string} The metadata block content, or "" if no block is found.
 */
function extractMeta(aSource) {
  let meta = aSource.match(SCRIPT_PARSE_META_ALL_REGEXP);
  if (meta) {
    return meta[2].replace(new RegExp("^\\s+", ""), "");
  }

  return "";
}
