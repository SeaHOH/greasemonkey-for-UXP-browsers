const EXPORTED_SYMBOLS = ["GM_notificationer"];

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


function GM_notificationer(
    aChromeWin, aWrappedContentWin, aSandbox, aFileURL, aScriptName) {
  this.chromeWin = aChromeWin;  
  this.fileURL = aFileURL;
  this.sandbox = aSandbox;
  this.sandboxPrincipal = Cu.getObjectPrincipal(aSandbox);
  this.scriptName = aScriptName;
  this.setupEvent = GM_util.hitch(
      this, "setupEvent", aWrappedContentWin, aSandbox,
      aFileURL);
  this.wrappedContentWin = aWrappedContentWin;
}

// This function gets called by user scripts in content security scope.
GM_notificationer.prototype.contentStart = function (
    aDetailsOrText, aOnDoneOrTitle, aImage, aOnClick) {
  let _functionEmpty = function () {};

  var details = {
    "highlight": true,
    "highlightOnly": false,
    "image": "chrome://greasemonkey/skin/icon32.png",
    "message": "",
    "onclick": _functionEmpty,
    "ondone": _functionEmpty,
    "timeout": 0,
    "timeoutWasReached": false,
    "title": this.scriptName,
  };

  var _details = {};

  if (aDetailsOrText) {
    if (typeof aDetailsOrText == "object") {
      // Part 1a:
      // Waive Xrays so that we can read callback function properties...
      // aDetailsOrText = Cu.waiveXrays(aDetailsOrText);
      _details.highlight = aDetailsOrText.highlight;
      _details.image = aDetailsOrText.image;
      _details.message = aDetailsOrText.text;
      _details.onclick = Cu.waiveXrays(aDetailsOrText).onclick;
      _details.ondone = Cu.waiveXrays(aDetailsOrText).ondone;
      _details.timeout = aDetailsOrText.timeout;
      _details.title = aDetailsOrText.title;
    } else if (typeof aDetailsOrText == "string") {
      details.message = aDetailsOrText;
    }
  }

  if (typeof _details.highlight != "undefined") {
    details.highlight = _details.highlight;
  }
  // i.e. a data scheme
  if (_details.image && (typeof _details.image == "string")) {
    details.image = _details.image;
  }
  if (_details.message && (typeof _details.message == "string")) {
    details.message = _details.message;
  }
  if (_details.onclick) {
    details.onclick = _details.onclick;
  }
  if (_details.ondone) {
    details.ondone = _details.ondone;
  }
  if (_details.timeout && Number.isInteger(_details.timeout)) {
    details.timeout = _details.timeout;
  }
  if (_details.title && (typeof _details.title == "string")) {
    details.title = _details.title;
  }

  if (aOnDoneOrTitle) {
    if (typeof aDetailsOrText == "object") {
      // Part 1b:
      // Waive Xrays so that we can read callback function properties...
      details.ondone = Cu.waiveXrays(aOnDoneOrTitle);
    } else if (typeof aOnDoneOrTitle == "string") {
      details.title = aOnDoneOrTitle;
    }
  }

  if (aImage) {
    // i.e. a data scheme
    if (typeof aImage == "string") {
      details.image = aImage;
    }
  }

  if (aOnClick) {
    details.onclick = aOnClick;
  }

  if ((details.message == "") && !details.highlight) {
    throw new this.wrappedContentWin.Error(
        GM_CONSTANTS.localeStringBundle.createBundle(
            GM_CONSTANTS.localeGreasemonkeyProperties)
            .GetStringFromName("error.notification.messageOrHighlight")
            .replace("%1", details.title),
        this.fileURL, null);
  }

  let _notification = {
    "details": details,
    "onClick": details.onclick,
    "onDone": details.ondone,
  };

  if (typeof _notification.onClick != "function") {
    throw new this.wrappedContentWin.Error(
        GM_CONSTANTS.localeStringBundle.createBundle(
            GM_CONSTANTS.localeGreasemonkeyProperties)
            .GetStringFromName("error.notification.callbackIsNotFunction")
            .replace("%1", _notification.details.title)
            .replace("%2", "onclick"),
        this.fileURL, null);
  }
  if (typeof _notification.onDone != "function") {
    throw new this.wrappedContentWin.Error(
        GM_CONSTANTS.localeStringBundle.createBundle(
            GM_CONSTANTS.localeGreasemonkeyProperties)
            .GetStringFromName("error.notification.callbackIsNotFunction")
            .replace("%1", _notification.details.title)
            .replace("%2", "ondone"),
        this.fileURL, null);
  }

  var options = {
    "body": details.message,
    "icon": details.image,
    "requireInteraction": true,
  };

  var notification = null;
  if (this.chromeWin) {
    if (!("Notification" in this.chromeWin)) {
      // This browser does not support desktop notification.
      // Ignore.
    } else if (this.chromeWin.Notification.permission === "granted") {
      // Let's check whether notification permissions
      // have already been granted.
      // If it's okay let's create a notification.
      notification = new this.chromeWin
          .Notification(details.title, options);
    } else if (this.chromeWin.Notification.permission !== "denied") {
      // Otherwise, we need to ask the user for permission.
      this.chromeWin.Notification.requestPermission(function (aPermission) {
        // If the user accepts, let's create a notification.
        if (aPermission === "granted") {
          notification = new this.chromeWin
              .Notification(details.title, options);
        }
      });
    }
    if (notification) {
      if (details.timeout && (details.timeout > 0)) {
        GM_util.timeout(function () {
          if (notification) {
            details.timeoutWasReached = true;
            notification.close();
          }
        }, details.timeout);
      }
    }
  } else {
    throw new this.wrappedContentWin.Error(
        'GM_notification() - "' + details.title + '": '
        + GM_CONSTANTS.localeStringBundle.createBundle(
            GM_CONSTANTS.localeGreasemonkeyProperties)
            .GetStringFromName("error.environment.unsupported.e10s"),
        this.fileURL, null);
  }

  if (notification) {
    // Hightlight tab does not work.
    /*
    if (details.highlight) {
      this.wrappedContentWin.focus();
      if (details.message == "") {
        details.highlightOnly = true;
        this.setupEvent(notification, "done", details);
      }
    }
    */
    // if (details.message != "") {
      GM_util.hitch(this, "chromeStart", notification, details)();
    // }
  } else {
    throw new this.wrappedContentWin.Error(
        GM_CONSTANTS.localeStringBundle.createBundle(
            GM_CONSTANTS.localeGreasemonkeyProperties)
            .GetStringFromName("error.notification.functionIsNotEnabled")
            .replace("%1", details.title)
            .replace("%2", '"about:config" - "dom.webnotifications.enabled"'),
        this.fileURL, null);
  }
};

