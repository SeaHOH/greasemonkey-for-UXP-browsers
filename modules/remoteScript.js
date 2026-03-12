const EXPORTED_SYMBOLS = ["cleanFilename", "RemoteScript"];

if (typeof Cc === "undefined") {
  var Cc = Components.classes;
}
if (typeof Ci === "undefined") {
  var Ci = Components.interfaces;
}
if (typeof Cu === "undefined") {
  var Cu = Components.utils;
}
if (typeof Cr === "undefined") {
  var Cr = Components.results;
}

Cu.import("chrome://greasemonkey-modules/content/constants.js");

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");

Cu.import("resource://gre/modules/NetUtil.jsm");
Cu.import("resource://gre/modules/PrivateBrowsingUtils.jsm");

Cu.import("chrome://greasemonkey-modules/content/addons.js");
Cu.import("chrome://greasemonkey-modules/content/GM_notification.js");
Cu.import("chrome://greasemonkey-modules/content/script.js");
Cu.import("chrome://greasemonkey-modules/content/scriptIcon.js");
Cu.import("chrome://greasemonkey-modules/content/util.js");


const CALLBACK_IS_NOT_FUNCTION = "callback is not a function.";

const TIMEOUT = 500;

const FILENAME_DISALLOWED_CHARACTERS_REGEXP = new RegExp(
    "[\\\\/:*?'\"<>|]", "g");

const FILENAME_REGEXP = new RegExp(
    "^(.+?)("
    + GM_CONSTANTS.fileScriptExtensionRegexp
    + "|[^.{,8}])$", "");

// https://msdn.microsoft.com/en-us/library/aa365247.aspx#maxpath
// Actual limit is 260; 240 ensures e.g. ".user.js" and slashes still fit.
// The "/ 2" thing is so that we can have a directory, and a file in it.
var gWindowsNameMaxLen = (240 - GM_util.scriptDir().path.length) / 2;

/////////////////////////////// Private Helpers ////////////////////////////////

function assertIsFunction(aFunc, aMessage) {
  if (typeof aFunc != typeof function () {}) {
    throw new Error(aMessage);
  }
}

function cleanFilename(aFilename, aDefault) {
  // Blacklist problem characters (slashes, colons, etc.).
  let filename = (aFilename || aDefault)
      .replace(FILENAME_DISALLOWED_CHARACTERS_REGEXP, "");

  // Make whitespace readable.
  filename = filename.replace(new RegExp("(\\s|%20)+", "g"), "_");

  // See #1548.
  // https://msdn.microsoft.com/en-us/library/aa365247.aspx#maxpath
  // Limit length on Windows.
  if (GM_CONSTANTS.xulRuntime.OS == "WINNT") {
    if (gWindowsNameMaxLen <= 0) {
      throw new Error(
          "remoteScript - cleanFilename:" + "\n"
          + GM_CONSTANTS.localeStringBundle.createBundle(
              GM_CONSTANTS.localeGreasemonkeyProperties)
              .GetStringFromName("error.remoteScript.notMakeValidFileName"));
    }
    
    let match = filename.match(FILENAME_REGEXP);
    if (match) {
      filename = match[1].substr(0, gWindowsNameMaxLen) + match[2];
    } else {
      filename = filename.substr(0, gWindowsNameMaxLen);
    }
  }

  // Ensure that it's something.
  if (!filename) {
    filename = aDefault || "unknown";
  }

  return filename;
}

function filenameFromUri(aUri, aDefault) {
  let filename = "";
  let url;
  try {
    url = aUri.QueryInterface(Ci.nsIURL);
    filename = url.fileName;
  } catch (e) {
    dump("remoteScript - filenameFromUri:" + "\n" + e + "\n");
  }

  return cleanFilename(filename, aDefault);
}

////////////////////////// Private Download Listener ///////////////////////////

