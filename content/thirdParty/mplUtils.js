/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Mozilla.org Code.
 *
 * The Initial Developer of the Original Code is
 * the Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 2001
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Blake Ross <blakeross@telocity.com> (Original Author)
 *   Ben Goodger <ben@bengoodger.com> (v2.0)
 *   Dan Mosedale <dmose@mozilla.org>
 *   Fredrik Holmqvist <thesuckiestemail@yahoo.se>
 *   Josh Aas <josh@mozilla.com>
 *   Shawn Wilsher <me@shawnwilsher.com> (v3.0)
 *   Edward Lee <edward.lee@engineering.uiuc.edu>
 *
 *   Anthony Lieuallen <arantius@gmail.com>
 *   Mike Medley <medleymind@gmail.com>
 *
 * ***** END LICENSE BLOCK ***** */

if (typeof Cc === "undefined") {
  var Cc = Components.classes;
}
if (typeof Ci === "undefined") {
  var Ci = Components.interfaces;
}
if (typeof Cu === "undefined") {
  var Cu = Components.utils;
}


function GM_openFolder(aFile) {
  try {
    // Show the directory containing the file and select the file.
    aFile.QueryInterface(Ci.nsIFile).reveal();
  } catch (e) {
    // Either the file doesn't exist or reveal is not implemented.
    var fParent = aFile.parent;

    try {
      // Launch the parent directory if the file doesn't exist.
      if (fParent.exists()) {
        fParent.launch();
      }
    } catch (e) {
      // If launch also fails let the OS handler try to open the parent.
      let uri = Cc["@mozilla.org/network/io-service;1"]
          .getService(Ci.nsIIOService)
          .newFileURI(fParent);
      let externalProtocolSvc = 
          Cc["@mozilla.org/uriloader/external-protocol-service;1"]
          .getService(Ci.nsIExternalProtocolService);

      externalProtocolSvc.loadUrl(uri);
    }
  }
}
