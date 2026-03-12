// Based on Scriptish:
// https://github.com/scriptish/scriptish/blob/master/extension/modules/api/GM_setClipboard.js

const EXPORTED_SYMBOLS = ["GM_setClipboard"];

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


const FLAVOR = {
  "html": {
    "type": "html",
    "mimetype": "text/html",
  },
  "text": {
    "type": "text",
    "mimetype": "text/unicode",
  },
};

const TYPE = {
  "html": {
    "type": "html",
    "mimetype": "text/html",
  },
  "text": {
    "type": "text",
    "mimetype": "text/plain",
  },
};

function GM_setClipboard(aWrappedContentWin, aFileURL, aData, aOptions) {
  let clipboardHelperService = Cc["@mozilla.org/widget/clipboardhelper;1"]
      .getService(Ci.nsIClipboardHelper);
  let clipboardService = Cc["@mozilla.org/widget/clipboard;1"]
      .getService(Ci.nsIClipboard);
  let supportString = Cc["@mozilla.org/supports-string;1"]
      .createInstance(Ci.nsISupportsString);
  let trans = Cc["@mozilla.org/widget/transferable;1"]
      .createInstance(Ci.nsITransferable);

  // let _type = undefined;
  let _type = TYPE.text.type;
  if ((typeof aOptions != "undefined") && (aOptions != null)) {
    if (typeof aOptions.type == "undefined") {
      if (typeof aOptions != "object") {
        _type = aOptions;
      }
    } else {
      _type = aOptions.type;
    }
  }
  _type = _type ? String(_type).toLowerCase() : _type;

  // let _mimetype = undefined;
  let _mimetype = (_type == TYPE.html.type)
      ? TYPE.html.mimetype
      : TYPE.text.mimetype;
  if ((typeof aOptions != "undefined") && (aOptions != null)) {
    if (typeof aOptions.mimetype != "undefined") {
      _mimetype = aOptions.mimetype;
    }
  }
  _mimetype = _mimetype ? String(_mimetype).toLowerCase() : _mimetype;

  if (_mimetype == TYPE.text.mimetype) {
    _mimetype = FLAVOR.text.mimetype;
  }

  let _obj = {
    "type": _type,
    "mimetype": _mimetype,
  };

  switch (JSON.stringify(_obj)) {
    case JSON.stringify(FLAVOR.html):
      if ((typeof aData == "undefined") || (aData === null)) {
        aData = "";
      }

      // Add text/html flavor.
      let strVal = supportString;
      strVal.data = aData;
      trans.addDataFlavor(FLAVOR.html.mimetype);
      trans.setTransferData(FLAVOR.html.mimetype, strVal, (aData.length * 2));

      // Add a text/unicode flavor (html converted to plain text).
      strVal = supportString;
      let converter = Cc["@mozilla.org/feed-textconstruct;1"]
          .createInstance(Ci.nsIFeedTextConstruct);
      converter.type = FLAVOR.html.type;
      converter.text = aData;
      strVal.data = converter.plainText();
      trans.addDataFlavor(FLAVOR.text.mimetype);
      trans.setTransferData(
          FLAVOR.text.mimetype, strVal, (strVal.data.length * 2));

      clipboardService.setData(trans, null, clipboardService.kGlobalClipboard);
      break;
    case JSON.stringify(FLAVOR.text):
      clipboardHelperService.copyString(aData);
      break;
    default:
      let unsupportedType = aOptions;
      try {
        unsupportedType = JSON.stringify(aOptions);
      } catch (e) {
        // Ignore.
      }
      throw new aWrappedContentWin.Error(
          GM_CONSTANTS.localeStringBundle.createBundle(
              GM_CONSTANTS.localeGreasemonkeyProperties)
              .GetStringFromName("error.setClipboard.unsupportedType")
              .replace("%1", unsupportedType),
          aFileURL, null);
  }
}