// This function is intended to be called in chrome's security context.
GM_notificationer.prototype.chromeStart =
function (aNotification, aDetails) {
  this.setupEvent(aNotification, "click", aDetails);
  // Deprecated.
  this.setupEvent(aNotification, "close", aDetails);
  this.setupEvent(aNotification, "done", aDetails);
  this.setupEvent(aNotification, "error", aDetails);
};

// Arranges for the specified "event" on notification to call
// the method by the same name which is a property of "details"
// in the content window's security context.
GM_notificationer.prototype.setupEvent = function (
    aWrappedContentWin, aSandbox, aFileURL, aNotification, aEvent, aDetails) {
   var eventCallback = aDetails["on" + aEvent];

  // Part 2: ...but ensure that the callback came from a script, not content,
  // by checking that its principal equals that of the sandbox.
  if (eventCallback) {
    let callbackPrincipal = Cu.getObjectPrincipal(eventCallback);
    if (!this.sandboxPrincipal.equals(callbackPrincipal)) {
      return undefined;
    }
  }

  var startEventCallback = GM_util.hitch(
      this, "startEventCallback", aWrappedContentWin, aDetails);

  aNotification.addEventListener(aEvent, function (aEvt) {
    if (!aDetails.highlightOnly) {
      aEvt.preventDefault();
    }
    startEventCallback(aDetails["on" + aEvt.type]);
    switch (aEvt.type) {
      case "click":
        startEventCallback(
            aDetails["on" + "done"],
            (typeof aNotification.onclose != "undefined"));
        break;
      case "close":
        if (!aDetails.timeoutWasReached) {
          startEventCallback(aDetails["on" + "done"]);
        }
        break;
      case "error":
        throw new aWrappedContentWin.Error(
            GM_CONSTANTS.localeStringBundle.createBundle(
                GM_CONSTANTS.localeGreasemonkeyProperties)
                .GetStringFromName("error.notification.error")
                .replace("%1", aDetails.title),
            aFileURL, null);
        break;
    }
  }, false);
};

GM_notificationer.prototype.startEventCallback = function (
    aWrappedContentWin, aDetails, aEventCallback,
    aIsNothingOrOnCloseExists) {
  if (!aEventCallback || aIsNothingOrOnCloseExists) {
    return undefined;
  }
  if (GM_util.windowIsClosed(aWrappedContentWin)) {
    return undefined;
  }

  // Pop back onto browser thread and call event handler.
  // Have to use nested function here instead of GM_util.hitch
  // because otherwise aDetails[aEvent].apply can point to window.setTimeout,
  // which can be abused to get increased privileges.
  new XPCNativeWrapper(aWrappedContentWin, "setTimeout()")
      .setTimeout(function () {
        aEventCallback.call();
      }, 0);
};
