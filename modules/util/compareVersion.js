const EXPORTED_SYMBOLS = ["compareVersion"];

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


function compareVersion(aTarget, aTargetBuildID) {
  let versionChecker = Cc["@mozilla.org/xpcom/version-comparator;1"]
      .getService(Ci.nsIVersionComparator);

  let result = -1;

  result = versionChecker.compare(GM_CONSTANTS.xulAppInfo.version, aTarget);

  if ((typeof aTargetBuildID != "undefined") && (result == 0)) {
    let _buildID1 = Number(GM_CONSTANTS.xulAppInfo.platformBuildID);
    let _buildID2 = Number(aTargetBuildID);
    if ((!Number.isNaN(_buildID1)) && (!Number.isNaN(_buildID2))) {
      if (_buildID1 < _buildID2) {
        result = -1;
      } else if (_buildID1 == _buildID2) {
        result = 0;
      } else if (_buildID1 > _buildID2) {
        result = 1;
      }
    }
  }

  return result;
}