function DownloadListener(
    aTryToParse, aProgressCb, aCompletionCallback, aFile, aUri, aRemoteScript,
    aErrorsAreFatal) {
  this._completionCallback = aCompletionCallback;
  this._data = [];
  this._errorsAreFatal = (typeof aErrorsAreFatal == "undefined")
      ? true : aErrorsAreFatal;
  this._progressCallback = aProgressCb;
  this._remoteScript = aRemoteScript;
  this._tryToParse = aTryToParse;
  this._uri = aUri;

  this._fileOutputStream = Cc["@mozilla.org/network/file-output-stream;1"]
      .createInstance(Ci.nsIFileOutputStream);
  this._fileOutputStream.init(aFile, -1, -1, null);
  if (aTryToParse) {
    // UTF-8 BOM.
    this._fileOutputStream.write(
        GM_CONSTANTS.scriptParseBOM, GM_CONSTANTS.scriptParseBOMArray.length);
  }
  this._binOutputStream = Cc["@mozilla.org/binaryoutputstream;1"]
      .createInstance(Ci.nsIBinaryOutputStream);
  this._binOutputStream.setOutputStream(this._fileOutputStream);
}

DownloadListener.prototype = {
  "_parse": function (aRemoteScript) {
    let converter = Cc["@mozilla.org/intl/scriptableunicodeconverter"]
        .createInstance(Ci.nsIScriptableUnicodeConverter);
    converter.charset = GM_CONSTANTS.fileScriptCharset;
    let source = "";
    try {
      source = converter.convertFromByteArray(this._data, this._data.length);
    } catch (e) {}

    return this._remoteScript.parseScript(source, true);
  },

  // nsIStreamListener.
  "onDataAvailable": function (
      aRequest, aContext, aInputStream, aOffset, aCount) {
    let binaryInputStream = Cc["@mozilla.org/binaryinputstream;1"]
        .createInstance(Ci.nsIBinaryInputStream);
    binaryInputStream.setInputStream(aInputStream);

    // Read incoming data.
    let data = binaryInputStream.readByteArray(aCount);

    if (this._tryToParse) {
      // See #1823.
      // Strip UTF-8 BOM(s) at the very start of the file.
      // See also GM_CONSTANTS.scriptParseBOM
      while (data && (data.length >= GM_CONSTANTS.scriptParseBOMArray.length)
          && (data[0] == GM_CONSTANTS.scriptParseBOMArray[0])
          && (data[1] == GM_CONSTANTS.scriptParseBOMArray[1])
          && (data[2]) == GM_CONSTANTS.scriptParseBOMArray[2]) {
        data = data.slice(GM_CONSTANTS.scriptParseBOMArray.length);
      }

      this._data = this._data.concat(data);
      this._tryToParse = !this._parse(aContext);
    } else {
      this._data = null;
    }

    // Write it to the file.
    this._binOutputStream.writeByteArray(data, data.length);
  },

  // nsIProgressEventSink.
  "onProgress": function (aRequest, aContext, aProgress, aProgressMax) {
    let progress;
    if ((aProgressMax == -1) || (aProgressMax == 0)
        || (aProgressMax == 0xFFFFFFFFFFFFFFFF)) {
      progress = 0;
    } else {
      progress = aProgress / aProgressMax;
    }
    this._progressCallback(aRequest, progress);
  },

  // nsIRequestObserver.
  "onStartRequest": function (aRequest, aContext) {
    // For the first file (the script) detect an HTML page and abort if so.
    if (this._tryToParse) {
      let contentType = false;
      try {
        aRequest.QueryInterface(Ci.nsIHttpChannel);
      } catch (e) {
        // Non-http channel?
        // Ignore.
        return undefined;
      }
      try {
        contentType = new RegExp(
            GM_CONSTANTS.fileScriptContentTypeNoRegexp, "i")
            .test(aRequest.contentType);
      } catch (e) {
        // Problem loading page (Unable to connect)?
        // Ignore.
        return undefined;
      }
      if (contentType) {
        // Cancel this request immediately
        // and let onStopRequest handle the cleanup for everything else.
        let httpChannel;
        let status;
        try {
          httpChannel = aRequest.QueryInterface(Ci.nsIHttpChannel);
          status = httpChannel.responseStatus;
        } catch (e) {
          // Ignore.
        }
        if (GM_CONSTANTS.installScriptBadStatus(status, true)) {
          aRequest.cancel(Cr.NS_BINDING_FAILED);
        } else {
          aRequest.cancel(Cr.NS_BINDING_ABORTED);
        }
      }
    }
  },

  // nsIRequestObserver
  "onStopRequest": function (aRequest, aContext, aStatusCode) {
    this._binOutputStream.close();
    this._fileOutputStream.close();

    let httpChannel;
    let error = !Components.isSuccessCode(aStatusCode);
    let errorMessage = GM_CONSTANTS.localeStringBundle.createBundle(
        GM_CONSTANTS.localeGreasemonkeyProperties)
        .GetStringFromName("error.unknown");
    let status = -1;
    let headers = {};
    let headersProp = ["Retry-After"];
    let _headers = "";
    try {
      httpChannel = aRequest.QueryInterface(Ci.nsIHttpChannel);
      error |= !httpChannel.requestSucceeded;
      error |= httpChannel.responseStatus >= 400;
      status = httpChannel.responseStatus;
      for (let i = 0, iLen = headersProp.length; i < iLen; i++) {
        try {
          headers[headersProp[i]] = httpChannel
              .getResponseHeader(headersProp[i]);
        } catch (e) {
          // Ignore.
        }
      }
      Object.getOwnPropertyNames(headers).forEach(function (aProp) {
        _headers += "\n" + '"' + aProp + '": "' + headers[aProp] + '"';
      });
      errorMessage = GM_CONSTANTS.localeStringBundle.createBundle(
          GM_CONSTANTS.localeGreasemonkeyProperties)
          .GetStringFromName("error.serverReturned")
          + " " + httpChannel.responseStatus + " "
          + httpChannel.responseStatusText + "."
          + ((_headers != "") ? "\n" + _headers : "");
    } catch (e) {
      try {
        aRequest.QueryInterface(Ci.nsIFileChannel);
        // No-op.
        // If it got this far, aStatus is accurate.
      } catch (e) {
        dump("remoteScript - DownloadListener - onStopRequest" + "\n"
            + "- aRequest is neither http nor file channel:" + "\n"
            + aRequest + "\n");
        for (let i in Ci) {
          try {
            aRequest.QueryInterface(Ci[i]);
            dump("it is a: " + i + "\n");
          } catch (e) {
            // Ignore.
          }
        }
      }
    }

    if (error && this._errorsAreFatal) {
      errorMessage = GM_CONSTANTS.localeStringBundle.createBundle(
          GM_CONSTANTS.localeGreasemonkeyProperties)
          .GetStringFromName("error.downloadingUrl")
          + "\n" + this._uri.spec + "\n\n" + errorMessage;
    }

    this._progressCallback(aRequest, 1);
    this._completionCallback(
        aRequest, !error, errorMessage, status, headers);
  },

  // nsIProgressEventSink.
  "onStatus": function (aRequest, aContext, aStatus, aStatusArg) {},

  // nsIInterfaceRequestor.
  "getInterface": function (aIiD) {
    return this.QueryInterface(aIiD);
  },

  // nsISupports.
  "QueryInterface": XPCOMUtils.generateQI([
    Ci.nsIProgressEventSink,
    Ci.nsIStreamListener,
    Ci.nsISupports,
  ]),
};

