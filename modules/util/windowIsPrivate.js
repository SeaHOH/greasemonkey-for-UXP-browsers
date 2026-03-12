const EXPORTED_SYMBOLS = ["windowIsPrivate"];

if (typeof Cc === "undefined") {
  var Cc = Components.classes;
}
if (typeof Ci === "undefined") {
  var Ci = Components.interfaces;
}
if (typeof Cu === "undefined") {
  var Cu = Components.utils;
}

Cu.import("resource://gre/modules/PrivateBrowsingUtils.jsm");


function windowIsPrivate(aContentWin) {
  // i.e. the Private Browsing autoStart pref:
  // "browser.privatebrowsing.autostart"
  return PrivateBrowsingUtils.isContentWindowPrivate(aContentWin);
}
