const EXPORTED_SYMBOLS = ["ScriptResource"];

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


ScriptResource.prototype = new ScriptDependency();
ScriptResource.prototype.constructor = ScriptResource;
function ScriptResource(aScript) {
  ScriptDependency.call(this, aScript);
  this.type = "ScriptResource";
}

Object.defineProperty(ScriptResource.prototype, "dataContent", {
  "get": function ScriptResource_getDataContent() {
    let binaryContents = GM_util.getBinaryContents(this.file);

    return "data:" + this.mimetype
        + ";base64," + encodeURIComponent(btoa(binaryContents));
  },
  "enumerable": true,
});