/////////////////////////////// Public Interface ///////////////////////////////

// Note: The design of this class is very asynchronous,
// with the result that the code path spaghetti's through quite a few callbacks.
// A necessary evil.

function RemoteScript(aUrl) {
  this._baseName = null;
  this._cancelled = false;
  this._channels = [];
  this._dependencies = [];
  this._metadata = null;
  this._progress = [0, 0];
  this._progressCallbacks = [];
  this._progressIndex = 0;
  this._scriptFile = null;
  this._scriptMetaCallbacks = [];
  this._silent = false;
  this._tempDir = GM_util.getTempDir();
  this._uri = GM_util.getUriFromUrl(aUrl);
  this._url = aUrl;

  this.done = false;
  this.errorMessage = null;
  this.messageName = "script.installed";
  this.script = null;
}

Object.defineProperty(RemoteScript.prototype, "url", {
  "get": function RemoteScript_getUrl() {
    return new String(this._url);
  },
  "enumerable": true,
});

RemoteScript.prototype.cancel = function () {
  this._cancelled = true;
  this.cleanup();
};

// Clean up all temporary files, stop all actions.
RemoteScript.prototype.cleanup = function (aErrorMessage) {
  this.errorMessage = null;
  // See #2327.
  if (aErrorMessage && (typeof aErrorMessage != "object")) {
    this.errorMessage = aErrorMessage;
  }
  this.done = true;

  this._channels.forEach(function (aChannel) {
    try {
      aChannel.QueryInterface(Ci.nsIRequest);
    } catch (e) {
      return undefined;
    }
    aChannel.cancel(Cr.NS_BINDING_ABORTED);
  });
  if (this._tempDir && this._tempDir.exists()) {
    var _RemoteScript_Cleanup_tempDir = this._tempDir;
    GM_util.timeout(function () {
      if (_RemoteScript_Cleanup_tempDir
          && _RemoteScript_Cleanup_tempDir.exists()) {
        try {
          _RemoteScript_Cleanup_tempDir.remove(true);
        } catch (e) {
          // Ignore.
        }
      }
      GM_util.timeout(function () {
        if (_RemoteScript_Cleanup_tempDir
            && _RemoteScript_Cleanup_tempDir.exists()) {
          GM_util.enqueueRemove(_RemoteScript_Cleanup_tempDir, true);
        }
      }, TIMEOUT);
    }, TIMEOUT);
  }

  this._dispatchCallbacks("progress", 1);
};

