"use strict";

const EXPORTED_SYMBOLS = ["AbstractScript"];

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

Cu.import("chrome://greasemonkey-modules/content/prefManager.js");
Cu.import("chrome://greasemonkey-modules/content/thirdParty/convertToRegexp.js");
Cu.import("chrome://greasemonkey-modules/content/thirdParty/matchPattern.js");
Cu.import("chrome://greasemonkey-modules/content/util.js");


const ABOUT_BLANK_REGEXP = new RegExp(GM_CONSTANTS.urlAboutPart1Regexp, "");

function AbstractScript() { }

Object.defineProperty(AbstractScript.prototype, "globalExcludes", {
  "get": function AbstractScript_getGlobalExcludes() {
    return [];
  },
  "configurable": true,
});

AbstractScript.prototype.matchesURL = function (aUrl) {
  var uri = GM_util.getUriFromUrl(aUrl);
  var _AbstractScript = this;

  function testClude(aGlob) {
    // See #1298.
    // Do not run in about:blank unless _specifically_ requested.
    if (ABOUT_BLANK_REGEXP.test(aUrl) && !ABOUT_BLANK_REGEXP.test(aGlob)) {
      return false;
    }

    return GM_convertToRegexp(aGlob, uri).test(aUrl);
  }
  function testMatch(aMatchPattern) {
    if (typeof aMatchPattern == "string") {
      aMatchPattern = new MatchPattern(aMatchPattern);
    }

    let _url = aUrl;
    if (!GM_prefRoot.getValue("api.@match.hash")) {
      if (uri) {
        _url = uri.specIgnoringRef;
      } else {
        GM_util.logError(
            '"' + _AbstractScript.localized.name + '"' + "\n" +
            "abstractScript - AbstractScript.matchesURL - testMatch:" + "\n" +
            GM_CONSTANTS.localeStringBundle.createBundle(
            GM_CONSTANTS.localeGreasemonkeyProperties)
            .GetStringFromName("error.invalidUrl")
            .replace("%1", aUrl));
      }
    }

    return aMatchPattern.doMatch(_url);
  }

  // Flat deny if URL is not greaseable, or matches global excludes.
  if (!GM_util.isGreasemonkeyable(aUrl)) {
    return false;
  }

  /*
  uE - the user excludes
  uIM - the user includes/matches
  sE - the script excludes
  sIM - the script includes/matches

  0  0   0  0

  0  uIM 0  0
  0  0   sE 0
  0  0   0  sIM

  0  uIM sE 0
  0  uIM 0  sIM
  0  0   sE sIM

  0  uIM sE sIM

  uE 0   0  0

  uE uIM 0  0
  uE 0   sE 0
  uE 0   0  sIM

  uE uIM sE 0
  uE uIM 0  sIM
  uE 0   sE sIM

  uE uI  sE sIM
  */

  if (this.globalExcludes.some(testClude)) {
    return false;
  }

  // Allow based on user cludes.
  if (this.userExcludes.some(testClude)) {
    return false;
  }
  if (this.userIncludes.some(testClude) || this.userMatches.some(testMatch)) {
    return true;
  } else {
    if (this.userOverride) {
      if ((this.userIncludes.length == 0) && (this.userMatches.length == 0)) {
        return [GM_CONSTANTS.script.includeAll].some(testClude);
      } else {
        return false;
      }
    }
  }

  // Finally allow based on script cludes and matches.
  if (this.excludes.some(testClude)) {
    return false;
  }
  return (this.includes.some(testClude) || this.matches.some(testMatch));
};
