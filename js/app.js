(function () {
  var C = CONFIG;
  var F = hebcal.flags;
  var DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  var DAY_LETTERS = ['א\'', 'ב\'', 'ג\'', 'ד\'', 'ה\'', 'ו\'', 'ש"ק'];

  var ZMANIM_ROWS = [
    { id: 'alot', label: 'עלות השחר' },
    { id: 'misheyakir', label: 'זמן ציצית ותפילין' },
    { id: 'netz', label: 'הנץ החמה' },
    { id: 'shema', label: 'סוף זמן קריאת שמע', key: true },
    { id: 'tefila', label: 'סוף זמן תפילה', key: true },
    { id: 'chatzot', label: 'חצות היום' },
    { id: 'minchaGedola', label: 'מנחה גדולה' },
    { id: 'minchaKetana', label: 'מנחה קטנה' },
    { id: 'plag', label: 'פלג המנחה' },
    { id: 'shkia', label: 'שקיעה', key: true },
    { id: 'tzeit', label: 'צאת הכוכבים' }
  ];

  var state = {
    announcements: [],
    daily: {},
    live: {},
    annIndex: 0,
    annTimer: null,
    online: true,
    awake: false,
    loadedAt: Date.now()
  };

  function $(id) { return document.getElementById(id); }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  // ---------- זמן ותאריך (תמיד לפי שעון ישראל, גם אם השעון של הטלוויזיה מוגדר אחרת) ----------

  // לבדיקות: index.html?now=2026-10-09T15:00 מציג את המסך כאילו זה הזמן הזה (שעון ישראל)
  var clockOffset = 0;
  (function () {
    var m = /[?&]now=([^&]+)/.exec(location.search);
    if (!m) return;
    var target = new Date(decodeURIComponent(m[1]) + '+03:00');
    if (!isNaN(target)) clockOffset = target.getTime() - Date.now();
  })();

  function israelNow() {
    var p = {};
    try {
      new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
      }).formatToParts(new Date(Date.now() + clockOffset)).forEach(function (x) { p[x.type] = x.value; });
    } catch (e) {
      var n = new Date();
      p = { year: n.getFullYear(), month: n.getMonth() + 1, day: n.getDate(),
        hour: n.getHours(), minute: n.getMinutes(), second: n.getSeconds() };
    }
    var h = parseInt(p.hour, 10) % 24;
    var min = parseInt(p.minute, 10);
    return {
      date: new Date(+p.year, +p.month - 1, +p.day),
      h: h, min: min, sec: parseInt(p.second, 10),
      minutes: h * 60 + min
    };
  }

  function addDays(date, n) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);
  }

  function dayKey(date) {
    var m = date.getMonth() + 1, d = date.getDate();
    return date.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (d < 10 ? '0' : '') + d;
  }

  function parseHM(s) {
    var p = String(s).split(':');
    return parseInt(p[0], 10) * 60 + parseInt(p[1], 10);
  }

  var zCache = {};
  function zmanimFor(date) {
    var k = dayKey(date);
    if (!zCache[k]) zCache[k] = Zmanim.forDay(date.getFullYear(), date.getMonth() + 1, date.getDate(), C.location);
    return zCache[k];
  }
  function candles(date) {
    return Zmanim.candleLighting(date.getFullYear(), date.getMonth() + 1, date.getDate(), C.location, C.candleMinutesBefore);
  }
  function havdalah(date) {
    return Zmanim.havdalah(date.getFullYear(), date.getMonth() + 1, date.getDate(), C.location);
  }

  function holidays(date) {
    return hebcal.HebrewCalendar.getHolidaysOnDate(new hebcal.HDate(date), true) || [];
  }
  function heb(ev) { return ev.render('he-x-NoNikud').replace(/\s*\d{4}$/, ''); }
  function isChag(date) {
    return holidays(date).some(function (e) { return e.getFlags() & F.CHAG; });
  }

  function countdown(diff) {
    if (diff < 1) return 'עכשיו';
    if (diff < 60) return 'בעוד ' + diff + ' דק\'';
    var h = Math.floor(diff / 60), m = diff % 60;
    return 'בעוד ' + h + ':' + (m < 10 ? '0' : '') + m + ' שע\'';
  }

  // ---------- רשימות זמנים ----------

  // rows: [{label, t, key, at}], now: דקות מחצות היום, או null כדי לא לסמן עבר/הבא.
  // at: מועד להשוואה כשהשורה שייכת ליום אחר (ימים מהיום × 1440 + t)
  function prayerIcon(id) {
    var paths = {
      shacharit: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
      minchaEarly: '<circle cx="12" cy="12" r="7"/><path d="M12 8v4l3 2"/>',
      mincha: '<path d="M3 17h18M6 14a6 6 0 0 1 12 0M12 3v3M4 7l2 2m14-2-2 2"/>',
      maariv: '<path d="M20 14a8 8 0 0 1-10-10 8 8 0 1 0 10 10Z"/>'
    };
    return paths[id] ? '<svg class="prayer-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">'+paths[id]+'</svg>' : '';
  }

  function timesHtml(rows, now) {
    var nextFound = false;
    return rows.map(function (r) {
      if (r.head) return '<li class="chag-head"><span>' + esc(r.head) + '</span></li>';
      var cls = r.key ? ['key'] : [];
      var cd = '';
      var at = r.at !== undefined ? r.at : r.t;
      if (now !== null && at !== null && at !== undefined) {
        if (at < now) cls.push('past');
        else if (!nextFound) {
          nextFound = true;
          cls.push('next');
          if (at - now <= 60) cd = countdown(at - now);
        }
      }
      return '<li class="' + cls.join(' ') + '"><span class="label" data-countdown="' + esc(cd) + '">' +
        prayerIcon({'שחרית':'shacharit','מנחה מוקדמת':'minchaEarly','מנחה':'mincha','ערבית':'maariv'}[r.label]) + esc(r.label) + '</span><span class="t">' + Zmanim.format(r.t) + '</span></li>';
    }).join('');
  }

  function renderTimes(el, rows, now) {
    el.innerHTML = timesHtml(rows, now);
  }

  function daysBetween(a, b) {
    return Math.round((b - a) / 86400000);
  }

  function isSummerTime(date) {
    return Zmanim.israelOffset(date.getFullYear(), date.getMonth() + 1, date.getDate()) === 3;
  }

  // שבת מברכים: השבת האחרונה בחודש לפני ראש חודש (כ"ג עד כ"ט), חוץ מחודש אלול
  function isMevarchim(date) {
    if (date.getDay() !== 6) return false;
    var hd = new hebcal.HDate(date);
    return hd.getMonth() !== hebcal.months.ELUL && hd.getDate() >= 23 && hd.getDate() <= 29;
  }

  // ערב שבת או ערב חג (לא כשהחג מתחיל במוצאי שבת)
  function isErev(date) {
    if (date.getDay() === 5) return true;
    if (date.getDay() === 6) return false;
    return holidays(date).some(function (e) {
      return (e.getFlags() & F.EREV) && (e.getFlags() & F.LIGHT_CANDLES);
    });
  }

  function isRestDay(date) {
    return date.getDay() === 6 || isChag(date);
  }

  function resolveTime(spec, date, done) {
    var t = null;
    if (spec.fixed) t = parseHM(spec.fixed);
    else if (spec.shabbatMorning) {
      var set = isMevarchim(date) ? spec.shabbatMorning.mevarchim : spec.shabbatMorning.regular;
      t = parseHM(isSummerTime(date) ? set.summer : set.winter);
    }
    else if (spec.beforeShkia !== undefined) {
      // weeklyBySunday: הזמן נקבע לפי השקיעה של יום ראשון ונשאר קבוע כל השבוע
      var base = spec.weeklyBySunday ? addDays(date, -date.getDay()) : date;
      t = zmanimFor(base).shkia - spec.beforeShkia;
    }
    else if (spec.afterCandles !== undefined) t = candles(date) + spec.afterCandles;
    else if (spec.beforeHavdalah !== undefined) t = havdalah(date) - spec.beforeHavdalah;
    else if (spec.after) t = done[spec.after] === undefined || done[spec.after] === null ? null : done[spec.after] + spec.minutes;
    if (t !== null && spec.roundDownTo) t = Math.floor(t / spec.roundDownTo) * spec.roundDownTo;
    return t;
  }

  function prayerLabel(p, date) {
    return (p.labelChag && date.getDay() !== 5 && date.getDay() !== 6) ? p.labelChag : p.label;
  }

  // on: 'erev' = ערב שבת/חג, 'shabbat' = שבת/חג
  function shabbatPrayersFor(date, on, done) {
    var rows = [];
    C.shabbatPrayers.forEach(function (p) {
      if (p.on !== on) return;
      var t = resolveTime(p.time, date, done);
      done[p.id] = t;
      rows.push({ label: prayerLabel(p, date), t: t });
    });
    return rows;
  }

  function prayersFor(date) {
    var dow = date.getDay();
    var rest = isRestDay(date);
    var erev = isErev(date);
    var done = {};
    var rows = [];
    if (!rest) {
      C.weekdayPrayers.forEach(function (p) {
        if (p.days.indexOf(dow) < 0) return;
        if (erev && p.notOnErev) return;
        var t = resolveTime(p.time, date, done);
        done[p.id] = t;
        rows.push({ label: p.label, t: t });
      });
    }
    if (rest) rows = rows.concat(shabbatPrayersFor(date, 'shabbat', done));
    if (erev) rows = rows.concat(shabbatPrayersFor(date, 'erev', done));
    rows.sort(function (a, b) { return a.t - b.t; });
    return rows;
  }

  function renderPrayers(now) {
    var today = prayersFor(now.date);
    var last = today.length ? today[today.length - 1].t : -1;
    // אחרי התפילה האחרונה מציגים כבר את התפילות של מחר
    if (now.minutes > last + 20) {
      var tomorrow = addDays(now.date, 1);
      $('prayers-title').innerHTML = 'תפילות מחר <small>יום ' + DAYS[tomorrow.getDay()] + '</small>';
      var rows = prayersFor(tomorrow);
      renderTimes($('prayers'), rows.length ? rows : [{ label: 'זמני התפילות יפורסמו', t: null }], null);
    } else {
      $('prayers-title').innerHTML = 'תפילות היום';
      renderTimes($('prayers'), today, now.minutes);
    }
    fitPanel($('prayers'));
  }

  // אחרי צאת הכוכבים מציגים כבר את הזמנים של מחר
  function renderZmanim(now) {
    var z = zmanimFor(now.date);
    var tomorrow = z.tzeit !== null && now.minutes >= z.tzeit + 30;
    if (tomorrow) z = zmanimFor(addDays(now.date, 1));
    // בלילה היום העברי הבא כבר התחיל ("אור ליום..."), אז כותבים את שם היום במקום "מחר"
    $('zmanim-title').textContent = tomorrow ? 'זמני יום ' + DAYS[addDays(now.date, 1).getDay()] : 'זמני היום';
    renderTimes($('zmanim'), ZMANIM_ROWS.map(function (r) {
      return { label: r.label, t: z[r.id], key: r.key };
    }), tomorrow ? null : now.minutes);
    fitPanel($('zmanim'));
  }

  // ---------- שבת וחג ----------

  function parshaName(sat) {
    var hd = new hebcal.HDate(sat);
    var res = hebcal.getSedra(hd.getFullYear(), true).lookup(hd);
    if (res.chag || !res.parsha || !res.parsha.length) {
      var ev = holidays(sat).filter(function (e) { return e.getFlags() & (F.CHAG | F.CHOL_HAMOED); })[0];
      return ev ? heb(ev) : '';
    }
    return 'פרשת ' + res.parsha.map(function (p) { return hebcal.Locale.gettext(p, 'he-x-NoNikud'); }).join('-');
  }

  // חג שאינו בשבת בשבוע הקרוב: { name, erev, start, end, endDate }
  function upcomingChag(today) {
    for (var i = -2; i <= 8; i++) {
      var d = addDays(today, i);
      var lights = holidays(d).filter(function (e) {
        return (e.getFlags() & (F.LIGHT_CANDLES | F.LIGHT_CANDLES_TZEIS)) && (e.getFlags() & F.EREV);
      })[0];
      if (!lights) continue;
      var chagDay = addDays(d, 1);
      var chagEv = holidays(chagDay).filter(function (e) { return e.getFlags() & F.CHAG; })[0];
      if (!chagEv) continue;
      var endDate = chagDay;
      for (var j = 0; j < 3; j++) {
        var cand = addDays(chagDay, j);
        if (holidays(cand).some(function (e) { return e.getFlags() & F.YOM_TOV_ENDS; })) { endDate = cand; break; }
      }
      if (endDate < today) continue;
      // חג שמתחיל בערב שבת ומסתיים במוצאי שבת כבר מופיע בכרטיס השבת
      if (d.getDay() === 5 && endDate.getDay() === 6) continue;
      return {
        name: heb(chagEv).replace(/ א׳$| I$/, ''),
        erev: d,
        start: d.getDay() === 6 ? havdalah(d) : candles(d),
        startAfterShabbat: d.getDay() === 6,
        endDate: endDate,
        end: endDate.getDay() === 5 ? null : havdalah(endDate)
      };
    }
    return null;
  }

  function renderShabbat(now) {
    var dow = now.date.getDay();
    var fri = dow === 6 ? addDays(now.date, -1) : addDays(now.date, 5 - dow);
    var sat = addDays(fri, 1);
    var friAt = daysBetween(now.date, fri) * 1440;
    var satAt = daysBetween(now.date, sat) * 1440;
    var shabbatName = 'שבת ' + parshaName(sat);

    var done = {};
    var friRows = [{ label: 'הדלקת נרות', t: candles(fri), key: true }].concat(shabbatPrayersFor(fri, 'erev', done));
    var satRows = shabbatPrayersFor(sat, 'shabbat', done);
    var byTime = function (a, b) { return a.t - b.t; };
    friRows.sort(byTime);
    satRows.sort(byTime);
    if (isChag(addDays(sat, 1))) {
      satRows.push({ label: 'נרות חג, לא לפני', t: havdalah(sat), key: true });
    } else {
      satRows.push({ label: isChag(sat) ? 'צאת השבת והחג' : 'צאת השבת', t: havdalah(sat), key: true });
    }
    friRows.forEach(function (r) { r.at = friAt + r.t; });
    satRows.forEach(function (r) { r.at = satAt + r.t; });
    var shabbatRows = friRows.concat(satRows);

    // חג בשבוע הקרוב: מוצג לפי הסדר הכרונולוגי ביחס לשבת
    var chag = upcomingChag(now.date);
    var chagRows = [];
    if (chag) {
      var erevAt = daysBetween(now.date, chag.erev) * 1440;
      if (chag.erev.getDay() !== 5 && chag.erev.getDay() !== 6) {
        chagRows.push({ label: 'הדלקת נרות', t: chag.start, at: erevAt + chag.start, key: true });
      }
      if (chag.end !== null) {
        chagRows.push({ label: 'צאת החג', t: chag.end, at: daysBetween(now.date, chag.endDate) * 1440 + chag.end, key: true });
      }
    }

    // שתי עמודות: ערב שבת | יום שבת. חג צמוד לשבת נכנס לעמודת יום שבת.
    if (chagRows.length) {
      var gap = daysBetween(fri, chag.erev);
      if (gap === 0 || gap === 1) satRows = satRows.concat(chagRows);
    }
    var friDone = friRows.every(function (r) { return r.at < now.minutes; });
    var cols = '<div class="shabbat-cols">' +
      '<div><div class="col-head">ערב שבת</div><ul class="times">' + timesHtml(friRows, now.minutes) + '</ul></div>' +
      '<div><div class="col-head">יום שבת</div><ul class="times">' + timesHtml(satRows, friDone ? now.minutes : null) + '</ul></div>' +
      '</div>';
    // חג באמצע השבוע מוצג בפס העליון (ראו chagChip)
    var html = cols;
    $('shabbat-title').textContent = shabbatName;
    $('shabbat-sub').textContent = new hebcal.HDate(sat).renderGematriya(true).replace(/ \S+$/, '');
    $('shabbat').innerHTML = html;
    fitPanel($('shabbat'));
  }

  // מקטין את הגופן של רשימה עד שהיא נכנסת בפאנל שלה
  function fitPanel(list) {
    var panel = list.parentNode;
    list.style.fontSize = '';
    for (var size = 1; panel.scrollHeight > panel.clientHeight + 1 && size > 0.6; size -= 0.04) {
      list.style.fontSize = size + 'rem';
    }
  }

  // חג שלא צמוד לשבת: "פסח (יום ה'): הדלקת נרות 18:53 · צאת החג 19:54"
  function chagChip(now) {
    var chag = upcomingChag(now.date);
    if (!chag) return '';
    var dow = now.date.getDay();
    var fri = dow === 6 ? addDays(now.date, -1) : addDays(now.date, 5 - dow);
    var diff = daysBetween(fri, chag.erev);
    if (diff === 0 || diff === 1) return '';
    var parts = [];
    var erevAt = daysBetween(now.date, chag.erev) * 1440 + chag.start;
    if (erevAt >= now.minutes) parts.push('הדלקת נרות ' + Zmanim.format(chag.start));
    if (chag.end !== null) parts.push('צאת החג ' + Zmanim.format(chag.end));
    if (!parts.length) return '';
    return chag.name + ' (יום ' + DAY_LETTERS[addDays(chag.erev, 1).getDay()] + '): ' + parts.join(' · ');
  }

  // ---------- כותרת ----------

  function renderHeader(now) {
    var z = zmanimFor(now.date);
    var hd = new hebcal.HDate(now.date);
    var afterNight = z.tzeit !== null && now.minutes >= z.tzeit;
    if (afterNight) {
      var tomorrow = addDays(now.date, 1);
      $('heb-date').textContent = 'אור ליום ' + DAY_LETTERS[tomorrow.getDay()] + ' ' +
        new hebcal.HDate(tomorrow).renderGematriya(true);
    } else {
      $('heb-date').textContent = 'יום ' + DAYS[now.date.getDay()] + ', ' + hd.renderGematriya(true);
    }
    $('greg-date').textContent = new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'long', year: 'numeric' }).format(now.date);

    var chips = [];
    var dow = now.date.getDay();
    var sat = addDays(now.date, 6 - dow);
    var weekName = parshaName(sat);
    $('greg-date').textContent += (weekName && !isChag(sat)) ? ' · ' + weekName : '';
    holidays(now.date).forEach(function (e) {
      if (e.getFlags() & (F.PARSHA_HASHAVUA)) return;
      chips.push({ text: heb(e) });
    });
    var chip = chagChip(now);
    if (chip) chips.push({ text: chip, alert: true });
    // ספירה לאחור להדלקת נרות ביום שישי / ערב חג
    var lightsToday = dow === 5 || holidays(now.date).some(function (e) { return (e.getFlags() & F.LIGHT_CANDLES) && (e.getFlags() & F.EREV); });
    if (lightsToday) {
      var c = candles(now.date);
      var diff = c - now.minutes;
      if (diff > 0 && diff <= 240) chips.push({ text: 'הדלקת נרות ' + countdown(diff), alert: true });
    }
    $('chips').innerHTML = chips.map(function (c) {
      return '<span class="chip' + (c.alert ? ' alert' : '') + '">' + esc(c.text) + '</span>';
    }).join('');
  }

  function renderClock(now) {
    var mm = (now.min < 10 ? '0' : '') + now.min;
    $('clock').textContent = now.h + ':' + mm;
  }

  // ---------- חת"ת והיום יום ----------

  function fitText(el, maxRem, minRem) {
    var size = maxRem;
    el.style.fontSize = size + 'rem';
    while (el.scrollHeight > el.clientHeight + 2 && size > minRem) {
      size -= 0.1;
      el.style.fontSize = size + 'rem';
    }
  }

  function setLearning(id, value) {
    var el = $(id);
    el.textContent = value || 'יעודכן בהמשך';
    el.className = 'v' + (value ? '' : ' empty');
  }

  function loadLiveLearning(now) {
    var k = dayKey(now.date);
    Sources.daily(now.date, new hebcal.HDate(now.date), function (d) {
      state.live[k] = d;
      if (k === dayKey(israelNow().date)) renderLearning(israelNow());
    });
  }

  function renderLearning(now) {
    var hd = new hebcal.HDate(now.date);
    var k = dayKey(now.date);
    // מה שנכתב ידנית ב-data/daily.json גובר על מה שנמשך מהרשת
    var day = {};
    var live = state.live[k] || {};
    var manual = state.daily[k] || {};
    for (var a in live) day[a] = live[a];
    for (var b in manual) day[b] = manual[b];
    if (!day.rambam && day.rambam3) {
      day.rambam = day.rambam3;
    }
    setLearning('chitas-chumash', day.chumash || Learning.chumash(now.date));
    setLearning('chitas-tehillim', day.tehillim || Learning.tehillim(hd));
    setLearning('chitas-tanya', day.tanya);
    setLearning('chitas-rambam', day.rambam);

    $('hayomyom-date').textContent = hd.renderGematriya(true).replace(/ \S+$/, '');
    var box = $('hayomyom-text');
    if (day.hayomyom) {
      if (box.getAttribute('data-k') !== dayKey(now.date) + day.hayomyom.length) {
        box.className = 'hayomyom-text';
        box.textContent = day.hayomyom;
        box.setAttribute('data-k', dayKey(now.date) + day.hayomyom.length);
        // טקסט ארוך רץ לאט כלפי מעלה בלולאה, בגודל קבוע ונוח לקריאה
        if (box.scrollHeight > box.clientHeight + 2) {
          box.innerHTML = '';
          var track = document.createElement('div');
          var first = document.createElement('div');
          first.textContent = day.hayomyom;
          var gap = document.createElement('div');
          gap.className = 'gap';
          var second = first.cloneNode(true);
          track.appendChild(first);
          track.appendChild(gap);
          track.appendChild(second);
          box.appendChild(track);
          box.className = 'hayomyom-text scrolling';
          var distance = first.offsetHeight + gap.offsetHeight;
          box.style.setProperty('--run-by', -distance + 'px');
          // בערך 15 פיקסלים בשנייה: איטי מספיק לקריאה נוחה
          box.style.setProperty('--run-time', Math.round(distance / 15) + 's');
        }
      }
    } else {
      box.className = 'hayomyom-text empty';
      box.removeAttribute('data-k');
      box.textContent = 'טוען את פתגם היום...';
      box.style.fontSize = '';
    }
  }

  // ---------- מודעות ----------

  function activeAnnouncements(now) {
    var today = dayKey(now.date);
    return state.announcements.filter(function (a) {
      if (!a.title) return false; // מודעה בלי כותרת (למשל פרנס השבוע לפני שעודכן) לא מוצגת
      if (a.from && today < a.from) return false;
      if (a.until && today > a.until) return false;
      if (a.days && a.days.indexOf(now.date.getDay()) < 0) return false;
      return true;
    });
  }

  function announcementHtml(a) {
    var meta = [a.when, a.where].filter(Boolean).map(function (m) { return '<span>' + esc(m) + '</span>'; }).join('');
    var text = (a.kind ? '<div class="announce-kicker">' + esc(a.kind) + '</div>' : '') +
      '<div class="announce-title">' + esc(a.title) + '</div>' +
      (a.subtitle ? '<div class="announce-sub">' + esc(a.subtitle) + '</div>' : '') +
      (meta ? '<div class="announce-meta">' + meta + '</div>' : '') +
      (a.note ? '<div class="announce-note">' + esc(a.note) + '</div>' : '');
    // מודעה עם תמונה (למשל פלאייר): התמונה בצד והטקסט לידה
    if (a.image) {
      return '<div class="ann-with-image"><img class="ann-image" src="' + esc(a.image) + '" alt="">' +
        '<div class="ann-text">' + text + '</div></div>';
    }
    return '<div class="ann-text">' + text + '</div>';
  }

  function showAnnouncement(animate) {
    var list = activeAnnouncements(israelNow());
    var body = $('announce-body');
    var bar = $('announce-progress');
    if (!list.length) {
      body.classList.remove('fading');
      body.style.fontSize = '1rem';
      body.innerHTML = '<div class="announce-title">ברוכים הבאים</div><div class="announce-sub">' + esc(C.name) + '</div>';
      $('announce-dots').innerHTML = '';
      bar.style.transition = 'none';
      bar.style.width = '0';
      return;
    }
    state.annIndex = state.annIndex % list.length;
    var a = list[state.annIndex];
    var draw = function () {
      body.innerHTML = announcementHtml(a);
      body.style.fontSize = '1rem';
      var box = body.querySelector('.ann-text');
      for (var size = 1; box.scrollHeight > box.clientHeight + 1 && size > 0.55; size -= 0.05) {
        body.style.fontSize = size + 'rem';
      }
      body.classList.remove('fading');
      $('announce-dots').innerHTML = list.length > 1 ? list.map(function (_, i) {
        return '<span class="' + (i === state.annIndex ? 'on' : '') + '"></span>';
      }).join('') : '';
      bar.style.transition = 'none';
      bar.style.width = '0';
      if (list.length > 1) {
        void bar.offsetWidth;
        bar.style.transition = 'width ' + C.announcementSeconds + 's linear';
        bar.style.width = '100%';
      }
    };
    if (animate && list.length > 1) {
      body.classList.add('fading');
      setTimeout(draw, 700);
    } else draw();
  }

  function startAnnouncements() {
    clearInterval(state.annTimer);
    showAnnouncement(false);
    if (activeAnnouncements(israelNow()).length < 2) return;
    state.annTimer = setInterval(function () {
      state.annIndex++;
      showAnnouncement(true);
    }, C.announcementSeconds * 1000);
  }

  // ---------- נתונים מתעדכנים ----------

  function loadJSON(path) {
    return fetch(path + '?v=' + Date.now(), { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error(path + ' ' + r.status);
      return r.json();
    });
  }

  function applyData(ann, daily) {
    var before = JSON.stringify(state.announcements);
    state.announcements = (ann && ann.announcements) || [];
    state.daily = (daily && daily.days) || {};
    if (before !== JSON.stringify(state.announcements)) startAnnouncements();
    renderLearning(israelNow());
  }

  function refreshData() {
    if (window.INLINE_DATA) {
      applyData(window.INLINE_DATA.announcements, window.INLINE_DATA.daily);
      return;
    }
    Promise.all([loadJSON('data/announcements.json'), loadJSON('data/daily.json')]).then(function (res) {
      state.online = true;
      applyData(res[0], res[1]);
      updateStatus();
      checkVersion();
    }).catch(function () {
      // בלי חיבור ממשיכים להציג את מה שכבר נטען. הזמנים מחושבים במסך עצמו.
      state.online = false;
      updateStatus();
    });
  }

  // כשמעלים גרסה חדשה של המסך, הטלוויזיה טוענת אותה לבד
  function checkVersion() {
    if (!window.APP_VERSION) return;
    loadJSON('data/version.json').then(function (v) {
      if (v && v.version && v.version !== window.APP_VERSION) location.reload();
    }).catch(function () {});
  }

  // ---------- מסך דולק ----------

  var noSleep = null;
  var wakeLock = null;

  function setAwake(on) {
    state.awake = on;
    $('wake-hint').hidden = on;
    updateStatus();
  }

  function keepAwake() {
    if (wakeLock && !wakeLock.released) return;
    if (navigator.wakeLock && navigator.wakeLock.request) {
      navigator.wakeLock.request('screen').then(function (lock) {
        wakeLock = lock;
        setAwake(true);
        lock.addEventListener('release', function () { setAwake(false); });
      }).catch(videoFallback);
    } else {
      videoFallback();
    }
  }

  // דפדפנים בלי Wake Lock: סרטון שקט ובלתי נראה שרץ בלולאה ומונע כיבוי
  function videoFallback() {
    if (typeof NoSleep === 'undefined') { setAwake(false); return; }
    try {
      if (!noSleep) noSleep = new NoSleep();
      var p = noSleep.enable();
      if (p && p.then) p.then(function () { setAwake(true); }).catch(function () { setAwake(false); });
      else setAwake(true);
    } catch (e) {
      setAwake(false);
    }
  }

  function updateStatus() {
    var parts = [];
    if (!state.online) parts.push('אין חיבור לאינטרנט, מוצג המידע האחרון');
    $('status-text').textContent = parts.join(' · ');
    $('status').className = 'status' + (state.awake ? ' awake' : '');
  }

  // ---------- לולאה ראשית ----------

  var lastDay = null;
  var lastMinute = null;

  function tick() {
    var now = israelNow();
    renderClock(now);
    if (now.minutes === lastMinute) return;
    lastMinute = now.minutes;

    var k = dayKey(now.date);
    if (k !== lastDay) {
      lastDay = k;
      zCache = {};
      renderLearning(now);
      loadLiveLearning(now);
      startAnnouncements();
    }
    renderHeader(now);
    renderZmanim(now);
    renderPrayers(now);
    renderShabbat(now);

    // רענון לילי, ותזוזה קטנה כל 10 דקות כדי למנוע צריבה של המסך
    if (now.minutes === parseHM(C.nightlyReload) && Date.now() - state.loadedAt > 3600000) location.reload();
    if (now.minutes % 10 === 0) {
      var dx = Math.round(Math.random() * 8 - 4), dy = Math.round(Math.random() * 8 - 4);
      $('screen').style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
    }
    if (now.minutes % C.refreshDataMinutes === 0) {
      refreshData();
      loadLiveLearning(now);
    }
  }

  function start() {
    // "בית כנסת" בשורה קטנה ומרווחת, ושם בית הכנסת גדול מתחתיה
    var nameParts = C.name.match(/^(בית (?:ה)?כנסת)\s+(.+)$/);
    $('shul-name').innerHTML = nameParts
      ? '<span class="shul-pre">' + esc(nameParts[1]) + '</span><span class="shul-main">' + esc(nameParts[2]) + '</span>'
      : '<span class="shul-main">' + esc(C.name) + '</span>';
    $('shul-address').textContent = C.address;
    document.title = C.name;

    tick();
    setInterval(tick, 1000);

    // התאמות הגודל תלויות בגופנים: מחשבים מחדש כשהגופנים נטענו ואם גודל המסך השתנה
    var relayout = function () {
      lastMinute = null;
      $('hayomyom-text').removeAttribute('data-k');
      renderLearning(israelNow());
      startAnnouncements();
      tick();
    };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(relayout);
    window.addEventListener('resize', relayout);
    refreshData();

    keepAwake();
    // בחלק מהטלוויזיות צריך לחיצה אחת על השלט כדי להפעיל את מצב "מסך דולק"
    setTimeout(function () { if (!state.awake) $('wake-hint').hidden = false; }, 3000);
    ['keydown', 'click', 'touchstart'].forEach(function (ev) {
      document.addEventListener(ev, keepAwake);
    });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') keepAwake();
    });
    // תקלה בלתי צפויה: טוענים מחדש אחרי דקה במקום להישאר עם מסך תקוע
    window.addEventListener('error', function () {
      setTimeout(function () { location.reload(); }, 60000);
    });
  }

  start();
})();
