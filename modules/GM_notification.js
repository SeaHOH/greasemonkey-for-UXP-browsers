const EXPORTED_SYMBOLS = ["GM_notification"];

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

Cu.import("resource://gre/modules/Services.jsm");

Cu.import("resource://gre/modules/PopupNotifications.jsm");

Cu.import("chrome://greasemonkey-modules/content/prefManager.js");
Cu.import("chrome://greasemonkey-modules/content/util.js");


function muteGrants() {
  GM_prefRoot.setValue("showGrantsWarning", false);
}

function mute(aTopic) {
  GM_prefRoot.setValue("notification.muted." + aTopic, true);
}

function GM_notification(aMessage, aTopic, aOptions) {
  let type = null;
  switch (aTopic) {
    case "greasemonkey-grants-warning":
      type = "grants";
      break;
  }

  let muted = false;
  switch (type) {
    case "grants":
      muted = GM_prefRoot.getValue("showGrantsWarning");
      if (!muted) {
        return undefined;
      }
      break;
    default:
      muted = GM_prefRoot.getValue("notification.muted." + aTopic, false);
      if (muted) {
        return undefined;
      }
      break;
  }

  let supportLearnMoreURL = true;
  // Pale Moon 27.5.x-
  // https://github.com/MoonchildProductions/Pale-Moon/pull/1355
  if (((Services.appinfo.ID == GM_CONSTANTS.browserIDPalemoon)
      && (GM_util.compareVersion("27.6.0a1", "20170919000000") < 0))) {
    supportLearnMoreURL = false;
  }

  let chromeWin = GM_util.getBrowserWindow();
  let mainAction = {
    "accessKey": GM_CONSTANTS.localeStringBundle.createBundle(
        GM_CONSTANTS.localeGreasemonkeyProperties)
        .GetStringFromName("notification.ok.accesskey"),
    "callback": function () {},
    "label": GM_CONSTANTS.localeStringBundle.createBundle(
        GM_CONSTANTS.localeGreasemonkeyProperties)
        .GetStringFromName("notification.ok.label"),
  };
  let secondaryActions = [];
  if (aOptions && aOptions.learnMoreURL && !supportLearnMoreURL) {
    secondaryActions.push({
      "accessKey": GM_CONSTANTS.localeStringBundle.createBundle(
          GM_CONSTANTS.localeGreasemonkeyProperties)
          .GetStringFromName("notification.learnMore.accesskey"),
      "callback": function () {
        chromeWin.gBrowser.selectedTab = chromeWin.gBrowser.addTab(
            aOptions.learnMoreURL, {
              "ownerTab": chromeWin.gBrowser.selectedTab,
            });
        /*
        switch (type) {
          case "grants":
            muteGrants();
            break;
          default:
            mute(aTopic);
            break;
        }
        */
      },
      "label": GM_CONSTANTS.localeStringBundle.createBundle(
          GM_CONSTANTS.localeGreasemonkeyProperties)
          .GetStringFromName("notification.learnMore.label"),
    });      
  }
  secondaryActions.push({
    "accessKey": GM_CONSTANTS.localeStringBundle.createBundle(
        GM_CONSTANTS.localeGreasemonkeyProperties)
        .GetStringFromName("notification.neverAgain.accesskey"),
    "callback": function () {
      switch (type) {
        case "grants":
          muteGrants();
          break;
        default:
          mute(aTopic);
          break;
      }
    },
    "label": GM_CONSTANTS.localeStringBundle.createBundle(
        GM_CONSTANTS.localeGreasemonkeyProperties)
        .GetStringFromName("notification.neverAgain.label"),
  });

  let id = "greasemonkey-notification";
  switch (type) {
    case "grants":
      id = id + "-" + type;
      break;
  }

  if (chromeWin) {
    chromeWin.PopupNotifications.show(
        chromeWin.gBrowser.selectedBrowser, id,
        aMessage, null, mainAction, secondaryActions,
        aOptions ? aOptions : null);
  } else {
    switch (type) {
      case "grants":
        // Ignore, this is probably a startup issue like #2294.
        break;
      default:
        GM_util.logError(
            "(internal) GM_notification():"
            + "\n" + aMessage + "\n" + "chromeWin = " + chromeWin);
        break;
    }
  }
};
