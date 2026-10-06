/*
 * הגדרות המסך של בית הכנסת המאור.
 * זה הקובץ היחיד שצריך לערוך כדי לשנות זמני תפילות קבועים.
 * מודעות השיעורים נמצאות בקובץ נפרד: data/announcements.json
 */
var CONFIG = {
  name: 'בית כנסת המאור',
  address: 'עולי ציון 13, יפו',

  // מיקום לחישוב הזמנים: תל אביב, בדיוק כמו באתר צעירי חב"ד
  location: { lat: 32 + 5 / 60, lng: 34 + 46 / 60 },

  // דקות לפני השקיעה להדלקת נרות (לפי אתר צעירי חב"ד לתל אביב)
  candleMinutesBefore: 22,

  // זמני תפילות בימי חול. ימים: 0 = ראשון ... 5 = שישי
  // notOnErev: לא מתקיים בערב חג (במקומו מתפללים לפי זמני ערב שבת/חג)
  weekdayPrayers: [
    { id: 'shacharit', label: 'שחרית', days: [0, 1, 2, 3, 4, 5], time: { fixed: '8:15' } },
    { id: 'minchaEarly', label: 'מנחה מוקדמת', days: [0, 1, 2, 3, 4], time: { fixed: '13:30' } },
    { id: 'mincha', label: 'מנחה', days: [0, 1, 2, 3, 4], notOnErev: true, time: { beforeShkia: 10, roundDownTo: 5 } },
    { id: 'maariv', label: 'ערבית', days: [0, 1, 2, 3, 4], notOnErev: true, time: { after: 'mincha', minutes: 35 } }
  ],

  // תפילות שבת וחג.
  //   on: 'erev'    = ערב שבת / ערב חג
  //   on: 'shabbat' = שבת / יום טוב
  // סוגי זמן נוספים:
  //   { afterCandles: 10 }      X דקות אחרי הדלקת נרות
  //   { beforeHavdalah: 75 }    X דקות לפני צאת השבת
  //   { shabbatMorning: ... }   לפי שעון חורף/קיץ ושבת רגילה/שבת מברכים
  //   roundDownTo: 5            עיגול כלפי מטה ל-5 דקות (17:37 => 17:35)
  shabbatPrayers: [
    { id: 'minchaErev', label: 'מנחה', on: 'erev', time: { afterCandles: 10, roundDownTo: 5 } },
    { id: 'kabbalat', label: 'קבלת שבת', labelChag: 'ערבית', on: 'erev', time: { after: 'minchaErev', minutes: 30 } },
    {
      id: 'shacharitShabbat', label: 'שחרית', on: 'shabbat',
      time: {
        shabbatMorning: {
          regular: { winter: '9:00', summer: '9:30' },
          mevarchim: { winter: '9:30', summer: '10:00' }
        }
      }
    },
    { id: 'minchaShabbat', label: 'מנחה', on: 'shabbat', time: { beforeHavdalah: 75, roundDownTo: 5 } },
    { id: 'maarivMotzash', label: 'ערבית', on: 'shabbat', time: { beforeHavdalah: 0, roundDownTo: 5 } }
  ],

  // מודעות מתחלפות: כמה שניות כל מודעה
  announcementSeconds: 15,

  // כל כמה דקות לבדוק אם יש מודעות חדשות
  refreshDataMinutes: 5,

  // שעה שבה המסך נטען מחדש כל לילה (שומר על יציבות לאורך זמן)
  nightlyReload: '3:30'
};
