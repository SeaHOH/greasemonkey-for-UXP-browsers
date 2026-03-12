const EXPORTED_SYMBOLS = ["getTempDir"];

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


const DIRECTORY_TEMP = GM_CONSTANTS.directoryService
    .get(GM_CONSTANTS.directoryServiceTempName, Ci.nsIFile);
const DIRECTORY_TYPE = Ci.nsIFile.DIRECTORY_TYPE;

function getTempDir(aRoot) {
  let dir = (aRoot || DIRECTORY_TEMP).clone();
  dir.append(GM_CONSTANTS.directoryTempName);
  dir.createUnique(DIRECTORY_TYPE, GM_CONSTANTS.directoryMask);

  return dir;
}
