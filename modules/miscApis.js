const EXPORTED_SYMBOLS = [
    "GM_addStyle", "GM_console", "GM_Resources", "GM_ScriptLogger",
    "GM_window"];

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

Cu.import("chrome://greasemonkey-modules/content/prefManager.js");
Cu.import("chrome://greasemonkey-modules/content/util.js");


// \\ // \\ // \\ // \\ // \\ // \\ // \\ // \\ // \\ // \\ // \\ // \\ // \\ //

function GM_addStyle(aWrappedContentWin, aFileURL, aRunAt, aCss) {
  var elementName = "head";

  aCss = String(aCss);

  function addStyle(aDoc, aHead, aCss) {
    let style = aDoc.createElement("style");

    style.textContent = aCss;
    style.type = "text/css";
    aHead.appendChild(style);

    return style;
  }

  var doc = aWrappedContentWin.document;
  if (!doc) {
    return null;
  }
  let head = doc.getElementsByTagName(elementName)[0];
  if (head) {
    return addStyle(doc, head, aCss);
  } else if (aRunAt == "document-start") {
    // See #2515 and #1849.
    // http://bugzil.la/1333990
    try {
      let MutationObserver = aWrappedContentWin.MutationObserver;
      var observer = new MutationObserver(function (aMutations) {
        aMutations.forEach(function (aMutation) {
          let addedNodes = aMutation.addedNodes;
          for (let i = 0, iLen = addedNodes.length; i < iLen; i++) {
            let node = addedNodes[i];
            if ((node.nodeType == 1)
                && (node.nodeName.toLowerCase() == elementName)) {
              observer.disconnect();
              addStyle(doc, node, aCss);
              break;
            }
          }
        });
      });
      observer.observe(doc, {
        "attributes": true,
        "childList": true,
        "subtree": true,
      });
    } catch (e) {
      throw new aWrappedContentWin.Error(e.message, aFileURL, null);
    }
  }

  return null;
}

// \\ // \\ // \\ // \\ // \\ // \\ // \\ // \\ // \\ // \\ // \\ // \\ // \\ //

function GM_console(aScript) {
  // Based on:
  // http://www.getfirebug.com/firebug/firebugx.js
  let names = [
    "debug", "warn", "error", "info", "assert", "dir", "dirxml",
    "group", "groupEnd", "time", "timeEnd", "count", "trace", "profile",
    "profileEnd"
  ];

  for (let i = 0, iLen = names.length; i < iLen; i++) {
    let name = names[i];
    this[name] = function () {};
  }

  // Important to use this private variable so that user scripts
  // can't make this call something else by redefining <this> or <logger>.
  var logger = new GM_ScriptLogger(aScript);
  this.log = function () {
    logger.log(
      Array.prototype.slice.apply(arguments).join("\n")
    );
  };
}

GM_console.prototype.log = function () {};

// \\ // \\ // \\ // \\ // \\ // \\ // \\ // \\ // \\ // \\ // \\ // \\ // \\ //

function GM_Resources(aScript) {
  this.script = aScript;
}

GM_Resources.prototype.getResourceText = function (
    aWrappedContentWin, aSandbox, aFileURL, aName, aResponseType) {
  // Verify the existence of the resource.
  let dep = this._getDependency(aWrappedContentWin, aFileURL, aName);
  if (typeof dep.textContent != "undefined") {
    return dep.textContent;
  }
  return Cu.cloneInto(GM_util.fileXhr(
      dep.file_url, "text/plain", aResponseType), aSandbox);
};

GM_Resources.prototype.getResourceURL = function (
    aWrappedContentWin, aSandbox, aScript, aName) {
  // Verify the existence of the resource.
  let dep = this._getDependency(aWrappedContentWin, aScript.fileURL, aName);
  return [
    GM_CONSTANTS.addonScriptProtocolScheme + ":",
    aScript.uuid,
    GM_CONSTANTS.addonScriptProtocolSeparator, aName
  ].join("");
};

GM_Resources.prototype._getDependency = function (
    aWrappedContentWin, aFileURL, aName) {
  let resources = this.script.resources;
  for (var i = 0, iLen = resources.length; i < iLen; i++) {
    let resource = resources[i];
    if (resource.name == aName) {
      return resource;
    }
  }

  throw new aWrappedContentWin.Error(
      GM_CONSTANTS.localeStringBundle.createBundle(
          GM_CONSTANTS.localeGreasemonkeyProperties)
          .GetStringFromName("error.missingResource")
          .replace("%1", aName),
          aFileURL, null
      );
};

// \\ // \\ // \\ // \\ // \\ // \\ // \\ // \\ // \\ // \\ // \\ // \\ // \\ //

function GM_ScriptLogger(aScript) {
  let namespace = aScript.namespace;

  if (namespace.substring(namespace.length - 1) != "/") {
    namespace += "/";
  }

  this.prefix = [namespace, aScript.name, ": "].join("");
}

GM_ScriptLogger.prototype.consoleService = Cc["@mozilla.org/consoleservice;1"]
    .getService(Ci.nsIConsoleService);

GM_ScriptLogger.prototype.log = function (aMessage) {
  // https://developer.mozilla.org/en-US/docs/XPCOM_Interface_Reference/nsIConsoleService#logStringMessage()
  // - wstring / wide string
  this.consoleService.logStringMessage((this.prefix + "\n" + aMessage)
      .replace(new RegExp("\\0", "g"), ""));
};

// \\ // \\ // \\ // \\ // \\ // \\ // \\ // \\ // \\ // \\ // \\ // \\ // \\ //

function GM_window(aFrame, aFileURL, aWhat) {
  aFrame.sendAsyncMessage("greasemonkey:window", {
    "fileURL": aFileURL,
    "what": aWhat,
  });
};
