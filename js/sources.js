/*
 * מקורות לתוכן היומי, שנמשכים ישירות מהטלוויזיה:
 *   פתגם היום יום: חב"דפדיה (chabadpedia.co.il)
 *   תניא יומי ורמב"ם יומי: ספריא (sefaria.org)
 * התוצאות נשמרות בזיכרון של הדפדפן, כדי שיוצגו גם אם האינטרנט נופל.
 */
var Sources = (function () {
  var CHABADPEDIA = 'https://chabadpedia.co.il/api.php';
  var SEFARIA = 'https://www.sefaria.org/api';

  // שמות החודשים כפי שהם מופיעים בדפים של חב"דפדיה
  var MONTHS = {
    1: 'ניסן', 2: 'אייר', 3: 'סיון', 4: 'תמוז', 5: 'מנחם אב', 6: 'אלול',
    7: 'תשרי', 8: 'חשוון', 9: 'כסלו', 10: 'טבת', 11: 'שבט', 12: 'אדר', 13: 'אדר ב\''
  };

  function cacheGet(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; }
  }
  function cacheSet(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      // מנקים רשומות ישנות כדי שהזיכרון לא יתמלא
      for (var i = localStorage.length - 1; i >= 0; i--) {
        var k = localStorage.key(i);
        if (k && k.indexOf('daily:') === 0 && k < 'daily:' + oldestKeep()) localStorage.removeItem(k);
      }
    } catch (e) { /* בלי זיכרון מקומי ממשיכים בלי שמירה */ }
  }
  function oldestKeep() {
    var d = new Date(Date.now() - 7 * 86400000);
    return d.toISOString().slice(0, 10);
  }

  function getJSON(url) {
    return fetch(url, { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    });
  }

  function stripNikud(s) {
    return s.replace(/[֑-ׇ]/g, '');
  }

  // מספר בגימטריה עם גרש וגרשיים רגילים, כמו בשמות הדפים בחב"דפדיה
  function hebNum(n) {
    return hebcal.gematriya(n).replace(/׳/g, '\'').replace(/״/g, '"');
  }

  function wikiDateTitle(hd) {
    var m = hd.getMonth();
    var month = MONTHS[m];
    if (m === 12 && hd.isLeapYear()) month = 'אדר א\'';
    return hebNum(hd.getDate()) + ' ' + month;
  }

  // HTML של ויקי לטקסט נקי עם מעברי שורה בין פסקאות
  function htmlToText(html) {
    var doc = new DOMParser().parseFromString(html, 'text/html');
    var junk = doc.querySelectorAll('.mw-editsection, style, script, img, .mw-empty-elt, sup.reference');
    for (var i = 0; i < junk.length; i++) junk[i].parentNode.removeChild(junk[i]);
    var blocks = doc.querySelectorAll('p, br, li, h1, h2, h3, h4, div');
    for (var j = 0; j < blocks.length; j++) blocks[j].appendChild(doc.createTextNode('\n'));
    return doc.body.textContent
      .replace(/[ \t]+/g, ' ')
      .replace(/ *\n */g, '\n')
      .replace(/\n{2,}/g, '\n')
      .trim();
  }

  function fetchHayomYom(hd) {
    var title = 'היום יום/' + wikiDateTitle(hd);
    var url = CHABADPEDIA + '?action=parse&format=json&formatversion=2&origin=*' +
      '&prop=text&disablelimitreport=1&contentmodel=wikitext&text=' +
      encodeURIComponent('{{' + title + '}}');
    return getJSON(url).then(function (d) {
      var text = htmlToText(d.parse.text);
      // דף שלא קיים חוזר כקישור אדום עם שם התבנית
      if (!text || text.indexOf('תבנית:') === 0) return null;
      return text;
    });
  }

  // "תניא, אגרת הקדש כ״ה:א׳" + המילים הראשונות => אגרת הקדש פרק כ״ה: "להבין אמרי בינה..."
  function tanyaLabel(heRef, firstWords) {
    var part = heRef.replace(/^תניא,\s*/, '').replace(/^[^;]*;\s*/, '').replace(/:[^:]*$/, '');
    var m = /^(.*\S)\s+(\S+)$/.exec(part);
    var label = m ? m[1] + ' פרק ' + m[2] : part;
    return firstWords ? label + ': "' + firstWords + '..."' : label;
  }

  function fetchSefaria(date) {
    var url = SEFARIA + '/calendars?diaspora=0&year=' + date.getFullYear() +
      '&month=' + (date.getMonth() + 1) + '&day=' + date.getDate();
    return getJSON(url).then(function (d) {
      var out = {};
      var tanyaRef = null;
      d.calendar_items.forEach(function (item) {
        var en = item.title.en;
        if (en === 'Tanya Yomi') tanyaRef = item.ref;
        if (en === 'Daily Rambam (3 Chapters)') out.rambam3 = stripNikud(item.displayValue.he);
        if (en === 'Daily Rambam') out.rambam1 = stripNikud(item.displayValue.he);
      });
      if (!tanyaRef) return out;
      return getJSON(SEFARIA + '/v3/texts/' + encodeURIComponent(tanyaRef) +
        '?version=hebrew&return_format=text_only').then(function (t) {
        var text = t.versions && t.versions[0] && t.versions[0].text;
        if (Array.isArray(text)) text = text[0];
        var words = text ? stripNikud(String(text)).replace(/[״"()\[\]]/g, '').trim().split(/\s+/).slice(0, 3).join(' ') : '';
        out.tanya = tanyaLabel(stripNikud(t.heRef || ''), words);
        return out;
      }).catch(function () { return out; });
    });
  }

  // מחזיר את מה שיש בזיכרון מיד, ומשלים מהרשת כשאפשר
  function daily(date, hd, onUpdate) {
    var key = 'daily:' + date.getFullYear() + '-' + ('0' + (date.getMonth() + 1)).slice(-2) + '-' + ('0' + date.getDate()).slice(-2);
    var cached = cacheGet(key) || {};
    if (cached.hayomyom && cached.tanya && cached.rambam3) {
      onUpdate(cached);
      return;
    }
    onUpdate(cached);
    var result = cached;
    var save = function () { cacheSet(key, result); onUpdate(result); };
    if (!cached.hayomyom) {
      fetchHayomYom(hd).then(function (text) {
        if (text) { result.hayomyom = text; save(); }
      }).catch(function () {});
    }
    if (!cached.tanya || !cached.rambam3) {
      fetchSefaria(date).then(function (s) {
        for (var k in s) result[k] = s[k];
        save();
      }).catch(function () {});
    }
  }

  return { daily: daily, wikiDateTitle: wikiDateTitle };
})();
