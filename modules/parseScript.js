const EXPORTED_SYMBOLS = ["parse"];

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

Cu.import("resource://gre/modules/osfile.jsm");

Cu.import("chrome://greasemonkey-modules/content/extractMeta.js");
Cu.import("chrome://greasemonkey-modules/content/prefManager.js");
Cu.import("chrome://greasemonkey-modules/content/script.js");
Cu.import("chrome://greasemonkey-modules/content/scriptIcon.js");
Cu.import("chrome://greasemonkey-modules/content/scriptRequire.js");
Cu.import("chrome://greasemonkey-modules/content/scriptResource.js");
Cu.import("chrome://greasemonkey-modules/content/thirdParty/matchPattern.js");
Cu.import("chrome://greasemonkey-modules/content/util.js");


const META_SEPARATOR = "\0";

const SOMETHING_REGEXP = new RegExp(".+", "g");

// Parse the source of a script; produce Script object.
function parse(aSource, aUri, aFailWhenMissing) {
  var meta = extractMeta(aSource).match(SOMETHING_REGEXP);
  if (aFailWhenMissing && !meta) {
    return null;
  }

  var script = new Script();

  var scriptName = null;
  if (aUri && aUri.host && aUri.spec) {
    scriptName = aUri.spec;
    scriptName = scriptName.substring(
        0, scriptName.indexOf(GM_CONSTANTS.fileScriptExtension));
    scriptName = scriptName.substring(scriptName.lastIndexOf("/") + 1);
    script["_" + "name"] = scriptName;
    script["_" + "namespace"] = aUri.host;
    script["downloadURL"] = aUri.spec;
  }

  if (!meta) {
    setDefaults(script);
    return script;
  }

  var resourceNames = {};
  let _re = new RegExp("\\s+$", "");
  for (let i = 0, metaLine = ""; metaLine = meta[i]; i++) {
    var data;
    try {
      data = GM_util.parseMetaLine(metaLine.replace(_re, ""));
    } catch (e) {
      // Ignore invalid/unsupported meta lines.
      continue;
    }

    switch (data.keyword) {
      case "author":
      case "copyright":
        script[data.keyword] = data.value;
        break;

      case "description":
      case "name":
        let locale = data.locale;

        if (locale) {
          if (!script._locales[locale]) {
            script._locales[locale] = {};
          }
          script._locales[locale][data.keyword] = data.value;
        } else {
          if ((data.keyword == "description")
              && (script["_" + data.keyword] == "")) {
            script["_" + data.keyword] = data.value;
          }
          if ((data.keyword == "name")
            && ((script["_" + data.keyword] == GM_CONSTANTS.scriptType)
            || (script["_" + data.keyword] == scriptName))) {
            script["_" + data.keyword] = data.value;
          }
        }
        break;

      case "namespace":
      case "version":
        script["_" + data.keyword] = data.value;
        break;

      case "noframes":
        script["_" + data.keyword] = true;
        break;

      case "exclude":
        script["_excludes"].push(data.value);
        break;

      case "grant":
        script["_grants"].push(data.value);
        break;

      case "icon":
        try {
          script[data.keyword].setMetaVal(data.value);
          script["_rawMeta"] += data.keyword + META_SEPARATOR
              + data.value + META_SEPARATOR;
        } catch (e) {
          script.parseErrors.push(e.message);
        }
        break;

      case "include":
        script["_includes"].push(data.value);
        break;

      case "installURL":
        data.keyword = "downloadURL";
      case "downloadURL":
      case "homepageURL":
      case "updateURL":
        try {
          let uri = GM_util.getUriFromUrl(data.value, aUri);
          script[data.keyword] = uri.spec;
        } catch (e) {
          // Otherwise this call would be twice.
          if (!aFailWhenMissing) {
            GM_util.logError(
                "ParseScript" + " - "
                + GM_CONSTANTS.localeStringBundle.createBundle(
                    GM_CONSTANTS.localeGreasemonkeyProperties)
                    .GetStringFromName("error.parse.failed") + ":"
                + "\n" + data.keyword + ' = "' + data.value + '"'
                + "\n" + e, false,
                (aUri && aUri.spec) ? aUri.spec : e.fileName,
                (aUri && aUri.spec) ? null : e.lineNumber);
          }
        }
        break;

      case "match":
        let match;
        try {
          match = new MatchPattern(data.value);
          script._matches.push(match);
        } catch (e) {
          script.parseErrors.push(
              GM_CONSTANTS.localeStringBundle.createBundle(
                  GM_CONSTANTS.localeGreasemonkeyProperties)
                  .GetStringFromName("error.parse.ignoringMatch")
                  .replace("%1", data.value).replace("%2", e)
              );
        }
        break;

      case "require":
        try {
          let reqUri = GM_util.getUriFromUrl(data.value, aUri);
          if (aUri && aUri.spec && reqUri && reqUri.spec
              && !checkUrls(aUri, reqUri)) {
            throw GM_CONSTANTS.localeStringBundle.createBundle(
                GM_CONSTANTS.localeGreasemonkeyProperties)
                .GetStringFromName(
                    "error.parse.fileDependencyUrlIsDescendantOfDownloadUrl")
                .replace("%1", reqUri.spec)
                .replace("%2", aUri.spec);
          }
          let scriptRequire = new ScriptRequire(script);
          if (!reqUri || !reqUri.spec) {
            throw "";
          }
          scriptRequire._downloadURL = reqUri.spec;
          script["_requires"].push(scriptRequire);
          script["_rawMeta"] += data.keyword + META_SEPARATOR
              + data.value + META_SEPARATOR;
        } catch (e) {
          // Otherwise this call would be twice.
          if (!aFailWhenMissing) {
            GM_util.logError(
                "ParseScript" + " - "
                + GM_CONSTANTS.localeStringBundle.createBundle(
                    GM_CONSTANTS.localeGreasemonkeyProperties)
                    .GetStringFromName("error.parse.failed") + ":"
                + "\n" + data.keyword + ' = "' + data.value + '"'
                + "\n" + e, false,
                (aUri && aUri.spec) ? aUri.spec : e.fileName,
                (aUri && aUri.spec) ? null : e.lineNumber);
          }
          script.parseErrors.push(
              GM_CONSTANTS.localeStringBundle.createBundle(
                  GM_CONSTANTS.localeGreasemonkeyProperties)
                  .GetStringFromName("error.parse.requireFailed")
                  .replace("%1", data.value)
              );
        }
        break;

      case "resource":
        let name = data.value1;
        let url = data.value2;

        if (name in resourceNames) {
          script.parseErrors.push(
              GM_CONSTANTS.localeStringBundle.createBundle(
                  GM_CONSTANTS.localeGreasemonkeyProperties)
                  .GetStringFromName("error.parse.resourceDuplicate")
                  .replace("%1", name));
          break;
        }
        resourceNames[name] = true;

        try {
          let resUri = GM_util.getUriFromUrl(url, aUri);
          if (aUri && aUri.spec && resUri && resUri.spec
              && !checkUrls(aUri, resUri)) {
            throw GM_CONSTANTS.localeStringBundle.createBundle(
                GM_CONSTANTS.localeGreasemonkeyProperties)
                .GetStringFromName(
                    "error.parse.fileDependencyUrlIsDescendantOfDownloadUrl")
                .replace("%1", resUri.spec)
                .replace("%2", aUri.spec);
          }
          let scriptResource = new ScriptResource(script);
          scriptResource._name = name;
          if (!resUri || !resUri.spec) {
            throw "";
          }
          scriptResource._downloadURL = resUri.spec;
          script["_resources"].push(scriptResource);
          script["_rawMeta"] += data.keyword + META_SEPARATOR
              + name + META_SEPARATOR + resUri.spec + META_SEPARATOR;
        } catch (e) {
          // Otherwise this call would be twice.
          if (!aFailWhenMissing) {
            GM_util.logError(
                "ParseScript" + " - "
                + GM_CONSTANTS.localeStringBundle.createBundle(
                    GM_CONSTANTS.localeGreasemonkeyProperties)
                    .GetStringFromName("error.parse.failed") + ":"
                + "\n" + data.keyword + ' = "' + name + " " + url + '"'
                + "\n" + e, false,
                (aUri && aUri.spec) ? aUri.spec : e.fileName,
                (aUri && aUri.spec) ? null : e.lineNumber);
          }
          script.parseErrors.push(
              GM_CONSTANTS.localeStringBundle.createBundle(
                  GM_CONSTANTS.localeGreasemonkeyProperties)
                  .GetStringFromName("error.parse.resourceFailed")
                  .replace("%1", name).replace("%2", url)
              );
        }

        break;

      case "run-at":
        script["_runAt"] = data.value;
        break;

    }
  }

  setDefaults(script);
  return script;
}

