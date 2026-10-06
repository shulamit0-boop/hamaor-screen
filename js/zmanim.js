/*
 * זמני היום לפי שיטת חב"ד, באותם פרמטרים שבהם משתמש אתר צעירי חב"ד (chabad.org.il),
 * כדי שהזמנים על המסך יתאימו לאתר עד הדקה.
 * חישוב השמש: האלגוריתם הציבורי של Almanac for Computers (מצפה הכוכבים של הצי האמריקאי).
 */
var Zmanim = (function () {
  // הקבועים המעוגלים של האלגוריתם המקורי, כדי שהעיגול לדקה יהיה זהה לאתר
  var DEG = 0.0174533;
  var QUARTER = 1.5708;
  var HALF = 3.14159;
  var THREE_QUARTERS = 4.71239;
  var TWO_PI = 6.28319;

  // זווית השמש מתחת לאופק (מעלות מהזנית) לכל זמן
  var ZENITH = {
    netzShkia: 90 + 46.8 / 60,   // הנץ ושקיעה
    candles: 90 + 50 / 60,       // שקיעה לחישוב הדלקת נרות
    alot: 105 + 59.4 / 60,       // עלות השחר (72 דקות בימים בינוניים)
    misheyakir: 101 + 30 / 60,   // זמן ציצית ותפילין
    tzeit: 95 + 52.8 / 60,       // צאת הכוכבים
    motzei: 98 + 30 / 60         // צאת השבת (שלושה כוכבים קטנים)
  };

  function isLeap(y) { return (y % 400 === 0) || (y % 100 !== 0 && y % 4 === 0); }

  // כמו באתר: מספר היום בשנה מוסט ביום אחד (1 בינואר = 2)
  function dayNumber(y, m, d) {
    var start = [0, 1, 32, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335];
    return start[m] + d + ((m > 2 && isLeap(y)) ? 1 : 0);
  }

  function wrap(x) {
    while (x < 0) x += TWO_PI;
    while (x >= TWO_PI) x -= TWO_PI;
    return x;
  }

  // מחזיר שעה עשרונית מקומית, או null אם השמש לא מגיעה לזווית הזו
  function sunEvent(y, m, d, zenith, rising, loc, tzHours) {
    var lat = loc.lat * DEG;
    var lng = loc.lng * DEG;
    var t = dayNumber(y, m, d) + ((rising ? QUARTER : THREE_QUARTERS) - lng) / TWO_PI;

    var meanAnomaly = t * 0.017202 - 0.0574039;
    var trueLong = wrap(meanAnomaly + 0.0334405 * Math.sin(meanAnomaly) +
      4.93289 + 3.49066e-4 * Math.sin(2 * meanAnomaly));

    var ra = Math.atan(0.91746 * Math.tan(trueLong));
    if (trueLong > THREE_QUARTERS) ra += TWO_PI;
    else if (trueLong > QUARTER) ra += HALF;

    var dec = Math.asin(0.39782 * Math.sin(trueLong));
    var cosH = (Math.cos(0.01745 * zenith) - Math.sin(dec) * Math.sin(lat)) /
      (Math.cos(dec) * Math.cos(lat));
    if (Math.abs(cosH) > 1) return null;

    var hourAngle = QUARTER - Math.asin(cosH);
    if (rising) hourAngle = TWO_PI - hourAngle;

    var localApparent = hourAngle + ra - 0.0172028 * t - 1.73364;
    var wall = wrap(localApparent - lng + tzHours * 0.261799);
    return wall * 3.81972;
  }

  // עיגול לדקה הקרובה, כמו באתר. מחזיר דקות מחצות.
  function toMinutes(hours) {
    if (hours === null || isNaN(hours)) return null;
    var h = Math.floor(hours);
    var min = Math.floor((hours - h) * 60 + 0.5);
    return h * 60 + min;
  }

  // הפרש השעות של ישראל מ-UTC בתאריך נתון (2 בחורף, 3 בקיץ)
  function israelOffset(y, m, d) {
    try {
      var probe = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
      var hour = parseInt(new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Jerusalem', hour: '2-digit', hour12: false
      }).format(probe), 10);
      return hour - 12;
    } catch (e) {
      return -new Date(y, m - 1, d, 12).getTimezoneOffset() / 60;
    }
  }

  // y, m, d לועזיים (m = 1..12)
  function forDay(y, m, d, loc) {
    var tz = israelOffset(y, m, d);
    var rise = sunEvent(y, m, d, ZENITH.netzShkia, true, loc, tz);
    var set = sunEvent(y, m, d, ZENITH.netzShkia, false, loc, tz);
    var hour = (set - rise) / 12; // שעה זמנית

    return {
      alot: toMinutes(sunEvent(y, m, d, ZENITH.alot, true, loc, tz)),
      misheyakir: toMinutes(sunEvent(y, m, d, ZENITH.misheyakir, true, loc, tz)),
      netz: toMinutes(rise),
      shema: toMinutes(rise + hour * 3 - 2 / 60),
      tefila: toMinutes(rise + hour * 4),
      chatzot: toMinutes(rise + hour * 6),
      minchaGedola: toMinutes(hour >= 1 ? rise + hour * 6.5 : rise + hour * 6 + 0.5),
      minchaKetana: toMinutes(rise + hour * 9.5),
      plag: toMinutes(rise + hour * 10.75),
      shkia: toMinutes(set),
      tzeit: toMinutes(sunEvent(y, m, d, ZENITH.tzeit, false, loc, tz))
    };
  }

  // הדלקת נרות: שקיעה (90°50') פחות מספר הדקות שנהוג בעיר
  function candleLighting(y, m, d, loc, minutesBefore) {
    var tz = israelOffset(y, m, d);
    var set = sunEvent(y, m, d, ZENITH.candles, false, loc, tz);
    return toMinutes(set - minutesBefore / 60);
  }

  // צאת שבת / חג
  function havdalah(y, m, d, loc) {
    var tz = israelOffset(y, m, d);
    return toMinutes(sunEvent(y, m, d, ZENITH.motzei, false, loc, tz));
  }

  function format(minutes) {
    if (minutes === null || minutes === undefined) return '—';
    var h = Math.floor(minutes / 60) % 24;
    var mm = minutes % 60;
    return h + ':' + (mm < 10 ? '0' : '') + mm;
  }

  return {
    forDay: forDay,
    candleLighting: candleLighting,
    havdalah: havdalah,
    format: format,
    israelOffset: israelOffset
  };
})();
