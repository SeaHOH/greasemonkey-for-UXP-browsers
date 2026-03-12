const EXPORTED_SYMBOLS = ["GM_xmlHttpRequester"];

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

Cu.importGlobalProperties(["Blob"]);
Cu.importGlobalProperties(["XMLHttpRequest"]);

Cu.import("chrome://greasemonkey-modules/content/util.js");


// Cookies - reserved for possible future use (see also #2236) - part 1/2.
/*
const COOKIES_SERVICE = Cc["@mozilla.org/cookieService;1"].getService()
    .QueryInterface(Ci.nsICookieService);
*/

// See #1945, #2008 - part 1/3.
/*
const AUTHORIZATION_USER_PASSWORD_REGEXP = new RegExp(
    "^([^:]+):([^:]+)$", "");
*/

function GM_xmlHttpRequester(aWrappedContentWin, aSandbox, aFileURL, aOriginUrl) {
  this.fileURL = aFileURL;
  this.originUrl = aOriginUrl;
  this.sandbox = aSandbox;
  this.sandboxPrincipal = Cu.getObjectPrincipal(aSandbox);
  this.wrappedContentWin = aWrappedContentWin;
}

// This function gets called by user scripts in content security scope
// to start a cross-domain xmlhttp request.
GM_xmlHttpRequester.prototype.contentStartRequest = function (aDetails) {
  if (!aDetails || (typeof aDetails != "object")) {
    throw new this.wrappedContentWin.Error(
        GM_CONSTANTS.localeStringBundle.createBundle(
            GM_CONSTANTS.localeGreasemonkeyProperties)
            .GetStringFromName("error.xmlhttpRequest.noDetails"),
        this.fileURL, null);
  }

  let uri = null;
  let url = null;

  try {
    // Validate and parse the (possibly relative) given URL.
    uri = GM_util.getUriFromUrl(aDetails.url, this.originUrl);
    url = uri.spec;
  } catch (e) {
    // A malformed URL won't be parsed properly.
    throw new this.wrappedContentWin.Error(
        GM_CONSTANTS.localeStringBundle.createBundle(
            GM_CONSTANTS.localeGreasemonkeyProperties)
            .GetStringFromName("error.invalidUrl")
            .replace("%1", aDetails.url),
        this.fileURL, null);
  }

  // This is important - without it, GM_xmlhttpRequest can be used
  // to get access to things like files and chrome.
  // Careful.
  switch (uri.scheme) {
    case "blob":
    case "data":
    case "ftp":
    case "http":
    case "https":
      var req = new XMLHttpRequest(
          // Firefox 41+
          // http://bugzil.la/1163898
          (aDetails.mozAnon || aDetails.anonymous)
          ? {
            "mozAnon": true,
          }
          : {});
      GM_util.hitch(this, "chromeStartRequest", url, aDetails, req)();
      break;
    default:
      throw new this.wrappedContentWin.Error(
          GM_CONSTANTS.localeStringBundle.createBundle(
              GM_CONSTANTS.localeGreasemonkeyProperties)
              .GetStringFromName("error.disallowedScheme")
              .replace("%1", aDetails.url),
          this.fileURL, null);
  }

  var rv = {
    "abort": function () {
      return req.abort();
    },
    "finalUrl": null,
    "readyState": null,
    "responseHeaders": null,
    "responseText": null,
    "status": null,
    "statusText": null,
  };

  if (!!aDetails.synchronous) {
    rv.finalUrl = req.finalUrl;
    rv.readyState = req.readyState;
    rv.responseHeaders = req.getAllResponseHeaders();
    try {
      rv.responseText = req.responseText;
    } catch (e) {
      // Some response types don't have .responseText
      // (but do have e.g. blob .response).
      // Ignore.
    }
    rv.status = req.status;
    rv.statusText = req.statusText;
  }

  rv = Cu.cloneInto({
    "abort": rv.abort.bind(rv),
    "finalUrl": rv.finalUrl,
    "readyState": rv.readyState,
    "responseHeaders": rv.responseHeaders,
    "responseText": rv.responseText,
    "status": rv.status,
    "statusText": rv.statusText,
  }, this.sandbox, {
    "cloneFunctions": true,
  });

  return rv;
};

