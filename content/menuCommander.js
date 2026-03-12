if (typeof Cc === "undefined") {
  var Cc = Components.classes;
}
if (typeof Ci === "undefined") {
  var Ci = Components.interfaces;
}
if (typeof Cu === "undefined") {
  var Cu = Components.utils;
}

// Strict mode:
// TypeError: setting a property that has only a getter
// Cu.import("resource://gre/modules/Services.jsm");

Cu.import("chrome://greasemonkey-modules/content/util.js");


var GM_MenuCommander = {
  "cookieShowing": null,
  "messageCookie": 1,
  "popup": null,
};

GM_MenuCommander.initialize = function () {
  Services.ppmm.addMessageListener("greasemonkey:menu-command-response",
      GM_MenuCommander.messageMenuCommandResponse);
};

GM_MenuCommander.uninitialize = function () {
  Services.ppmm.removeMessageListener("greasemonkey:menu-command-response",
      GM_MenuCommander.messageMenuCommandResponse);
};

GM_MenuCommander.commandClicked = function (aCommand) {
  gBrowser.selectedBrowser.messageManager.sendAsyncMessage(
      "greasemonkey:menu-command-run", {
        "cookie": aCommand.cookie,
        "scriptUuid": aCommand.scriptUuid,
      });
};

GM_MenuCommander.createMenuItem = function (aCommand) {
  let menuItem = document.createElement("menuitem");
  menuItem.setAttribute("label", aCommand.name);
  menuItem.setAttribute("tooltiptext", aCommand.scriptName);
  menuItem.addEventListener("command", function () {
    GM_MenuCommander.commandClicked(aCommand);
  }, false);

  if (aCommand.accesskey) {
    menuItem.setAttribute("accesskey", aCommand.accesskey);
  }

  menuItem.setAttribute("_object", JSON.stringify(aCommand));

  return menuItem;
};

GM_MenuCommander.messageMenuCommandResponse = function (aMessage) {
  if (aMessage.data.cookie != GM_MenuCommander.cookieShowing) {
    return undefined;
  }

  for (let i in aMessage.data.commands) {
    let command = aMessage.data.commands[i];
    let menuItem = GM_MenuCommander.createMenuItem(command);
    let menuItems = GM_MenuCommander.popup.childNodes;
    let menuItemExists = false;
    for (let i = 0, iLen = menuItems.length; i < iLen; i++) {
      if (JSON.stringify(command) == menuItems[i].getAttribute("_object")) {
        menuItemExists = true;
        break;
      }
    }
    if (!menuItemExists) {
      GM_MenuCommander.popup.appendChild(menuItem);
    }
  }
  if (GM_MenuCommander.popup.firstChild) {
    GM_MenuCommander.popup.parentNode.disabled = false;
  }
};

GM_MenuCommander.onPopupHiding = function () {
  // See #1632.
  // Asynchronously.
  GM_util.timeout(function () {
    GM_util.emptyElm(GM_MenuCommander.popup);
  }, 0);
};

GM_MenuCommander.onPopupShowing = function (aEventTarget) {
  GM_MenuCommander.popup = aEventTarget.querySelector(
      "menupopup.greasemonkey-user-script-commands-popup");

  GM_MenuCommander.messageCookie++;
  GM_MenuCommander.cookieShowing = GM_MenuCommander.messageCookie;

  // Start disabled and empty...
  GM_MenuCommander.popup.parentNode.disabled = true;
  GM_util.emptyElm(GM_MenuCommander.popup);
  // ...ask the selected browser to fill up our menu.
  gBrowser.selectedBrowser.messageManager.sendAsyncMessage(
      "greasemonkey:menu-command-list", {
        "cookie": GM_MenuCommander.cookieShowing,
      });
};
