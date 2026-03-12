const EXPORTED_SYMBOLS = ["GM_PrefManager", "GM_prefRoot"];

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


/**
 * Simple API on top of preferences for greasemonkey.
 * Construct an instance by passing the startPoint of a preferences subtree.
 * "greasemonkey." prefix is assumed.
 */
function GM_PrefManager(aStartPoint) {
  aStartPoint = "extensions.greasemonkey." + (aStartPoint || "");

  this.pref = Cc["@mozilla.org/preferences-service;1"]
      .getService(Ci.nsIPrefService)
      .getBranch(aStartPoint);

  this.observers = new Map();
};

GM_PrefManager.prototype.MIN_INT_32 = -0x80000000;
GM_PrefManager.prototype.MAX_INT_32 = 0x7FFFFFFF;
GM_PrefManager.prototype.nsISupportsString = Ci.nsISupportsString;

/**
 * Whether a preference exists.
 */
GM_PrefManager.prototype.exists = function (aPrefName) {
  return this.pref.getPrefType(aPrefName) != 0;
};

/**
 * Enumerate preferences.
 */
GM_PrefManager.prototype.listValues = function () {
  return this.pref.getChildList("", {});
};

/**
 * Returns the named preference, or defaultValue if it does not exist.
 */
GM_PrefManager.prototype.getValue = function (aPrefName, aDefaultValue) {
  let prefType = this.pref.getPrefType(aPrefName);

  // underlying preferences object throws an exception if pref doesn't exist
  if (prefType == this.pref.PREF_INVALID) {
    return aDefaultValue;
  }

  try {
    switch (prefType) {
      case this.pref.PREF_STRING:
        return this.pref.getComplexValue(
            aPrefName, this.nsISupportsString).data;
      case this.pref.PREF_BOOL:
        return this.pref.getBoolPref(aPrefName);
      case this.pref.PREF_INT:
        return this.pref.getIntPref(aPrefName);
    }
  } catch (e) {
    return (typeof aDefaultValue != "undefined") ? aDefaultValue : null;
  }

  return null;
};

/**
 * Sets the named preference to the specified value. values must be booleans,
 * integers, or strings.
 */
GM_PrefManager.prototype.setValue = function (aPrefName, aValue) {
  let prefType = typeof aValue;
  let goodType = false;

  switch (prefType) {
    case "boolean":
    case "string":
      goodType = true;
      break;
    case "number":
      if (((aValue % 1) == 0)
          && (aValue >= this.MIN_INT_32)
          && (aValue <= this.MAX_INT_32)) {
        goodType = true;
      }
      break;
  }

  if (!goodType) {
    throw new Error(
        GM_CONSTANTS.localeStringBundle.createBundle(
            GM_CONSTANTS.localeGreasemonkeyProperties)
            .GetStringFromName("error.setValue.unsupportedType"));
  }

  // Underlying preferences object throws an exception if new pref has
  // a different type than old one. i think we should not do this,
  // so delete old pref first if this is the case.
  if (this.exists(aPrefName) && (typeof this.getValue(aPrefName) != prefType)) {
    this.remove(aPrefName);
  }

  // Set new value using correct method.
  switch (prefType) {
    case "boolean":
      this.pref.setBoolPref(aPrefName, aValue);
      break;
    case "number":
      this.pref.setIntPref(aPrefName, Math.floor(aValue));
      break;
    case "string":
      let str = Cc["@mozilla.org/supports-string;1"]
          .createInstance(this.nsISupportsString);
      str.data = aValue;
      this.pref.setComplexValue(aPrefName, this.nsISupportsString, str);
      break;
  }
};

/**
 * Deletes the named preference or subtree.
 */
GM_PrefManager.prototype.remove = function (aPrefName) {
  this.pref.deleteBranch(aPrefName);
};

/**
 * Call a function whenever the named preference subtree changes.
 */
GM_PrefManager.prototype.watch = function (aPrefName, aWatcher) {
  // Construct an observer.
  let observer = {
    "observe": function (aSubject, aTopic, aPrefName) {
      aWatcher(aPrefName);
    },
  };

  // Store the observer in case we need to remove it later.
  this.observers.set(aWatcher, observer);

  this.pref.QueryInterface(Ci.nsIPrefBranchInternal)
      .addObserver(aPrefName, observer, false);
};

/**
 * Stop watching.
 */
GM_PrefManager.prototype.unwatch = function (aPrefName, aWatcher) {
  let observer = this.observers.get(aWatcher);
  if (observer) {
    this.observers.delete(aWatcher);
    this.pref.QueryInterface(Ci.nsIPrefBranchInternal)
        .removeObserver(aPrefName, observer);
  }
};

var GM_prefRoot = new GM_PrefManager();