// This function is intended to be called in chrome's security context,
// so that it can access other domains without security warning.
GM_xmlHttpRequester.prototype.chromeStartRequest =
function (aSafeUrl, aDetails, aReq) {
  let setupRequestEvent = GM_util.hitch(
      this, "setupRequestEvent", this.wrappedContentWin, this.sandbox,
      this.fileURL);

  setupRequestEvent(aReq, "abort", aDetails);
  setupRequestEvent(aReq, "error", aDetails);
  setupRequestEvent(aReq, "load", aDetails);
  setupRequestEvent(aReq, "loadend", aDetails);
  setupRequestEvent(aReq, "loadstart", aDetails);
  setupRequestEvent(aReq, "progress", aDetails);
  setupRequestEvent(aReq, "readystatechange", aDetails);
  setupRequestEvent(aReq, "timeout", aDetails);
  if (aDetails.upload) {
    setupRequestEvent(aReq.upload, "abort", aDetails.upload);
    setupRequestEvent(aReq.upload, "error", aDetails.upload);
    setupRequestEvent(aReq.upload, "load", aDetails.upload);
    setupRequestEvent(aReq.upload, "loadend", aDetails.upload);
    setupRequestEvent(aReq.upload, "progress", aDetails.upload);
    setupRequestEvent(aReq.upload, "timeout", aDetails.upload);
  }

  aReq.mozBackgroundRequest = !!aDetails.mozBackgroundRequest;

  // See #1945, #2008 - part 2/3.
  /*
  let safeUrlTmp = new this.wrappedContentWin.URL(aSafeUrl);
  var headersArr = [];
  var authorization = {
    "contrains": false,
    "method": "Basic",
    "password": "",
    "string": "Authorization",
    "user": "",
  };
  let authenticationComponent = Cc["@mozilla.org/network/http-auth-manager;1"]
      .getService(Ci.nsIHttpAuthManager);
  var authorizationRegexp = new RegExp(
      "^\\s*" + authorization.method + "\\s*([^\\s]+)\\s*$", "i");

  if (aDetails.headers) {
    var headers = aDetails.headers;

    for (var prop in headers) {
      if (Object.prototype.hasOwnProperty.call(headers, prop)) {
        headersArr.push({
          "prop": prop,
          "value": headers[prop],
        });
        if (prop.toString().toLowerCase()
            == authorization.string.toLowerCase()) {
          let authorizationValue = headers[prop].match(authorizationRegexp);
          if (authorizationValue) {
            authorizationValue = atob(authorizationValue[1]);
            let authorizationUserPassword = authorizationValue.match(
                AUTHORIZATION_USER_PASSWORD_REGEXP);
            if (authorizationUserPassword) {
              authorization.contrains = true;
              authorization.user = authorizationUserPassword[1];
              authorization.password = authorizationUserPassword[2];
            }
          }
        }
      }
    }
  }

  if ((authorization.user || authorization.password)
      || (aDetails.user || aDetails.password)) {
    authenticationComponent.setAuthIdentity(
        safeUrlTmp.protocol,
        safeUrlTmp.hostname,
        (safeUrlTmp.port || ""),
        ((authorization.contrains)
          ? authorization.method : ""),
        "",
        "",
        "",
        (authorization.user
          || aDetails.user || ""),
        (authorization.password
          || aDetails.password || ""));
  } else {
    let authorizationDomain = {};
    let authorizationUser = {};
    let authorizationPassword = {};
    try {
      authenticationComponent.getAuthIdentity(
          safeUrlTmp.protocol,
          safeUrlTmp.hostname,
          (safeUrlTmp.port || ""),
          "",
          "",
          "",
          authorizationDomain,
          authorizationUser,
          authorizationPassword);
      aDetails.user = authorizationUser.value || "";
      aDetails.password = authorizationPassword.value || "";
    } catch (e) {
      // Ignore.
    }
  }
  */

  // See #2423.
  // http://bugzil.la/1275746
  try {
    aReq.open(aDetails.method, aSafeUrl,
        !aDetails.synchronous, aDetails.user || "", aDetails.password || "");
  } catch (e) {
    throw new this.wrappedContentWin.Error(
        "GM_xmlhttpRequest():"
        + "\n" + aDetails.url + "\n" + e,
        this.fileURL, null);
  }

  // Pale Moon 27.2.x-
  // https://github.com/MoonchildProductions/Pale-Moon/pull/968
  if ((aDetails.mozAnon || aDetails.anonymous) && !aReq.mozAnon) {
    aReq.channel.loadFlags |= Ci.nsIRequest.LOAD_ANONYMOUS;
  }

  let channel;

  // Private Browsing, Containers (Firefox 42+).
  let privateMode = false;
  if (GM_util.windowIsPrivate(this.wrappedContentWin)) {
    privateMode = true;
  }
  let userContextId = null;
  if (this.wrappedContentWin.document
      && this.wrappedContentWin.document.nodePrincipal
      && this.wrappedContentWin.document.nodePrincipal.originAttributes
      && this.wrappedContentWin.document.nodePrincipal.originAttributes
          .userContextId) {
    userContextId = this.wrappedContentWin.document.nodePrincipal
        .originAttributes.userContextId;
  }
  if (userContextId === null) {
    if (aReq.channel instanceof Ci.nsIPrivateBrowsingChannel) {
      if (privateMode) {
        channel = aReq.channel.QueryInterface(Ci.nsIPrivateBrowsingChannel);
        channel.setPrivate(true);
      }
    }
  } else {
    aReq.setOriginAttributes({
      "privateBrowsingId": privateMode ? 1 : 0,
      "userContextId": userContextId,
    });
  }
  /*
  dump("GM_xmlhttpRequest - url:" + "\n" + aSafeUrl + "\n"
      + "Private Browsing mode: " + aReq.channel.isChannelPrivate + "\n");
  */

  try {
    channel = aReq.channel.QueryInterface(Ci.nsIHttpChannelInternal);
    channel.forceAllowThirdPartyCookie = true;
  } catch (e) {
    // Ignore.
    // e.g. ftp://
  }

  if (aDetails.overrideMimeType) {
    aReq.overrideMimeType(aDetails.overrideMimeType);
  }
  if (aDetails.responseType) {
    aReq.responseType = aDetails.responseType;
  }

  if (aDetails.timeout) {
    aReq.timeout = aDetails.timeout;
  }

  let httpChannel;
  // Not use: aDetails.redirectionLimit
  // (may have the value: 0 or 1 - a "boolean")
  if ("redirectionLimit" in aDetails) {
    try {
      httpChannel = aReq.channel.QueryInterface(Ci.nsIHttpChannel);
      httpChannel.redirectionLimit = aDetails.redirectionLimit;
    } catch (e) {
      // Ignore.
    }
  }

  // Cookies - reserved for possible future use (see also #2236) - part 2/2.
  /*
  if (aDetails.cookies) {
    try {
      let _cookiesOrig = COOKIES_SERVICE.getCookieString(
          GM_util.getUriFromUrl(this.originUrl), aReq.channel);

      let _cookies = (_cookiesOrig === null) ? "" : _cookiesOrig;

      COOKIES_SERVICE.setCookieString(
          GM_util.getUriFromUrl(aSafeUrl), null, _cookies, aReq.channel);
    } catch (e) {
      throw new this.wrappedContentWin.Error(
          "GM_xmlhttpRequest():"
          + "\n" + e,
          this.fileURL, null);
    }
  }
  */

  // See #1945, #2008 - part 3/3.
  /*
  for (let i = 0, iLen = headersArr.length; i < iLen; i++) {
    aReq.setRequestHeader(headersArr[i].prop, headersArr[i].value);
  }
  */
  if (aDetails.headers) {
    let headers = aDetails.headers;

    for (let prop in headers) {
      if (Object.prototype.hasOwnProperty.call(headers, prop)) {
        aReq.setRequestHeader(prop, headers[prop]);
      }
    }
  }

  let body = aDetails.data ? aDetails.data : null;
  // See #2423.
  // http://bugzil.la/918751
  try {
    if (aDetails.binary && (body !== null)) {
      let bodyLength = body.length;
      let bodyData = new Uint8Array(bodyLength);
      for (let i = 0; i < bodyLength; i++) {
        bodyData[i] = body.charCodeAt(i) & 0xff;
      }
      aReq.send(new Blob([bodyData]));
    } else {
      aReq.send(body);
    }
  } catch (e) {
    throw new this.wrappedContentWin.Error(
        "GM_xmlhttpRequest():"
        + "\n" + aDetails.url + "\n" + e,
        this.fileURL, null);
  }
};

