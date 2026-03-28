/**
 * @file documentObserver.js
 * @overview Observes the creation of new documents (page loads / frame loads)
 *   and notifies registered callbacks so that Greasemonkey can inject scripts
 *   at the right moment.
 *
 * Two observer topics are used (see bug #1849):
 *   - "content-document-global-created"  — fires early, before DOM parsing.
 *     Used for @run-at document-start scripts that need the earliest possible
 *     injection point.
 *   - "document-element-inserted"        — fires when the <html> element has
 *     been created but before the document is fully parsed.  Used for all
 *     other scripts and as a fallback for document-start.
 *
 * Both topics are always processed.  The callback receives the topic string
 * so it can decide what to inject at each phase.
 *
 * Usage:
 *   onNewDocument(aTopWindow, aCallback)
 *   // aCallback(win, topic) is called for every sub-document under aTopWindow.
 */

"use strict";

const EXPORTED_SYMBOLS = ["onNewDocument"];

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
Cu.import("chrome://greasemonkey-modules/content/util.js");


// See #1849.
const OBSERVER_TOPIC_1 = "content-document-global-created";
const OBSERVER_TOPIC_2 = "document-element-inserted";

/**
 * WeakMap from a top-level window to its registered callback.
 * Using a WeakMap means the entry is automatically collected when the
 * window is closed, preventing memory leaks.
 * @type {WeakMap<Window, function>}
 */
var callbacks = new WeakMap();

/**
 * Registers a callback to be invoked whenever a new document is created
 * inside the given top-level window (including iframes).
 *
 * @param {Window}   aTopWindow - The top-level content window to watch.
 * @param {function} aCallback  - Called with the new (sub-)window and the
 *                                observer topic string each time a document
 *                                is created: aCallback(win, topic).
 */
function onNewDocument(aTopWindow, aCallback) {
  callbacks.set(aTopWindow, aCallback);
}

/**
 * nsIObserver that receives document-creation notifications from the
 * Services.obs notification system.  Both supported topics are registered
 * at module load time and are always processed.  The topic string is
 * forwarded to the callback so it can run the appropriate scripts at
 * each phase (early injection for document-start, normal for others).
 */
let contentObserver = {
  /**
   * Called by the observer service for each document-creation notification.
   * Both supported topics are always processed; the topic string is forwarded
   * to the callback so it can decide what to inject at each phase.
   *
   * @param {nsISupports} aSubject - The new window (topic 1) or document (topic 2).
   * @param {string}      aTopic   - The observer topic string.
   * @param {string|null} aData    - Extra data; for topic 1, "null" string
   *                                 indicates an about:blank frame.
   */
  "observe": function (aSubject, aTopic, aData) {
    if (!GM_util.getEnabled()) {
      return undefined;
    }

    let doc;
    let win;
    switch (aTopic) {
      case OBSERVER_TOPIC_1:
        // aData != "null" - because of the page "about:blank".
        doc = aData && (aData != "null");
        win = aSubject;
        break;
      case OBSERVER_TOPIC_2:
        doc = aSubject;
        win = doc && doc.defaultView;
        break;
      default:
        return undefined;
    }

    if (!doc || !win) {
      return undefined;
    }

    let topWin = win.top;

    let frameCallback = callbacks.get(topWin);
    if (!frameCallback) {
      return undefined;
    }

    frameCallback(win, aTopic);
  },
};

Services.obs.addObserver(contentObserver, OBSERVER_TOPIC_1, false);
Services.obs.addObserver(contentObserver, OBSERVER_TOPIC_2, false);
