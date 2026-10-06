/*
 * שיעורי חת"ת: חומש ותהלים מחושבים כאן. תניא ופתגם היום יום מגיעים מ-data/daily.json
 * (כי הם לפי לוח שנתי ולא לפי נוסחה).
 */
var Learning = (function () {
  // תהלים לפי ימי החודש: [מפרק, עד פרק] או טקסט מיוחד
  var TEHILLIM = {
    1: [1, 9], 2: [10, 17], 3: [18, 22], 4: [23, 28], 5: [29, 34], 6: [35, 38],
    7: [39, 43], 8: [44, 48], 9: [49, 54], 10: [55, 59], 11: [60, 65], 12: [66, 68],
    13: [69, 71], 14: [72, 76], 15: [77, 78], 16: [79, 82], 17: [83, 87], 18: [88, 89],
    19: [90, 96], 20: [97, 103], 21: [104, 105], 22: [106, 107], 23: [108, 112],
    24: [113, 118], 25: 'פרק קי"ט, פסוקים א-צו', 26: 'פרק קי"ט, פסוקים צז-קעו',
    27: [120, 134], 28: [135, 139], 29: [140, 144], 30: [145, 150]
  };

  var ALIYOT = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שביעי'];

  function num(n) {
    return hebcal.gematriya(n);
  }

  function tehillim(hdate) {
    var day = hdate.getDate();
    var entry = TEHILLIM[day];
    // בחודש חסר (29 ימים) אומרים ביום כ"ט גם את של יום ל'
    if (day === 29 && hdate.daysInMonth() === 29) entry = [140, 150];
    if (typeof entry === 'string') return entry;
    return 'פרקים ' + num(entry[0]) + '–' + num(entry[1]);
  }

  // הפרשה שלומדים השבוע: הפרשה של השבת הקרובה (בארץ ישראל).
  // בשבוע שהשבת שלו היא חג סדר הלימוד מיוחד, ולכן לא מנחשים: הנתון יגיע מ-daily.json.
  function weekParsha(date) {
    var sat = new Date(date.getFullYear(), date.getMonth(), date.getDate() + (6 - date.getDay()));
    var hd = new hebcal.HDate(sat);
    var res = hebcal.getSedra(hd.getFullYear(), true).lookup(hd);
    if (res.chag || !res.parsha || !res.parsha.length) return '';
    return res.parsha.map(function (p) {
      return hebcal.Locale.gettext(p, 'he-x-NoNikud');
    }).join('-');
  }

  function chumash(date) {
    var parsha = weekParsha(date);
    if (!parsha) return '';
    return 'פרשת ' + parsha + ', ' + ALIYOT[date.getDay()];
  }

  return { tehillim: tehillim, chumash: chumash, weekParsha: weekParsha };
})();
