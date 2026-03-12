const EXPORTED_SYMBOLS = ["getContents"];

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

Cu.import("chrome://greasemonkey-modules/content/util.js");


const SCRIPTABLE_INPUT_STREAM = Cc["@mozilla.org/scriptableinputstream;1"]
    .getService(Ci.nsIScriptableInputStream);
const SCRIPTABLE_UNICODE_CONVERTER = 
    Cc["@mozilla.org/intl/scriptableunicodeconverter"]
    .createInstance(Ci.nsIScriptableUnicodeConverter);

function getContents(aFile, aCharset, aFatal) {
  if (!aFile.isFile()) {
    throw new Error(
        "getContents - "
        + GM_CONSTANTS.info.scriptHandler + " "
        + "tried to get contents of non-file:"
        + "\n" + aFile.path);
  }
  SCRIPTABLE_UNICODE_CONVERTER.charset = aCharset
      || GM_CONSTANTS.fileScriptCharset;

  let channel = GM_util.getChannelFromUri(GM_util.getUriFromFile(aFile));
  let input = null;
  try {
    input = channel.open();
  } catch (e) {
    GM_util.logError(
        "getContents - Could not open file:" + "\n" + aFile.path, false,
        e.fileName, e.lineNumber);
    return "";
  }

  SCRIPTABLE_INPUT_STREAM.init(input);
  let str = SCRIPTABLE_INPUT_STREAM.read(input.available());
  SCRIPTABLE_INPUT_STREAM.close();

  input.close();

  try {
    return SCRIPTABLE_UNICODE_CONVERTER.ConvertToUnicode(str);
  } catch (e) {
    if (aFatal) {
      throw e;
    }
    return str;
  }
}
