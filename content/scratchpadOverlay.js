window.addEventListener("load", function () {
  if (typeof Cc === "undefined") {
    let Cc = Components.classes;
  }
  if (typeof Ci === "undefined") {
    let Ci = Components.interfaces;
  }
  if (typeof Cu === "undefined") {
    let Cu = Components.utils;
  }

  Cu.import("chrome://greasemonkey-modules/content/constants.js");


  const FILE_SCRIPT_EXTENSION_REGEXP = new RegExp(
      GM_CONSTANTS.fileScriptExtensionRegexp + "$", ""); 

  let args = window.arguments;
  if (!args) {
    return undefined;
  }
  if (!(args[0] instanceof Ci.nsIDialogParamBlock)) {
    return undefined;
  }
  args = args[0].GetString(1);
  if (!args) {
    return undefined;
  }
  args = JSON.parse(args);
  if (!args.filename) {
    return undefined;
  }
  if (!FILE_SCRIPT_EXTENSION_REGEXP.test(args.filename)) {
    return undefined;
  }

  Cu.import("chrome://greasemonkey-modules/content/util.js");

  // If we're opening a user script:
  // Put the cursor at the top.
  var initializeCheckCount = 0;
  var initializeMaxCount = 50;
  var initializeCheckTimer = null;
  // ms
  let initializeInterval = 20;
  function moveCursorToTop() {
    if (initializeCheckCount > initializeMaxCount) {
      GM_util.logError(
          GM_CONSTANTS.info.scriptHandler + " - "
          + GM_CONSTANTS.localeStringBundle.createBundle(
              GM_CONSTANTS.localeGreasemonkeyProperties)
              .GetStringFromName("error.scratchpad.notInitialized"));
      clearInterval(initializeCheckTimer);
    }
    initializeCheckCount++;

    if (!Scratchpad.initialized) {
      return undefined;
    }

    Scratchpad.editor.setCursor({
      "line": 0,
      "ch": 0,
    });

    clearInterval(initializeCheckTimer);
  }
  initializeCheckTimer = setInterval(moveCursorToTop, initializeInterval);

  // Hide all the elements which don't make sense when editing a script.
  // See #1771 and #1774.

  // The Main Menu and the keyboard shortcuts for them.
  let mainMenuNodes = [
    {
      "id": "sp-execute-menu",
      "attribute": "collapsed",
      "value": true,
    },
    {
      "id": "sp-environment-menu",
      "attribute": "collapsed",
      "value": true,
    },
    {
      "id": "sp-toolbar-run",
      "attribute": "collapsed",
      "value": true,
    },
    {
      "id": "sp-toolbar-inspect",
      "attribute": "collapsed",
      "value": true,
    },
    {
      "id": "sp-toolbar-display",
      "attribute": "collapsed",
      "value": true,
    },
    {
      "id": "sp-key-run",
      "attribute": "disabled",
      "value": true,
    },
    {
      "id": "sp-key-inspect",
      "attribute": "disabled",
      "value": true,
    },
    {
      "id": "sp-key-display",
      "attribute": "disabled",
      "value": true,
    },
    {
      "id": "sp-key-evalFunction",
      "attribute": "disabled",
      "value": true,
    },
    {
      "id": "sp-key-reloadAndRun",
      "attribute": "disabled",
      "value": true,
    },
  ];

  for (let i = 0, iLen = mainMenuNodes.length; i < iLen; i++) {
    let mainMenuNode = mainMenuNodes[i];
    let el = document.getElementById(mainMenuNode.id);
    if (el) {
      el.setAttribute(mainMenuNode.attribute, mainMenuNode.value);
    }
  }

  // The Context Menu.
  let contextMenuNodes = [
    {
      "id": "sp-text-run",
      "previous": true,
    },
    {
      "id": "sp-text-inspect",
      "previous": false,
    },
    {
      "id": "sp-text-display",
      "previous": false,
    },
    {
      "id": "sp-text-evalFunction",
      "previous": false,
    },
    {
      "id": "sp-text-reloadAndRun",
      "previous": true,
    },
  ];

  let contextMenu = document.getElementById("scratchpad-text-popup");
  if (contextMenu) {
    for (let i = 0, iLen = contextMenu.childNodes.length; i < iLen; i++) {
      let contextMenuChildNode = contextMenu.childNodes[i];
      loop2:
      for (let j = 0, jLen = contextMenuNodes.length; j < jLen; j++) {
        let contextMenuNode = contextMenuNodes[j];
        if (contextMenuChildNode.id == contextMenuNode.id) {
          contextMenuChildNode.collapsed = true;
          if (contextMenuNode.previous) {
            if (contextMenuChildNode.previousSibling
                && (contextMenuChildNode.previousSibling.tagName.toLowerCase()
                == "menuseparator")) {
              contextMenuChildNode.previousSibling.collapsed = true;
            }
          }
          break loop2;
        }
      }
    }
  }
}, true);
