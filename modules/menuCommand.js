const EXPORTED_SYMBOLS = [
  "MenuCommandEventNameSuffix",
  "MenuCommandListRequest", "MenuCommandRespond",
  "MenuCommandRun", "MenuCommandSandbox",
];

if (typeof Cc === "undefined") {
  var Cc = Components.classes;
}
if (typeof Ci === "undefined") {
  var Ci = Components.interfaces;
}
if (typeof Cu === "undefined") {
  var Cu = Components.utils;
}

Cu.import("resource://gre/modules/Services.jsm");

Cu.import("chrome://greasemonkey-modules/content/prefManager.js");


var MenuCommandEventNameSuffix = (function () {
  let suffix = GM_prefRoot.getValue("menuCommanderEventNameSuffix");

  if (!suffix) {
    Cu.import("resource://services-crypto/utils.js");
    let rnd = CryptoUtils.generateRandomBytes(128);
    try {
      // Pale Moon 27.2+
      suffix = CryptoUtils.sha256Base32(rnd);
    } catch (e) {
      suffix = CryptoUtils.sha1Base32(rnd);
    }
    GM_prefRoot.setValue("menuCommanderEventNameSuffix", suffix);
  }

  return suffix;
})();

// Frame scope: Pass "list menu commands" message into sandbox as event.
function MenuCommandListRequest(aContent, aMessage) {
  let e = new aContent.CustomEvent(
      "greasemonkey-menu-command-list-" + MenuCommandEventNameSuffix, {
        "detail": aMessage.data.cookie,
      });
  aContent.dispatchEvent(e);
}

// Callback from script scope, pass "list menu commands" response
// up to parent process as a message.
function MenuCommandRespond(aCookie, aData) {
  Services.cpmm.sendAsyncMessage(
      "greasemonkey:menu-command-response", {
        "commands": aData,
        "cookie": aCookie,
      });
}

// Frame scope: Respond to the "run this menu command" message coming
// from the parent, pass it into the sandbox.
function MenuCommandRun(aContent, aMessage) {
  let e = new aContent.CustomEvent(
      "greasemonkey-menu-command-run-" + MenuCommandEventNameSuffix, {
        "detail": JSON.stringify(aMessage.data),
      });
  aContent.dispatchEvent(e);
}

// This function is injected into the sandbox, in a private scope wrapper,
// BY SOURCE.
// Data and sensitive references are wrapped up inside its closure.
function MenuCommandSandbox(
    aContent,
    aScriptUuid, aScriptName, aScriptFileURL,
    aCommandResponder,
    aMenuCommandCallbackIsNotFunctionErrorStr,
    aMenuCommandCouldNotRunErrorStr,
    aMenuCommandInvalidAccesskeyErrorStr,
    aMenuCommandEventNameSuffix) {
  // 1) Internally to this function's private scope,
  // maintain a set of registered menu commands.
  var commands = {};
  var commandFuncs = {};
  var commandCookie = 0;
  // "var" instead of "let"
  // Firefox 43-
  // http://bugzil.la/932517
  var _addEventListener = true;
  try {
    aContent.addEventListener;
  } catch (e) {
    // e.g.:
    // Error: Permission denied to access property "addEventListener"
    _addEventListener = false;
  }
  if (_addEventListener) {
    // 2) Respond to requests to list those registered commands.
    aContent.addEventListener(
          "greasemonkey-menu-command-list-" + aMenuCommandEventNameSuffix,
          function (e) {
            e.stopPropagation();
            aCommandResponder(e.detail, commands);
          }, true);
    // 3) Respond to requests to run those registered commands.
    aContent.addEventListener(
        "greasemonkey-menu-command-run-" + aMenuCommandEventNameSuffix,
        function (e) {
          e.stopPropagation();
          var detail = JSON.parse(e.detail);
          if (aScriptUuid != detail.scriptUuid) {
            return undefined;
          }
          // This event is for this script; stop propagating to other scripts.
          e.stopImmediatePropagation();
          var commandFunc = commandFuncs[detail.cookie];
          if (!commandFunc) {
            throw new Error(
                aMenuCommandCouldNotRunErrorStr.replace(
                    "%1", commands[detail.cookie].name),
                aScriptFileURL, null);
          } else if (typeof commandFunc != "function") {
            throw new Error(
                aMenuCommandCallbackIsNotFunctionErrorStr.replace(
                    "%1", commands[detail.cookie].name),
                aScriptFileURL, null);
          } else {
            commandFunc.call();
          }
        }, true);
  }
  // 4) Export the "register a command" API function to the sandbox scope.
  this.GM_registerMenuCommand = function (
      aCommandName, aCommandFunc, aAccesskey, aUnused, aAccesskey2) {
    aCommandName = String(aCommandName);

    // Legacy support:
    // If all five parameters were specified
    // (from when two were for accelerators) use the last one as the access key.
    if (typeof aAccesskey2 != "undefined") {
      aAccesskey = aAccesskey2;
    }

    if (aAccesskey
        && ((typeof aAccesskey != "string") || (aAccesskey.length != 1))) {
      throw new Error(
          aMenuCommandInvalidAccesskeyErrorStr.replace("%1", aCommandName),
          aScriptFileURL, null);
    }

    var command = {
      "accesskey": aAccesskey,
      "cookie": ++commandCookie,
      "name": aCommandName,
      "scriptName": aScriptName,
      "scriptUuid": aScriptUuid,
    };
    commands[command.cookie] = command;
    commandFuncs[command.cookie] = aCommandFunc;
  };
};