function setDefaults(aScript) {
  if (!aScript.updateURL && aScript.downloadURL) {
    aScript.updateURL = aScript.downloadURL;
  }
  // In case of a search and replace:
  // document-end, document-idle, document-start
  if (!aScript._runAt || !aScript._runAt.match(
      new RegExp("^document-(end|idle|start)$", ""))) {
    aScript._runAt = "document-end";
  }
  if ((aScript._includes.length == 0) && (aScript._matches.length == 0)) {
    aScript._includes.push(GM_CONSTANTS.script.includeAll);
  }
}

function checkUrls(aUri, aDepUri) {
  let check = GM_prefRoot.getValue(
      "fileDependencyUrlIsDescendantOfDownloadUrl");
  if (check) {
    let scheme1 = GM_CONSTANTS.ioService.extractScheme(aUri.spec);
    let scheme2 = GM_CONSTANTS.ioService.extractScheme(aDepUri.spec);
    if ((scheme1 == "file") && (scheme2 == "file")) {
      let file1 = Cc["@mozilla.org/file/local;1"]
          .createInstance(Ci.nsILocalFile);
      let file2 = Cc["@mozilla.org/file/local;1"]
          .createInstance(Ci.nsILocalFile);

      file1.initWithPath(OS.Path.dirname(OS.Path.fromFileURI(aUri.spec)));
      file2.initWithPath(OS.Path.fromFileURI(aDepUri.spec));

      return file1.contains(file2);
    }
  }

  return true;
}
