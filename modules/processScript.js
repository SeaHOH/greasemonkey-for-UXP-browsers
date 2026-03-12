"use strict";

// Frame scripts, including all their functions, block scopes etc.
// are instantiated for each tab.
// Having a single per-process script has a lower footprint
// for stateless things.
// Avoid keeping references to frame scripts or their content,
// this could leak frames!

const EXPORTED_SYMBOLS = ["addFrame"];

if (typeof Cc === "undefined") {
  var Cc = Components.classes;
}
if (typeof Ci === "undefined") {
  var Ci = Components.interfaces;
}
if (typeof Cu === "undefined") {
  var Cu = Components.utils;
}

// Each (child) process needs to handle navigation to ".user.js" via file:// .
Cu.import("chrome://greasemonkey-modules/content/installPolicy.js");


// \\ // \\ // \\ // \\ // \\ // \\ // \\ // \\ // \\ // \\ // \\ // \\ // \\ //

function addFrame(aFrameMM) {
  aFrameMM.addMessageListener("greasemonkey:frame-urls", urlTree);
}

function urlsOfAllFrames(aContentWin) {
  var urls = [aContentWin.location.href];
  function collect(aContentWin) {
    urls = urls.concat(urlsOfAllFrames(aContentWin));
  }
  Array.from(aContentWin.frames).forEach(collect);

  return urls;
}

function urlTree(aMessage) {
  let frameMM = aMessage.target;
  let urls = urlsOfAllFrames(frameMM.content);
  let response = {
    "urls": urls,
  };
  frameMM.sendAsyncMessage("greasemonkey:frame-urls", response);
}