// Arranges for the specified "event" on xmlhttprequest "req" to call
// the method by the same name which is a property of "details"
// in the content window's security context.
GM_xmlHttpRequester.prototype.setupRequestEvent = function (
    aWrappedContentWin, aSandbox, aFileURL, aReq, aEvent, aDetails) {
  // Waive Xrays so that we can read callback function properties...
  aDetails = Cu.waiveXrays(aDetails);
  var eventCallback = aDetails["on" + aEvent];
  if (!eventCallback) {
    return undefined;
  }
  if (typeof eventCallback != "function") {
    throw new aWrappedContentWin.Error(
        GM_CONSTANTS.localeStringBundle.createBundle(
            GM_CONSTANTS.localeGreasemonkeyProperties)
            .GetStringFromName("error.xmlhttpRequest.callbackIsNotFunction")
            .replace("%1", aDetails.url)
            .replace("%2", "on" + aEvent),
        aFileURL, null);
  }

  // ...but ensure that the callback came from a script, not content,
  // by checking that its principal equals that of the sandbox.
  let callbackPrincipal = Cu.getObjectPrincipal(eventCallback);
  if (!this.sandboxPrincipal.equals(callbackPrincipal)) {
    return undefined;
  }

  aReq.addEventListener(aEvent, function (aEvt) {
    var responseState = {
      "context": aDetails.context || null,
      "finalUrl": null,
      "lengthComputable": null,
      "loaded": null,
      "readyState": aReq.readyState,
      "response": aReq.response,
      "responseHeaders": null,
      "responseText": null,
      "responseXML": null,
      "status": null,
      "statusText": null,
      "total": null,
    };

    try {
      responseState.responseText = aReq.responseText;
    } catch (e) {
      // Some response types don't have .responseText
      // (but do have e.g. blob .response).
      // Ignore.
    }

    var responseXML = null;
    try {
      responseXML = aReq.responseXML;
    } catch (e) {
      // At least in responseType blob case, this access fails.
      // Ignore.
    }
    if (responseXML) {
      // Clone the XML object into a content-window-scoped document.
      let xmlDoc;
      try {
        xmlDoc = new aWrappedContentWin.Document();
      } catch (e) {
        try {
          aReq.abort();
        } catch (e) {
          GM_util.logError(
              "GM_xmlHttpRequester.setupRequestEvent - url:"
              + "\n" + '"' + aDetails.url + '":' + "\n" + e, true,
              aFileURL, null);
        }
        return undefined;
      }
      let clone = xmlDoc.importNode(responseXML.documentElement, true);
      xmlDoc.appendChild(clone);
      responseState.responseXML = xmlDoc;
    }

    switch (aEvent) {
      case "progress":
        responseState.lengthComputable = aEvt.lengthComputable;
        responseState.loaded = aEvt.loaded;
        responseState.total = aEvt.total;
        break;
      case "error":
        break;
      default:
        if (2 > aReq.readyState) {
          break;
        }
        responseState.finalUrl = aReq.channel.URI.spec;
        responseState.responseHeaders = aReq.getAllResponseHeaders();
        responseState.status = aReq.status;
        responseState.statusText = aReq.statusText;
        break;
    }

    responseState = Cu.cloneInto({
      "context": responseState.context,
      "finalUrl": responseState.finalUrl,
      "lengthComputable": responseState.lengthComputable,
      "loaded": responseState.loaded,
      "readyState": responseState.readyState,
      "response": responseState.response,
      "responseHeaders": responseState.responseHeaders,
      "responseText": responseState.responseText,
      "responseXML": responseState.responseXML,
      "status": responseState.status,
      "statusText": responseState.statusText,
      "total": responseState.total,
    }, aSandbox, {
      "cloneFunctions": true,
      "wrapReflectors": true,
    });

    if (GM_util.windowIsClosed(aWrappedContentWin)) {
      try {
        aReq.abort();
      } catch (e) {
        GM_util.logError(
            "GM_xmlHttpRequester.setupRequestEvent - url:"
            + "\n" + '"' + aDetails.url + '":' + "\n" + e, true,
            aFileURL, null);
      }
      return undefined;
    }

    // Pop back onto browser thread and call event handler.
    // Have to use nested function here instead of GM_util.hitch
    // because otherwise aDetails[aEvent].apply can point to window.setTimeout,
    // which can be abused to get increased privileges.
    new XPCNativeWrapper(aWrappedContentWin, "setTimeout()")
      .setTimeout(function () {
        eventCallback.call(aDetails, responseState);
      }, 0);
  }, false);
};
