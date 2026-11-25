/* Understands English phrases such as
 *   "remind me every hour to go to the post office until 4pm"
 *   "every 30 minutes from 1pm to 5pm remind me to pay the electricity bill"
 *   "at half past three call mom"
 *   "in 20 minutes take the laundry out"
 * and returns the same structure as parser.js (Portuguese):
 * { task, interval, firstAt, end, once, hasDeadline, say, forMs, fromNow }.
 * Works in the browser (window.LembreteParserEN) and in Node (module.exports). */
(function (root) {
  'use strict';

  const UNITS = {
    zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
    eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
    eighteen: 18, nineteen: 19,
  };
  const TENS = { twenty: 20, thirty: 30, forty: 40, fourty: 40, fifty: 50 };
  const ALLNUM = Object.keys(UNITS).concat(Object.keys(TENS)).sort((a, b) => b.length - a.length).join('|');
  const NUMPHRASE = '(?:' + ALLNUM + ')(?:[\\s-]+(?:' + ALLNUM + '))?';
  const UNIT = '(seconds?|secs?|minutes?|mins?|hours?|hrs?|h)';

  function phraseToDigits(p) {
    const parts = p.split(/[\s-]+/);
    if (parts.length === 2 && TENS[parts[0]] != null && UNITS[parts[1]] != null && UNITS[parts[1]] < 10) {
      return String(TENS[parts[0]] + UNITS[parts[1]]);
    }
    return parts.map(w => String(UNITS[w] != null ? UNITS[w] : TENS[w])).join(' ');
  }

  const PERIOD = { morning: [9, 12], afternoon: [14, 19], evening: [19, 23] };
  const toMin = (n, unit) => /^s/.test(unit) ? n / 60 : /^h/.test(unit) ? n * 60 : n;

  function normalize(input) {
    let s = ' ' + String(input || '').toLowerCase().replace(/[“”"’]/g, (c) => c === '’' ? "'" : '').replace(/\s+/g, ' ').trim() + ' ';
    s = s.replace(/\b(\d{1,2})\s*a\.?\s?m\.?(?=[\s,.!?])/g, '$1am').replace(/\b(\d{1,2}(?::\d{2})?)\s*p\.?\s?m\.?(?=[\s,.!?])/g, '$1pm')
      .replace(/\b(\d{1,2}:\d{2})\s*a\.?\s?m\.?(?=[\s,.!?])/g, '$1am');
    s = s.replace(/\sin\s+(?:about|around|roughly|approximately|like|some)\s+(?=\d)/g, ' in ')
      .replace(/(\d)\s*m(?=[\s,.!?])/g, '$1 minutes').replace(/(\d)\s*mins?(?=[\s,.!?])/g, '$1 minutes');
    s = s.replace(/\b(?:noon|midday)\b/g, '12:00').replace(/\bmidnight\b/g, '23:59');
    s = s.replace(/(\sat\s+\d{1,2})\s+(\d{2})(?=[\s,.!?])/g, '$1:$2'); // "at 12 30"
    s = s.replace(/\bhourly\b/g, 'every 60 minutes').replace(/\bevery other hour\b/g, 'every 120 minutes')
      .replace(/\b(?:a\s+)?half(?:\s+an)?\s+hour\b/g, '30 minutes').replace(/\b(?:a\s+)?quarter(?:\s+of)?(?:\s+an)?\s+hour\b/g, '15 minutes')
      .replace(/\bhalf a minute\b/g, '30 seconds')
      .replace(/\b(?:a|an)\s+(hour|minute|second|min)\b/g, '1 $1')
      .replace(/\bo'?\s?clock\b/g, '');
    // number words only in time contexts
    s = s.replace(new RegExp('((?:at|every|in|within|for|until|till|til|by|before|from|after|around|past|to)\\s+)(' + NUMPHRASE + ')(?=[\\s,.!?])', 'g'),
      (m, pre, num) => pre + phraseToDigits(num));
    s = s.replace(new RegExp('(\\s)(' + NUMPHRASE + ')(?=\\s*(?:hours?|minutes?|mins?|seconds?|secs?|am|pm)\\b)', 'g'), (m, pre, num) => pre + phraseToDigits(num));
    s = s.replace(new RegExp('(\\d\\s+)(' + NUMPHRASE + ')(?=[\\s,.!?])', 'g'), (m, pre, num) => pre + phraseToDigits(num));
    // "half past 4", "quarter past 4", "quarter to 5", "10 past 4", "20 to 5"
    s = s.replace(/\bhalf past (\d{1,2})\b/g, '$1:30').replace(/\bquarter past (\d{1,2})\b/g, '$1:15')
      .replace(/\bquarter to (\d{1,2})\b/g, (m, h) => (Math.max(0, +h - 1)) + ':45')
      .replace(/\b(\d{1,2}) (?:minutes? )?past (\d{1,2})\b/g, (m, mi, h) => h + ':' + String(mi).padStart(2, '0'))
      .replace(/\b(\d{1,2}) (?:minutes? )?to (\d{1,2})\b(?!\s*(?:minutes?|hours?|mins?))/g, (m, mi, h) => (Math.max(0, +h - 1)) + ':' + String(60 - +mi).padStart(2, '0'));
    // "4 30 pm" → "4:30pm"
    s = s.replace(/\b(\d{1,2}) (\d{2})(?=\s*(?:am|pm)?(?:[\s,.!?]))/g, '$1:$2');
    return s;
  }

  const TIME = '(\\d{1,2})(?:[:.](\\d{2}))?\\s*(am|pm)?(?:\\s+(?:in the|this)\\s+(morning|afternoon|evening|night))?(?=[\\s,.!?])';

  function timeFrom(m, globalPeriod) {
    let h = parseInt(m[1], 10);
    const min = m[2] ? parseInt(m[2], 10) : 0;
    const ap = m[3];
    const period = m[4] === 'night' ? 'evening' : (m[4] || globalPeriod);
    if (ap === 'pm' && h < 12) h += 12;
    else if (ap === 'am' && h === 12) h = 0;
    else if (!ap && (period === 'afternoon' || period === 'evening') && h < 12) h += 12;
    else if (!ap && !period && h >= 1 && h <= 7) h += 12; // "until 4" = 4 PM
    if (h > 23 || min > 59) return null;
    return { h, m: min };
  }


  // Próximas horas de um lembrete que se repete por dias: { kind: 'daily'|'weekly'|'monthly', days, dom, h, m }
  function nextRecur(rc, from, count) {
    const out = [], n = count || 1;
    const base = new Date(from); base.setHours(rc.h, rc.m, 0, 0);
    for (let i = 0; i < 800 && out.length < n; i++) {
      const t = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i, rc.h, rc.m, 0, 0);
      if (t.getTime() <= from) continue;
      const last = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
      const ok = rc.kind === 'daily' || (rc.kind === 'weekly' && rc.days.indexOf(t.getDay()) >= 0)
        || (rc.kind === 'monthly' && t.getDate() === Math.min(rc.dom, last));
      if (ok) out.push(t.getTime());
    }
    return out;
  }

  const DOW_EN = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
  const DOWRE_EN = '(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday)s?';
  const dowOfEn = (w) => DOW_EN[w.replace(/s$/, '')];

  function parse(input, opts) {
    opts = opts || {};
    const now = opts.now != null ? opts.now : Date.now();
    const defaultInterval = opts.defaultInterval || 60;
    const dayEndHour = opts.dayEndHour || 22;
    let s = normalize(input);
    const cut = (re) => { const m = s.match(re); if (m) s = s.replace(m[0], ' '); return m; };

    let dayOffset = 0;
    if (cut(/\s(?:the\s+)?day after tomorrow(?=[\s,.!?])/)) dayOffset = 2;
    else if (cut(/\s(?:tomorrow|tmrw|tmr)(?=[\s,.!?])/)) dayOffset = 1;
    let gp = null;
    if (cut(/\stonight(?=[\s,.!?])/)) gp = 'evening';
    const tp = cut(/\sthis (morning|afternoon|evening)(?=[\s,.!?])/);
    if (tp) gp = tp[1];
    cut(/\stoday(?=[\s,.!?])/);

    // repeating by days: "every day", "on weekdays", "every monday and thursday", "on weekends", "on the 5th of every month"
    let recur = null, recurPeriod = null, rm;
    if ((rm = cut(/\s(?:every ?day|daily|each day|every (morning|afternoon|evening|night))(?=[\s,.!?])/))) {
      recur = { kind: 'daily' }; if (rm[1]) recurPeriod = rm[1] === 'night' ? 'evening' : rm[1];
    } else if (cut(/\s(?:on weekdays|every weekday|weekdays|(?:from )?monday to friday|during the week)(?=[\s,.!?])/)) {
      recur = { kind: 'weekly', days: [1, 2, 3, 4, 5] };
    } else if (cut(/\s(?:on |every |at )?(?:the )?weekends?(?=[\s,.!?])/)) {
      recur = { kind: 'weekly', days: [0, 6] };
    } else if ((rm = s.match(new RegExp('\\s(?:every|on|each)\\s+' + DOWRE_EN + '(?:\\s*(?:,|and)\\s*' + DOWRE_EN + ')*(?=[\\s,.!?])')))
               && (/^\s*(?:every|each)/.test(rm[0]) || /s(?=$|\s*(?:,|and))/.test(rm[0].trim().split(/\s+/)[1] || ''))) {
      s = s.replace(rm[0], ' ');
      const days = (rm[0].match(new RegExp(DOWRE_EN, 'g')) || []).map(dowOfEn).filter(d => d != null);
      recur = { kind: 'weekly', days: days.filter((d, i) => days.indexOf(d) === i).sort() };
    } else if ((rm = cut(/\s(?:on )?(?:the )?(\d{1,2})(?:st|nd|rd|th)? (?:of )?(?:every|each) month(?=[\s,.!?])/)
             || cut(/\s(?:every month|each month|monthly) on the (\d{1,2})(?:st|nd|rd|th)?(?=[\s,.!?])/))) {
      recur = { kind: 'monthly', dom: Math.max(1, Math.min(31, parseInt(rm[1], 10))) };
    }
    // a weekday, once: "on friday at 10", "next monday", "this friday"
    if (!recur && !dayOffset) {
      const wd = cut(new RegExp('\\s(?:on|this|next|on next)\\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)(?=[\\s,.!?])'));
      if (wd) { const d = dowOfEn(wd[1]); const diff = (d - new Date(now).getDay() + 7) % 7; dayOffset = diff === 0 ? 7 : diff; }
    }

    // interval
    let interval = null;
    const m = cut(new RegExp('\\s(?:once\\s+)?every\\s+(\\d+)?\\s*' + UNIT + '(?=[\\s,.!?])'));
    if (m) interval = toMin(m[1] ? parseInt(m[1], 10) : 1, m[2]);
    else if (cut(/\s(?:several times|from time to time|repeatedly|keep reminding me|over and over)(?=[\s,.!?])/)) interval = defaultInterval;
    if (interval != null) interval = Math.max(10 / 60, Math.min(interval, 12 * 60));

    // "for 2 minutes", "for the next 2 hours", "over the next hour"
    let forMs = null;
    const dur = cut(new RegExp('\\s(?:for|over)\\s+(?:the\\s+)?(?:next\\s+)?(\\d+)\\s*' + UNIT + '(?=[\\s,.!?])'));
    if (dur) forMs = toMin(parseInt(dur[1], 10), dur[2]) * 60e3;
    const fromNow = !!cut(/\s(?:(?:starting|beginning|from)\s+)?(?:right\s+)?now(?:\s+on)?(?=[\s,.!?])/);

    let period = gp;
    const pm = s.match(/\s(?:in the|during the)\s+(morning|afternoon|evening)(?=[\s,.!?])/);
    if (pm) period = period || pm[1];

    const range = cut(new RegExp('\\s(?:from|between)\\s+' + TIME + '\\s*(?:to|until|till|til|and|-)\\s*' + TIME));
    const deadline = cut(new RegExp('\\s(?:no later than|until|till|til|by|before)\\s+(?:the\\s+)?' + TIME));
    const startM = cut(new RegExp('\\s(?:starting(?:\\s+at)?|beginning(?:\\s+at)?|from|after)\\s+' + TIME));
    let rel = cut(new RegExp('\\s(?:in|within)\\s+(\\d+)\\s*' + UNIT + '(?=[\\s,.!?])'));
    if (!rel) rel = cut(new RegExp('\\s(\\d+)\\s*' + UNIT + '\\s+from now(?=[\\s,.!?])'));
    const at = cut(new RegExp('\\s(?:at|around|@)\\s+' + TIME));
    if (pm) cut(new RegExp(pm[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

    if (recur) {
      const per = recurPeriod || period;
      const tm = at ? timeFrom(at, per || 'morning') : startM ? timeFrom(startM, per || 'morning') : null;
      recur.h = tm ? tm.h : per ? PERIOD[per][0] + (per === 'afternoon' ? 1 : per === 'evening' ? 2 : 0) : 9;
      recur.m = tm ? tm.m : 0;
      const task0 = restoreCase(cleanTask(s), String(input));
      const say0 = task0.match(/^(?:say|tell me|repeat)\s+(?:that\s+)?(.+)$/i);
      return { task: task0, interval: null, firstAt: nextRecur(recur, now)[0], end: null, once: false, hasDeadline: false,
        say: say0 ? say0[1] : null, forMs: null, fromNow: false, recur };
    }

    const base = new Date(now);
    base.setHours(0, 0, 0, 0);
    base.setDate(base.getDate() + dayOffset);
    const mk = (hm) => {
      if (!hm) return null;
      const d = new Date(base); d.setHours(hm.h, hm.m, 0, 0);
      let t = d.getTime();
      if (dayOffset === 0 && t <= now) {
        if (hm.h < 12 && t + 12 * 3600e3 > now) t += 12 * 3600e3; else t += 24 * 3600e3;
      }
      return t;
    };
    const atHour = (h) => { const d = new Date(base); d.setHours(h, 0, 0, 0); return d.getTime(); };


    // "from 1pm to 5pm": a window with a start and an end (not a deadline)
    let rStart = null, rEnd = null;
    if (range) {
      const a = timeFrom(range.slice(0, 4 + 1), period), b = timeFrom([null].concat(range.slice(4 + 1, 2 * 4 + 1)), period);
      if (a && b) {
        const raw = (hm) => { const d = new Date(base); d.setHours(hm.h, hm.m, 0, 0); return d.getTime(); };
        rStart = raw(a); rEnd = raw(b);
        if (rEnd <= rStart) rEnd += 24 * 3600e3;            // "from 10pm to 2am"
        if (dayOffset === 0 && rEnd <= now) { rStart += 24 * 3600e3; rEnd += 24 * 3600e3; } // already over: tomorrow
        if (rStart <= now) rStart = null;                    // already started: from now
        if (!interval) interval = defaultInterval;
      }
    }

    let end = deadline ? mk(timeFrom(deadline, period)) : null;
    const hasDeadline = end != null;
    if (!end && rEnd) end = rEnd;
    let start = startM ? mk(timeFrom(startM, period)) : rStart;
    let atT = at ? mk(timeFrom(at, period)) : null;
    if (rel) atT = now + toMin(parseInt(rel[1], 10), rel[2]) * 60e3;
    if (!start && atT && interval) { start = atT; atT = null; }

    let once = false, firstAt;
    if (!interval && !hasDeadline && atT) {
      once = true; firstAt = atT;
    } else if (!interval && !hasDeadline && !forMs && !rStart && !rEnd && !start) {
      // sem pedir repetição, avisa uma vez só (no início da parte do dia, amanhã às 9h, ou daqui a 1 hora)
      once = true;
      firstAt = period && atHour(PERIOD[period][0]) > now ? atHour(PERIOD[period][0])
        : dayOffset > 0 ? atHour(9) : now + defaultInterval * 60e3;
    } else {
      if (!interval) interval = defaultInterval;
      if (!start && period && atHour(PERIOD[period][0]) > now) start = atHour(PERIOD[period][0]);
      if (!start && dayOffset > 0) start = atHour(9);
      if (!end && forMs) end = (start || now) + forMs;
      if (!end && interval < 1) end = (start || now) + 5 * 60e3; // seconds without a duration: only 5 minutes
      if (!end && period) end = atHour(PERIOD[period][1]);
      if (!end) {
        end = atHour(dayEndHour);
        if (end - now < 2 * 3600e3 && dayOffset === 0) end = now + 3 * 3600e3;
      }
      firstAt = start || (now + interval * 60e3);
      if (hasDeadline && firstAt >= end) firstAt = Math.max(now + 60e3, end - 15 * 60e3);
    }

    const task = restoreCase(cleanTask(s), String(input));
    // "say my name", "say drink water": the voice says exactly that
    const sayM = task.match(/^(?:say|tell me|repeat)\s+(?:that\s+)?(.+)$/i);
    // janela de tempo dita (para «não me incomodes das 15h às 16h», «até às 17h», «durante 1 hora»)
    const w0 = rStart || start || null;
    const win = rEnd ? { from: rStart || now, to: rEnd }
      : hasDeadline ? { from: w0 || now, to: end }
      : forMs ? { from: w0 || now, to: (w0 || now) + forMs } : null;
    return {
      task, interval: once ? null : interval, firstAt, end: once ? null : end, once, hasDeadline,
      say: sayM ? sayM[1] : null, forMs: once ? null : forMs, fromNow, win,
    };
  }

  function cleanTask(s) {
    let t = ' ' + s.replace(/\s+/g, ' ').trim() + ' ';
    t = t.replace(/\s(?:please|pls|plz)(?=[\s,.!?])/g, ' ').replace(/^[\s,.;:!?]+/, ' ');
    const lead = [
      /^\s*(?:ok(?:ay)?|hey|hi|so|um|uh|well)[,!]?\s+/,
      /^\s*(?:can you\s+|could you\s+)?(?:remind|tell|alert|ping|nudge)\s+me\s*(?:to|that|about|of)?\s+/,
      /^\s*(?:don't|do not)\s+let\s+me\s+forget\s*(?:to|that|about)?\s+/,
      /^\s*(?:i\s+)?(?:can't|cannot|mustn't|must not|shouldn't)\s+forget\s*(?:to|that|about)?\s+/,
      /^\s*(?:i\s+)?(?:need|have|got|must|should|want)\s+(?:to\s+)?/,
      /^\s*(?:to|that|about|and)\s+/,
    ];
    for (let i = 0; i < 4; i++) lead.forEach(re => { t = t.replace(re, ' '); });
    t = t.replace(/[,\s]+(?:and\s+)?(?:remind me|okay|ok)(?:\s+(?:of it|about it))?\s*$/, ' ');
    t = t.replace(/\s+,/g, ',').replace(/,+/g, ',').replace(/\s+/g, ' ').trim();
    t = t.replace(/^[,.\s]+|[,.\s]+$/g, '').replace(/\s+(?:and|to|at|until|by|on|from|the)$/i, '').trim();
    t = t.replace(/^(?:and|to|that)\s+/i, '');
    if (!t) return 'Reminder';
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  function restoreCase(task, original) {
    const words = {};
    original.split(/[\s,.!?]+/).forEach(w => { if (w && w !== w.toLowerCase()) words[w.toLowerCase()] = w; });
    const out = task.split(' ').map(w => words[w.toLowerCase()] || w).join(' ');
    return out.charAt(0).toUpperCase() + out.slice(1);
  }

  const api = { parse, normalize, cleanTask, nextRecur };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LembreteParserEN = api;
})(typeof window !== 'undefined' ? window : this);
