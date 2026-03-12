const EXPORTED_SYMBOLS = ["IPCScript"];

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

Cu.import("chrome://greasemonkey-modules/content/abstractScript.js");
Cu.import("chrome://greasemonkey-modules/content/util.js");


function IPCScript(aScript, aAddonVersion) {
  this.addonVersion = aAddonVersion;
  this.author = aScript.author || "";
  this.copyright = aScript.copyright || null;
  this.description = aScript.description;
  this.enabled = aScript.enabled;
  this.excludes = aScript.excludes;
  this.fileURL = aScript.fileURL;
  this.grants = aScript.grants;
  this.homepage = ((aScript.homepageURL && (aScript.homepageURL != ""))
      ? aScript.homepageURL
      : null);
  this.id = aScript.id;
  this.includes = aScript.includes;
  this.lastUpdated = aScript.modifiedDate.getTime();
  this.localized = aScript.localized;
  this.name = aScript.name;
  this.namespace = aScript.namespace;
  this.needsUninstall = aScript.needsUninstall;
  this.noframes = aScript.noframes;
  this.pendingExec = {};
  this.pendingExec.length = aScript.pendingExec.length || 0;
  this.runAt = aScript.runAt;
  this.userExcludes = aScript.userExcludes;
  this.userIncludes = aScript.userIncludes;
  this.userOverride = aScript.userOverride;
  this.uuid = aScript.uuid;
  this.version = aScript.version;
  this.willUpdate = aScript.isRemoteUpdateAllowed(false)
      && aScript.shouldAutoUpdate();

  this.matches = aScript.matches.map(function (aMatch) {
    return aMatch.pattern;
  });
  this.userMatches = aScript.userMatches.map(function (aMatch) {
    return aMatch.pattern;
  });

  this.requires = aScript.requires.map(function (aReq) {
    return {
      "fileURL": aReq.fileURL,
    };
  });

  this.resources = aScript.resources.map(function (aRes) {
    return {
      "name": aRes.name,
      "mimetype": aRes.mimetype,
      "file_url": GM_util.getUriFromFile(aRes.file).spec,
      "gm_url": [
        GM_CONSTANTS.addonScriptProtocolScheme + ":",
        aScript.uuid,
        GM_CONSTANTS.addonScriptProtocolSeparator, aRes.name
      ].join(""),
    };
  });
};

IPCScript.prototype = Object.create(AbstractScript.prototype, {
  "constructor": {
    "value": IPCScript,
  },
});

IPCScript.scriptsForUrl = function (aUrl, aWhen, aWindowId /* ignore */) {
  let result = gScripts.filter(function (aScript) {
    try {
      return GM_util.scriptMatchesUrlAndRuns(aScript, aUrl, aWhen);
    } catch (e) {
      // See #1692.
      // Prevent failures like that from being so severe.
      GM_util.logError(e, false, e.fileName, e.lineNumber);
      return false;
    }
  });

  return result;
};

IPCScript.prototype.info = function () {
  let resources = this.resources.map(function (aRes) {
    return {
      "name": aRes.name,
      "mimetype": aRes.mimetype,
      "url": aRes.gm_url,
    };
  });

  return {
    "script": {
      "author": this.author,
      "copyright": this.copyright,
      "description": this.description,
      "excludes": this.excludes,
      "homepage": this.homepage,
      // "icon": ? source URL,
      "includes": this.includes,
      "lastUpdated": this.lastUpdated,
      "localizedDescription": this.localized.description,
      "localizedName": this.localized.name,
      "matches": this.matches,
      "name": this.name,
      "namespace": this.namespace,
      "noframes": this.noframes,
      // "requires": ? source URL,
      "resources": resources,
      "run-at": this.runAt,
      "version": this.version,
    },
    "scriptHandler": GM_CONSTANTS.info.scriptHandler,
    "scriptWillUpdate": this.willUpdate,
    "uuid": this.uuid,
    "version": this.addonVersion,
  };
};

var gScripts = [];

function objectToScript(aObj) {
  var script = Object.create(IPCScript.prototype);

  Object.keys(aObj).forEach(function (aKey) {
    script[aKey] = aObj[aKey];
  });

  Object.freeze(script);

  return script;
}

IPCScript.getByUuid = function (aId) {
  return gScripts.find(function (e) {
    return e.uuid == aId;
  });
}

function updateData(aData) {
  if (!aData) {
    return undefined;
  }
  let newScripts = aData.scripts.map(objectToScript);
  Object.freeze(newScripts);
  gScripts = newScripts;
  Object.defineProperty(IPCScript.prototype, "globalExcludes", {
    "get": function IPCScript_getGlobalExcludes() {
      return aData.globalExcludes;
    },
    "configurable": true,
    "enumerable": true,
  });
}

// Firefox 41+
// Check if initialProcessData is supported, else child will use sync message.
if (Services.cpmm.initialProcessData) {
  updateData(Services.cpmm.initialProcessData["greasemonkey:scripts-update"]);
} else {
  let results = Services.cpmm.sendSyncMessage("greasemonkey:scripts-update");
  updateData(results[0]);
}

Services.cpmm.addMessageListener(
    "greasemonkey:scripts-update", function (aMessage) {
      updateData(aMessage.data);
    });