// Download the entire script, starting from the .user.js itself.
RemoteScript.prototype.download = function (aCompletionCallback) {
  aCompletionCallback = aCompletionCallback || function () {};
  assertIsFunction(
      aCompletionCallback,
      "RemoteScript.download: Completion " + CALLBACK_IS_NOT_FUNCTION);

  if (this.script) {
    this._downloadDependencies(aCompletionCallback);
  } else {
    this.downloadScript(
        GM_util.hitch(this, function (aSuccess, aPoint, aStatus, aHeaders) {
          if (aSuccess) {
            this._downloadDependencies(aCompletionCallback);
          }
          aCompletionCallback(
              this._cancelled || aSuccess, aPoint, aStatus, aHeaders);
        }));
  }
};

// Download just the .user.js itself. Callback upon completion.
RemoteScript.prototype.downloadScript = function (aCompletionCallback) {
  assertIsFunction(
      aCompletionCallback,
      "RemoteScript.downloadScript: Completion " + CALLBACK_IS_NOT_FUNCTION);
  if (!this._url) {
    throw new Error(
        "RemoteScript.downloadScript: "
        + "Tried to download script, but have no URL.");
  }

  this._scriptFile = GM_util.getTempFile(
      this._tempDir, filenameFromUri(this._uri, GM_CONSTANTS.fileScriptName));

  this._downloadFile(this._uri, this._scriptFile,
      GM_util.hitch(this, this._downloadScriptCb, aCompletionCallback),
      true); // aErrorsAreFatal.
};

