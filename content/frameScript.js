// The frame script for Electrolysis (e10s) compatible injection.
//   See: https://developer.mozilla.org/en-US/Firefox/Multiprocess_Firefox
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

Cu.import("resource://gre/modules/XPCOMUtils.jsm");

Cu.import("chrome://greasemonkey-modules/content/documentObserver.js");
Cu.import("chrome://greasemonkey-modules/content/GM_setClipboard.js");
Cu.import("chrome://greasemonkey-modules/content/ipcScript.js");
Cu.import("chrome://greasemonkey-modules/content/menuCommand.js");
Cu.import("chrome://greasemonkey-modules/content/miscApis.js");
Cu.import("chrome://greasemonkey-modules/content/sandbox.js");
Cu.import("chrome://greasemonkey-modules/content/scriptProtocol.js");
Cu.import("chrome://greasemonkey-modules/content/util.js");

Cu.import("chrome://greasemonkey-modules/content/processScript.js", {})
    .addFrame(this);


// \\ // \\ // \\ // \\ // \\ // \\ // \\ // \\ // \\ // \\ // \\ // \\ // \\ //

const URL_ABOUT_PART2_REGEXP = new RegExp(
    GM_CONSTANTS.urlAboutPart2Regexp, "");
const URL_USER_PASS_STRIP_REGEXP = new RegExp(
    GM_CONSTANTS.urlUserPassStripRegexp, "");

var gScope = this;
var _gEnvironment = GM_util.getEnvironment();

// \\ // \\ // \\ // \\ // \\ // \\ // \\ // \\ // \\ // \\ // \\ // \\ // \\ //

function contentObserver(aWin) {
  if (!GM_util.getEnabled()) {
    return undefined;
  }

  let doc = aWin.document;
  let url = doc.documentURI;
  if (!GM_util.isGreasemonkeyable(url)) {
    return undefined;
  }

  // Listen for whichever kind of load event arrives first.
  aWin.addEventListener("DOMContentLoaded", contentLoad, true);
  aWin.addEventListener("load", contentLoad, true);

  runScripts("document-start", aWin);
};

// \\ // \\ // \\ // \\ // \\ // \\ // \\ // \\ // \\ // \\ // \\ // \\ // \\ //

// See #1696:
// "document-element-inserted" doesn't see about:blank
// "content-document-global-created" sees about:blank,
// but:
// aSubject.document.documentURI = "about:blank"
// aData = null

// See #2229 (#2357).
// http://bugzil.la/1196270
// about:blank, the script with alert function
// - after the restart, the browser hangs
/*  
let response = gScope.sendSyncMessage("greasemonkey:is-window-visible", {});
let isWindowVisible = true;
if (response.length) {
  isWindowVisible = response[0];
}
if (!isWindowVisible) {
  return undefined;
}
*/

// http://bugzil.la/1357383
function isWindowVisible(aContentWin) {
  // let _gEnvironment = GM_util.getEnvironment();
  if (!_gEnvironment.e10s) {
    // See #2229.
    // http://bugzil.la/1196270
    if (aContentWin) {
      let winUtils = aContentWin.QueryInterface(Ci.nsIInterfaceRequestor)
          .getInterface(Ci.nsIDOMWindowUtils);
      try {
        if (winUtils && !winUtils.isParentWindowMainWidgetVisible) {
          return false;
        }
      } catch (e) {
        return false;
      }
    }
  }

  return true;
}

function browserLoadEnd(aEvent) {
  let contentWin = aEvent.target.defaultView;
  let href = contentWin.location.href;

  if (GM_util.getEnabled()) {
    // See #1820, #2371, #2195.
    if ((href == GM_CONSTANTS.urlAboutPart1)
        || (href.match(URL_ABOUT_PART2_REGEXP))) {
      if (!isWindowVisible(contentWin)) {
        return undefined;
      }
      runScripts("document-end", contentWin);
      runScripts("document-idle", contentWin);
    }
  } else {
    gScope.sendAsyncMessage("greasemonkey:DOMContentLoaded", {
      "contentType": contentWin.document.contentType,
      "href": href,
    });
  }
}

function contentLoad(aEvent) {
  var contentWin = aEvent.target.defaultView;

  // Now that we've seen any first load event, stop listening for any more.
  contentWin.removeEventListener("DOMContentLoaded", contentLoad, true);
  contentWin.removeEventListener("load", contentLoad, true);

  runScripts("document-end", contentWin);
  GM_util.timeout(function () {
    runScripts("document-idle", contentWin);
  }, 50);
}

function createScriptFromObject(aObject) {
  let script = Object.create(IPCScript.prototype);

  for (let key in aObject) {
    // if (aObject.hasOwnProperty(key)) {
      script[key] = aObject[key];
    // }
  }

  return script;
};

