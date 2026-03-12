const EXPORTED_SYMBOLS = ["inArray"];


function inArray(aArr, aVal, aCaseInsensitive) {
  if ("includes" in Array.prototype) {
    if (aCaseInsensitive) {
      aArr = aArr.map(function (aItem) {
        return aItem.toLowerCase();
      });
      aVal = aVal.toLowerCase();
    }

    return aArr.includes(aVal);
  } else {
    for (let i = 0, iLen = aArr.length; i < iLen; i++) {
      let val = aArr[i];
      if (aCaseInsensitive) {
        aVal = aVal.toLowerCase();
        val = val.toLowerCase();
      }
      if (aVal === val) {
        return true;
      }
    }

    return false;
  }
}
