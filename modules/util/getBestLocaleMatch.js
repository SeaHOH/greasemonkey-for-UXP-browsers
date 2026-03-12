const EXPORTED_SYMBOLS = ["getBestLocaleMatch"];

if (typeof Cc === "undefined") {
  var Cc = Components.classes;
}
if (typeof Ci === "undefined") {
  var Ci = Components.interfaces;
}
if (typeof Cu === "undefined") {
  var Cu = Components.utils;
}

Cu.import("resource://gre/modules/Services.jsm");

Cu.import("chrome://greasemonkey-modules/content/util.js");


const SEPARATOR = "-";

// This function tries to find the best matching locale.
// Locales should be given in the form "lang[-COUNTRY]".
// If an exact match (i.e. both lang and country match) can be found,
// it is returned.
// Otherwise, a partial match based on the lang part is attempted.
// Partial matches without country are preferred over lang matches
// with non-matching country.
// If no locale matches, null is returned.
function getBestLocaleMatch(aPreferred, aAvailable) {
  let preferredLang = aPreferred.split(SEPARATOR)[0];

  let langMatch = null;
  let partialMatch = null;
  for (let i = 0, iLen = aAvailable.length; i < iLen; i++) {
    let current = aAvailable[i];
    // Both lang and country match.
    if (current == aPreferred) {
      return current;
    }

    if (current == preferredLang) {
      // Only lang matches, no country.
      langMatch = current;
    } else if (current.split(SEPARATOR)[0] == preferredLang) {
      // Only lang matches, non-matching country.
      partialMatch = current;
    }
  }

  return langMatch || partialMatch;
}