RemoteScript.prototype.install = function (aOldScript, aOnlyDependencies) {
  if (!this.script) {
    throw new Error(
        GM_CONSTANTS.localeStringBundle.createBundle(
            GM_CONSTANTS.localeGreasemonkeyProperties)
            .GetStringFromName("error.remoteScript.notDownloaded"));
  }
  // Part 2/3 (install.js - Part 1/3, remoteScript.js - Part 3/3).
  if (!this._tempDir) {
    return undefined;
  }
  if (typeof aOnlyDependencies == "undefined") {
    aOnlyDependencies = false;
  }

  if (aOnlyDependencies) {
    // Just move the dependencies in.
    for (let i = 0, iLen = this._dependencies.length; i < iLen; i++) {
      let dep = this._dependencies[i];
      // Make sure this is actually a file, not a data URI.
      if (!dep._filename) {
        continue;
      }

      // See #1906.
      // Grab a unique file name to ensure we don't overwrite the script
      // in case it has the same name as one of the dependencies.
      let target = GM_util.getTempFile(this.script.baseDirFile, dep.filename);

      let file = this._tempDir.clone();
      file.append(dep.filename);
      file.moveTo(this.script.baseDirFile, target.leafName);

      dep.setFilename(target);
    }

    // Only delete the temporary directory if it's empty.
    try {
      this._tempDir.remove(false);
    } catch (e) {
      // Silently ignore.
    }

    // Part 1/2 (script.js - Part 2/2).
    // The fix update icon in the AOM (after a change in the editor).
    // ScriptAddonFactoryByScript(this.script, true);
    this.script._changed("modified", this.script.id);
  } else {
    // Completely install the new script.
    if (!this._baseName) {
      throw new Error(
          GM_CONSTANTS.localeStringBundle.createBundle(
              GM_CONSTANTS.localeGreasemonkeyProperties)
              .GetStringFromName("error.remoteScript.nameUnknown"));
    }

    GM_util.getService().config.install(this.script, aOldScript, this._tempDir);

    var suffix = 0;
    var file = GM_util.scriptDir();
    file.append(this._baseName);
    // See #2400.
    while (file.exists()
        || (file.leafName.substr(
            file.leafName.length - GM_CONSTANTS.fileScriptDBExtension.length)
            .toLowerCase() == GM_CONSTANTS.fileScriptDBExtension)) {
      suffix++;
      file = GM_util.scriptDir();
      file.append(this._baseName + "-" + suffix);
    }
    this._baseName = file.leafName;

    this.script.setFilename(this._baseName, this._scriptFile.leafName);
    // this._tempDir.moveTo(GM_util.scriptDir(), this._baseName);
    /*
    Part 3/3 (install.js - Part 1/3, remoteScript.js - Part 2/3).
    See #1919.
    Sometimes - throws an errors:
      NS_ERROR_FILE_IS_LOCKED: Component returned failure code:
        0x8052000e (NS_ERROR_FILE_IS_LOCKED) [nsIFile.moveTo]
        remoteScript.js
    */
    let _baseName = this._baseName;
    try {
      this._tempDir.moveTo(GM_util.scriptDir(), _baseName);
    } catch (e if (e.name == "NS_ERROR_FILE_IS_LOCKED")) {
      GM_util.timeout(function () {
        try {
          this._tempDir.moveTo(GM_util.scriptDir(), _baseName);
        } catch (e) {
          throw new Error(
              "RemoteScript.install:" + "\n"
              + e.description + "\n"
              + 'tempDir.moveTo: "' + _baseName + '"',
              e.fileName, e.lineNumber);
        }
      }, TIMEOUT);
    }
    this._tempDir = null;

    this.script.fixTimestampsOnInstall();
    this.script.checkConfig();

    // Now that we've fully populated the new state, update the AOM
    // and config data based on that.
    ScriptAddonFactoryByScript(this.script, true);
    this.script._changed("modified", this.script.id);

    // Let the user know we're all done.
    if (!this._silent) {
      let notificationOptions = null;
      if (this.messageName == "script.updated") {
        notificationOptions = {
          "persistence": -1,
          "persistWhileVisible": true,
          "learnMoreURL": this.script.homepageURL,
        };
      }
      GM_notification(
          "(" + this.script.localized.name + ") "
          + GM_CONSTANTS.localeStringBundle.createBundle(
              GM_CONSTANTS.localeGmBrowserProperties)
              .GetStringFromName(this.messageName),
          this.messageName, notificationOptions);
    }
  }
};

// Add a progress callback.
RemoteScript.prototype.onProgress = function (aCallback) {
  assertIsFunction(aCallback, "Progress " + CALLBACK_IS_NOT_FUNCTION);
  this._progressCallbacks.push(aCallback);
};

// Add a "script meta data is available" callback.
RemoteScript.prototype.onScriptMeta = function (aCallback) {
  assertIsFunction(aCallback, "Script meta " + CALLBACK_IS_NOT_FUNCTION);
  this._scriptMetaCallbacks.push(aCallback);
};

// Parse the source code of the script, discover dependencies, data & etc.
RemoteScript.prototype.parseScript = function (aSource, aFatal) {
  if (this.errorMessage) {
    return false;
  }
  if (this.script) {
    return true;
  }

  let scope = {};
  Cu.import("chrome://greasemonkey-modules/content/parseScript.js", scope);
  let script = scope.parse(aSource, this._uri, aFatal);
  if (!script || script.parseErrors.length) {
    if (!aFatal) {
      this.cleanup(
          GM_CONSTANTS.localeStringBundle.createBundle(
              GM_CONSTANTS.localeGreasemonkeyProperties)
              .GetStringFromName("error.parsingScript")
          + "\n" + (
              script
              ? script.parseErrors
              : stringBundle.GetStringFromName("error.unknown")
          ));
    }
    return false;
  }

  this._baseName = cleanFilename(script.name, GM_CONSTANTS.fileScriptName);
  this._dispatchCallbacks("scriptMeta", script);
  this.script = script;
  this._postParseScript();

  return true;
};

