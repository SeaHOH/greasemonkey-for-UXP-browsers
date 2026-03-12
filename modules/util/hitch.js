const EXPORTED_SYMBOLS = ["hitch"];


function hitch(aObj, aMethod) {
  if (aObj && aMethod && (typeof aMethod == "string")) {
    if (!aObj[aMethod]) {
      throw 'GM_util.hitch: Method "' + aMethod
          + '" does not exist on object:' + "\n" + aObj;
    }
    aMethod = aObj[aMethod];
  } else if (typeof aMethod == "function") {
    aObj = aObj || {};
  } else {
    throw "GM_util.hitch: Invalid arguments.";
  }

  var staticArgs = Array.prototype.splice.call(arguments, 2, arguments.length);

  return function () {
    // Make a copy of staticArgs
    // (don't modify it because it gets reused for every invocation).
    let args = Array.prototype.slice.call(staticArgs);

    // Add all the new arguments.
    Array.prototype.push.apply(args, arguments);

    // Invoke the original function with the correct this obj
    // and the combined list of static and dynamic arguments.
    return aMethod.apply(aObj, args);
  };
}
