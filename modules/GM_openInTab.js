/**
 * @file GM_openInTab.js
 * @overview Implements the GM_openInTab() API for userscripts.
 *
 * Opens a URL in a new browser tab.  The URL is resolved relative to the
 * current content window's location before being sent to the parent process
 * via an async IPC message ("greasemonkey:open-in-tab").
 *
 * Supported option forms (mirrors the GM4 specification):
 *   GM_openInTab(url)                        — opens in background
 *   GM_openInTab(url, true)                  — opens in background (legacy bool)
 *   GM_openInTab(url, false)                 — opens in foreground (legacy bool)
 *   GM_openInTab(url, { active: true })      — opens in foreground
 *   GM_openInTab(url, { insert: true })      — inserts tab next to current
 */

const EXPORTED_SYMBOLS = ["GM_openInTab", "GM_tabClosed"];

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


// Tab tracking for .close() and .onclose support.
var gTabIdCounter = 0;
var gOpenTabs = {};

/**
 * Opens aUrl in a new browser tab and returns a tab-like object.
 *
 * @param {nsIMessageSender} aFrame   - The frame's message manager, used to
 *                                      send the open-in-tab IPC message.
 * @param {string}           aBaseUrl - Base URL of the current content window,
 *                                      used to resolve relative URLs.
 * @param {string}           aUrl     - The URL to open (may be relative).
 * @param {boolean|object|undefined} aOptions
 *   - If a boolean: treated as the legacy "loadInBackground" flag.
 *   - If an object: may contain:
 *       active  {boolean} — true to open in foreground (default: background).
 *       insert  {boolean} — true to insert the new tab adjacent to the current one.
 *       setParent {boolean} — true to inherit parent tab association.
 *   - If omitted/null: browser default behaviour applies.
 * @returns {object} Tab handle with:
 *   - closed  {boolean}  — true after the tab is closed.
 *   - onclose {function} — called when the tab is closed.
 *   - close() {function} — closes the tab programmatically.
 */
function GM_openInTab(aFrame, aBaseUrl, aUrl, aOptions) {
  let loadInBackground = null;
  if ((typeof aOptions != "undefined") && (aOptions != null)) {
    if (typeof aOptions.active == "undefined") {
      if (typeof aOptions != "object") {
        loadInBackground = !!aOptions;
      }
    } else {
      loadInBackground = !aOptions.active;
    }
  }

  let insertRelatedAfterCurrent = null;
  if ((typeof aOptions != "undefined") && (aOptions != null)) {
    if (typeof aOptions.insert != "undefined") {
      insertRelatedAfterCurrent = !!aOptions.insert;
    }
  }

  // Resolve URL relative to the location of the content window.
  let baseUri = GM_CONSTANTS.ioService.newURI(aBaseUrl, null, null);
  let uri = GM_CONSTANTS.ioService.newURI(aUrl, null, baseUri);

  let tabId = ++gTabIdCounter;

  // Create the tab handle returned to the script.
  let tabHandle = {
    "closed": false,
    "onclose": null,
    "close": function () {
      aFrame.sendAsyncMessage("greasemonkey:tab-close", {
        "tabId": tabId,
      });
    },
  };
  gOpenTabs[tabId] = tabHandle;

  aFrame.sendAsyncMessage("greasemonkey:open-in-tab", {
    "afterCurrent": insertRelatedAfterCurrent,
    "inBackground": loadInBackground,
    "tabId": tabId,
    "url": uri.spec,
  });

  return tabHandle;
};

/**
 * Called when a tab opened by GM_openInTab is closed.
 * Sets the handle's closed flag and fires onclose callback.
 *
 * @param {number} aTabId - The tab ID assigned when it was opened.
 */
function GM_tabClosed(aTabId) {
  let handle = gOpenTabs[aTabId];
  if (handle) {
    handle.closed = true;
    delete gOpenTabs[aTabId];
    if (typeof handle.onclose == "function") {
      try {
        handle.onclose();
      } catch (e) {
        // Ignore callback errors.
      }
    }
  }
};
