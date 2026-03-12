const EXPORTED_SYMBOLS = ["scriptMatchesUrlAndRuns"];


function scriptMatchesUrlAndRuns(aScript, aUrl, aWhen) {
  return !aScript.pendingExec.length
      && aScript.enabled
      && !aScript.needsUninstall
      && ((aWhen == aScript.runAt) || (aWhen == "any"))
      && aScript.matchesURL(aUrl);
}
