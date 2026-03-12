/**
 * @file scriptRequire.js
 * @overview ScriptDependency subclass for @require declarations.
 *
 * @require dependencies are JavaScript files fetched during script install and
 * stored locally.  The fileURL getter returns a file:// URI pointing to the
 * local copy so the sandbox can load it as a script.
 */

const EXPORTED_SYMBOLS = ["ScriptRequire"];

if (typeof Cc === "undefined") {
  var Cc = Components.classes;
}
if (typeof Ci === "undefined") {
  var Ci = Components.interfaces;
}
if (typeof Cu === "undefined") {
  var Cu = Components.utils;
}

Cu.import("chrome://greasemonkey-modules/content/scriptDependency.js");
Cu.import("chrome://greasemonkey-modules/content/util.js");


ScriptRequire.prototype = new ScriptDependency();
ScriptRequire.prototype.constructor = ScriptRequire;

/**
 * Represents a @require dependency of a userscript.
 *
 * @constructor
 * @param {Script} aScript - The owning script (passed to ScriptDependency).
 */
function ScriptRequire(aScript) {
  ScriptDependency.call(this, aScript);
  this.type = "ScriptRequire";
}

Object.defineProperty(ScriptRequire.prototype, "fileURL", {
  "get": function ScriptRequire_getFileURL() {
    return GM_util.getUriFromFile(this.file).spec;
  },
  "enumerable": true,
});
