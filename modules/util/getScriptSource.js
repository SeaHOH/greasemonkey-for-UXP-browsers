const EXPORTED_SYMBOLS = ["getScriptSource"];


// Given a script, return its entire source as a plain string.
function getScriptSource(aScript) {
  let parts = [];
  let offsets = [];
  let offset = 0;

  aScript.requires.forEach(function (aReq) {
    let contents = aReq.textContent;
    let lineCount = contents.split("\n").length;
    parts.push(contents);
    offset += lineCount;
    offsets.push(offset);
  });
  aScript.offsets = offsets;

  // These newlines are critical for error line calculation.
  // The last handles a script whose final line is a line comment,
  // to not break the wrapper function.
  // See #1491.
  // The semicolons after requires fix a failure of javascript's semicolon
  // insertion rules.
  parts.push(aScript.textContent);
  let scriptSrc = parts.join(";\n") + "\n";

  return scriptSrc;
}
