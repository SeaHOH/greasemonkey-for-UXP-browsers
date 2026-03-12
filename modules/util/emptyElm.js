const EXPORTED_SYMBOLS = ["emptyElm"];


function emptyElm(aElm) {
  while (aElm.firstChild) {
    aElm.removeChild(aElm.firstChild);
  }
}