function injectDelayedScript(aMessage) {
  let runAt = aMessage.data.runAt;
  let windowId = aMessage.data.windowId;
  let windowMediator = Cc["@mozilla.org/appshell/window-mediator;1"]
      .getService(Ci.nsIWindowMediator);
  let win = windowMediator.getOuterWindowWithId(windowId);

  if (!win) {
    dump("Framescript: Couldn't find window with (outer?!) ID:" + " "
        + windowId + "\n");
  } else {
    let script = createScriptFromObject(aMessage.data.script);
    injectScripts([script], runAt, win);
  }
};

function injectScripts(aScripts, aRunAt, aContentWin) {
  try {
    aContentWin.QueryInterface(Ci.nsIDOMChromeWindow);
    // Never ever inject scripts into a chrome context window.
    return undefined;
  } catch (e) {
    // Ignore, it's good if we can't QI to a chrome window.
  }

  let url = urlForWin(aContentWin);
  if (!url) {
    return undefined;
  }
  let winIsTop = windowIsTop(aContentWin);

  for (let i = 0, iLen = aScripts.length; i < iLen; i++) {
    let script = aScripts[i];
    if (script.noframes && !winIsTop) {
      continue;
    }
    let sandbox = createSandbox(gScope, aContentWin, url, script, aRunAt);
    runScriptInSandbox(sandbox, script);
  }
}

function contextMenuStart(aMessage) {
  let culprit = aMessage.objects.culprit;

  while (culprit && culprit.tagName && (culprit.tagName.toLowerCase() != "a")) {
    culprit = culprit.parentNode;
  }

  aMessage.target.sendAsyncMessage(
      "greasemonkey:context-menu-end", {
        "href": culprit.href,
      });
}

function newScriptLoadStart(aMessage) {
  aMessage.target.sendAsyncMessage(
      "greasemonkey:newscript-load-end", {
        "href": content.location.href,
      });
}

function runScripts(aRunAt, aContentWin) {
  let url = urlForWin(aContentWin);
  if (!url) {
    return undefined;
  }
  if (!GM_util.isGreasemonkeyable(url)) {
    return undefined;
  }

  let scripts = IPCScript.scriptsForUrl(
      url, aRunAt, GM_util.windowId(aContentWin, "outer"));
  injectScripts(scripts, aRunAt, aContentWin);
}

function urlForWin(aContentWin) {
  if (GM_util.windowIsClosed(aContentWin)) {
    return false;
  }
  // See #1970.
  // When content does (e.g.) history.replacestate() in an inline script,
  // the location.href changes between document-start and document-end time.
  // But the content can call replacestate() much later, too.
  // The only way to be consistent is to ignore it.
  // Luckily, the document.documentURI does _not_ change,
  // so always use it when deciding whether to run scripts.
  let url = aContentWin.document.documentURI;

  // But (see #1631) ignore user/pass in the URL.
  return url.replace(URL_USER_PASS_STRIP_REGEXP, "$1");
}

function windowIsTop(aContentWin) {
  try {
    aContentWin.QueryInterface(Ci.nsIDOMWindow);
    if (aContentWin.frameElement) {
      return false;
    }
  } catch (e) {
    let url = "unknown";
    try {
      url = aContentWin.location.href;
    } catch (e) { }
    // Ignore non-DOM-windows.
    dump("Framescript: Could not QI window to nsIDOMWindow (?!) at:" + "\n"
        + url + "\n");
  }

  return true;
};

function windowCreated(aEvent) {
  if (aEvent && GM_util.getEnabled()) {
    // See #1849.
    let contentWin = aEvent.target.defaultView;
    let href = contentWin.location.href;
    // See #1820, #2371, #2195.
    if ((href == GM_CONSTANTS.urlAboutPart1)
        || (href.match(URL_ABOUT_PART2_REGEXP))) {
      if (!isWindowVisible(contentWin)) {
        return undefined;
      }
      runScripts("document-start", contentWin);
    }
  }

  onNewDocument(content, contentObserver);
}

// \\ // \\ // \\ // \\ // \\ // \\ // \\ // \\ // \\ // \\ // \\ // \\ // \\ //

addEventListener("DOMContentLoaded", browserLoadEnd, false);
addEventListener("DOMWindowCreated", windowCreated, false);

if (content) {
  windowCreated(null);
}

addMessageListener("greasemonkey:inject-delayed-script", injectDelayedScript);
addMessageListener("greasemonkey:menu-command-list", function (aMessage) {
  MenuCommandListRequest(content, aMessage);
});
addMessageListener("greasemonkey:menu-command-run", function (aMessage) {
  MenuCommandRun(content, aMessage);
});
addMessageListener("greasemonkey:context-menu-start", contextMenuStart);
addMessageListener("greasemonkey:newscript-load-start", newScriptLoadStart);

initScriptProtocol();