/**
 * Set the (installed) script, in order to download modified dependencies.
 *
 * After calling this, calling .download() will only get dependencies.
 * This RemoteScript can then safely be .install(oldScript)'ed.
 */
RemoteScript.prototype.setScript = function (aScript, aTempFile) {
  this._scriptFile = aScript.file;
  this._baseName = aScript._basedir;
  this.script = aScript;
  if (aTempFile) {
    // Special case for "new script" dialog.
    this._scriptFile = aTempFile;
    this._baseName = cleanFilename(aScript.name, GM_CONSTANTS.fileScriptName);
  }
  this._postParseScript();
};

RemoteScript.prototype.setSilent = function (aVal) {
  this._silent = !!aVal;
};

RemoteScript.prototype.showSource = function (aBrowser) {
  if (this._progress[0] < 1) {
    throw new Error(
        "RemoteScript.showSource: Script is not loaded.");
  }

  let tabBrowser = null;
  try {
    // The "new script" dialog.
    tabBrowser = aBrowser.getTabBrowser();
  } catch (e) {
    // The context menu.
    tabBrowser = aBrowser.ownerDocument.defaultView.gBrowser;
  }
  let tab = tabBrowser.addTab(
      GM_CONSTANTS.ioService.newFileURI(this._scriptFile).spec);
  tabBrowser.selectedTab = tab;

  // Ensure any temporary files are deleted after the tab is closed.
  var cleanup = GM_util.hitch(this, "cleanup");
  tab.addEventListener("TabClose", cleanup, false);

  let buttons = [];
  buttons.push({
    "accessKey": GM_CONSTANTS.localeStringBundle.createBundle(
        GM_CONSTANTS.localeGmBrowserProperties)
        .GetStringFromName("greeting.btnAccess"),
    "callback": GM_util.hitch(this, function () {
      GM_util.showInstallDialog(this, tabBrowser);
      // Skip the cleanup handler, as the downloaded files
      // are used in the installation process.
      tab.removeEventListener("TabClose", cleanup, false);
      // Timeout puts this after the notification closes itself
      // for the button click, avoiding an error inside that (Pale Moon) code.
      GM_util.timeout(function () {
        tabBrowser.removeTab(tab);
      }, 0);
    }),
    "label": GM_CONSTANTS.localeStringBundle.createBundle(
        GM_CONSTANTS.localeGmBrowserProperties)
        .GetStringFromName("greeting.btn"),
    "popup": null,
  });

  // See #2348.
  let notificationBox = tabBrowser.getNotificationBox();
  let notification = notificationBox.appendNotification(
      GM_CONSTANTS.localeStringBundle.createBundle(
          GM_CONSTANTS.localeGmBrowserProperties)
          .GetStringFromName("greeting.msg"),
      "greasemonkey-install-userscript",
      "chrome://greasemonkey/skin/icon16.png",
      notificationBox.PRIORITY_WARNING_MEDIUM,
      buttons
    );
  notification.persistence = -1;
};

RemoteScript.prototype.toString = function () {
  return "[RemoteScript object; " + this._url + "]";
};

//////////////////////////// Private Implementation ////////////////////////////

RemoteScript.prototype._dispatchCallbacks = function (aType, aData) {
  let callbacks = this["_" + aType + "Callbacks"];
  if (!callbacks) {
    throw new Error(
        "RemoteScript._dispatchCallbacks - Invalid callback type: " + aType);
  }
  for (let i = 0, iLen = callbacks.length; i < iLen; i++) {
    let callback = callbacks[i];
    callback(this, aType, aData);
  }
};

// Download any dependencies (@icon, @require, @resource).
RemoteScript.prototype._downloadDependencies = function (aCompletionCallback) {
  if (this.done) {
    return undefined;
  }

  this._progressIndex++;
  if (this._progressIndex > this._dependencies.length) {
    this.done = true;
    // Always call the callback asynchronously.
    // That way, the caller doesn't have to take special care of the case
    // where this is called synchronously when there is nothing to download.
    GM_util.timeout(GM_util.hitch(this, function () {
      this._dispatchCallbacks("progress", 1);
      aCompletionCallback(true, "dependencies");
    }), 0);
    return undefined;
  }

  // Because _progressIndex includes the base script at 0,
  // subtract one to get the dependency index.
  var dependency = this._dependencies[this._progressIndex - 1];
  let uri = GM_util.getUriFromUrl(dependency.downloadURL);
  let file = GM_util.getTempFile(
      this._tempDir, filenameFromUri(uri, GM_CONSTANTS.fileScriptName));
  dependency.setFilename(file);

  function dependencyDownloadComplete(aChannel, aSuccess, aErrorMessage) {
    if (!aSuccess) {
      if (dependency instanceof ScriptIcon) {
        // Ignore the failure to download the icon.
      } else {
        this.cleanup(aErrorMessage);
        aCompletionCallback(aSuccess, "dependency");
        return undefined;
      }
    }
    if (dependency.setCharset) {
      dependency.setCharset(aChannel.contentCharset || null);
    }
    if (dependency.setMimetype) {
      dependency.setMimetype(aChannel.contentType);
    }
    this._downloadDependencies(aCompletionCallback);
  }

  this._downloadFile(
      uri, file, GM_util.hitch(this, dependencyDownloadComplete),
      !(dependency instanceof ScriptIcon)); // aErrorsAreFatal.
};

// Download a given nsIURI to a given nsIFile, with optional callback.
RemoteScript.prototype._downloadFile = function (
    aUri, aFile, aCompletionCallback, aErrorsAreFatal) {
  aUri = aUri.QueryInterface(Ci.nsIURI);
  aFile = aFile.QueryInterface(Ci.nsIFile);
  aCompletionCallback = aCompletionCallback || function () {};
  assertIsFunction(aCompletionCallback,
      "RemoteScript._downloadFile: Completion " + CALLBACK_IS_NOT_FUNCTION);

  // If we have a URI (locally installed scripts, when updating, won't)...
  if (this._uri) {
    if (aUri == this._uri) {
      // No-op, always download the script itself.
    } else if (aUri.scheme == this._uri.scheme) {
      // No-op, always allow files from the same scheme as the script.
    } else if (!GM_util.isGreasemonkeyable(aUri.spec)) {
      // Otherwise, these are unsafe.
      // Do not download them.
      this.cleanup(
          GM_CONSTANTS.localeStringBundle.createBundle(
              GM_CONSTANTS.localeGreasemonkeyProperties)
              .GetStringFromName("error.remoteScript.unsafeUrl")
              .replace("%1", aUri.spec));
      return undefined;
    }
  }

  // Construct a channel with a policy type
  // that the HTTP observer is designed to ignore,
  // so it won't intercept this network call.
  let channel = NetUtil.newChannel({
    "contentPolicyType": Ci.nsIContentPolicy.TYPE_OBJECT_SUBREQUEST,
    "loadUsingSystemPrincipal": true,
    "uri": aUri,
  });
  // When cache is used (*.user.js, e.g. MIME type: text/html):
  // 1. It creates temporary folder ("gm-temp-...") - permanently (see #2069).
  // 2. Infinite loading web page (see #2407).
  // But see also:
  // https://github.com/OpenUserJs/OpenUserJS.org/issues/1066
  // Pale Moon 27.2.x-
  // https://github.com/MoonchildProductions/Pale-Moon/pull/1002
  // Firefox 41.0-
  // http://bugzil.la/1170197
  // (http://bugzil.la/1166133)
  if (((Services.appinfo.ID == GM_CONSTANTS.browserIDPalemoon)
      && (GM_util.compareVersion("27.3.0a1", "20170405000000") < 0))
      || ((Services.appinfo.ID == GM_CONSTANTS.browserIDFirefox)
      && (GM_util.compareVersion("42.0a1", "20150702030207") < 0))) {
    channel.loadFlags |= channel.LOAD_BYPASS_CACHE;
  }
  // See #1717.
  // A page with a userscript - http auth.
  // Private Browsing, Containers (Firefox 42+).
  let privateMode = true;
  let userContextId = null;
  let chromeWin = GM_util.getBrowserWindow();
  if (chromeWin && chromeWin.gBrowser) {
    // i.e. the Private Browsing autoStart pref:
    // "browser.privatebrowsing.autostart"
    privateMode = PrivateBrowsingUtils.isBrowserPrivate(chromeWin.gBrowser);
    /*
    if (chromeWin.gBrowser.selectedBrowser
        && chromeWin.gBrowser.selectedBrowser.contentPrincipal
        && chromeWin.gBrowser.selectedBrowser.contentPrincipal.originAttributes
        && chromeWin.gBrowser.selectedBrowser.contentPrincipal.originAttributes
            .userContextId) {
      userContextId = chromeWin.gBrowser.selectedBrowser.contentPrincipal
          .originAttributes.userContextId;
    }
    */
  }
  if (userContextId === null) {
    if (channel instanceof Ci.nsIPrivateBrowsingChannel) {
      if (privateMode) {
        channel = channel.QueryInterface(Ci.nsIPrivateBrowsingChannel);
        channel.setPrivate(true);
      }
    }
  } else {
    req.setOriginAttributes({
      "privateBrowsingId": privateMode ? 1 : 0,
      // "userContextId": userContextId,
    });
  }
  /*
  dump("RemoteScript._downloadFile - url:" + "\n" + aUri.spec + "\n"
      + "Private Browsing mode: " + req.channel.isChannelPrivate + "\n");
  */
  this._channels.push(channel);
  let dsl = new DownloadListener(
      this._progressIndex == 0, // aTryToParse.
      GM_util.hitch(this, this._downloadFileProgress),
      aCompletionCallback,
      aFile,
      aUri,
      this,
      aErrorsAreFatal);
  channel.notificationCallbacks = dsl;
  channel.asyncOpen(dsl, this);
};

RemoteScript.prototype._downloadFileProgress = function (
    aChannel, aFileProgress) {
  this._progress[this._progressIndex] = aFileProgress;
  let progress = this._progress.reduce(function (a, b) {
    return a + b;
  }) / this._progress.length;
  this._dispatchCallbacks("progress", progress);
};

RemoteScript.prototype._downloadScriptCb = function (
    aCompletionCallback, aChannel, aSuccess, aErrorMessage, aStatus, aHeaders) {
  if (aSuccess) {
    // At this point downloading the script itself is definitely done.

    // Parse the script.
    try {
      this._parseScriptFile();
    } catch (e) {
      // If that failed, set the error message, and...
      if (new String(e).indexOf("Unicode") === -1) {
        this.cleanup(
            GM_CONSTANTS.localeStringBundle.createBundle(
            GM_CONSTANTS.localeGreasemonkeyProperties)
            .GetStringFromName("error.unknown"));
      } else {
        this.cleanup(
            GM_CONSTANTS.localeStringBundle.createBundle(
            GM_CONSTANTS.localeGreasemonkeyProperties)
            .GetStringFromName("error.scriptCharset"));
      }
    }

    if (this.errorMessage) {
      // Fake a successful download,
      // so the install window will show, with the error message.
      this._dispatchCallbacks("scriptMeta", new Script());
      return aCompletionCallback(true, "script", aStatus, aHeaders);
    }

    if (!this.script) {
      dump("RemoteScript._downloadScriptCb:" + " "
          + "Finishing with error because no script was found." + "\n");
      // If we STILL don't have a script, this is a fatal error.
      return aCompletionCallback(false, "script", aStatus, aHeaders);
    }
  } else {
    this.cleanup(aErrorMessage);
    // https://github.com/OpenUserJs/OpenUserJS.org/issues/1066
    if (aErrorMessage
        && GM_CONSTANTS.installScriptBadStatus(aStatus, true)) {
      // Fake a successful download,
      // so the install window will show, with the error message.
      this._dispatchCallbacks("scriptMeta", new Script());
      return aCompletionCallback(true, "script", aStatus, aHeaders);
    }
  }

  aCompletionCallback(aSuccess, "script", aStatus, aHeaders);
};

RemoteScript.prototype._parseScriptFile = function () {
  if (this.done) {
    return undefined;
  }
  let source = GM_util.getContents(this._scriptFile, null, true);
  if (!source) {
    return null;
  }
  let script = null;
  try {
    this.parseScript(source, false);
  } catch (e) {
    dump("RemoteScript._parseScriptFile:" + "\n" + e + "\n");
  }

  return script;
};

RemoteScript.prototype._postParseScript = function () {
  this._dependencies = this.script.dependencies;
  this._progress = [];
  for (let i = 0, iLen = this._dependencies.length; i < iLen; i++) {
    this._progress[i] = 0;
  }
};
