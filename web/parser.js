/* Percebe frases em português como
 *   "lembra-me de hora a hora de ir à InPost até às 16h"
 *   "de 30 em 30 minutos das 13h às 17h avisa-me para pagar a conta da luz"
 *   "às 3 e meia da tarde ligar à mãe"
 *   "daqui a 20 minutos tirar a roupa da máquina"
 * e devolve { task, interval, firstAt, end, once, hasDeadline }.
 * Funciona no browser (window.LembreteParser) e em Node (module.exports). */
(function (root) {
  'use strict';

  const UNITS = {
    zero: 0, um: 1, uma: 1, dois: 2, duas: 2, 'três': 3, tres: 3, quatro: 4, cinco: 5,
    seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12, treze: 13,
    catorze: 14, quatorze: 14, quinze: 15, dezasseis: 16, dezesseis: 16,
    dezassete: 17, dezessete: 17, dezoito: 18, dezanove: 19, dezenove: 19,
  };
  const TENS = { vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50 };
  const ALLNUM = Object.keys(UNITS).concat(Object.keys(TENS))
    .sort((a, b) => b.length - a.length).join('|');
  const NUMPHRASE = '(?:' + ALLNUM + ')(?:\\s+e\\s+(?:' + ALLNUM + '))?';

  function phraseToDigits(p) {
    const parts = p.split(/\s+e\s+/);
    if (parts.length === 2 && TENS[parts[0]] != null && UNITS[parts[1]] != null && UNITS[parts[1]] < 10) {
      return String(TENS[parts[0]] + UNITS[parts[1]]);
    }
    return parts.map(w => String(UNITS[w] != null ? UNITS[w] : TENS[w])).join(' e ');
  }

  const PERIOD = { 'manhã': [9, 12], tarde: [14, 19], noite: [19, 23] };

  function normalize(input) {
    let s = ' ' + String(input || '').toLowerCase().replace(/[“”"]/g, '').replace(/\s+/g, ' ').trim() + ' ';
    s = s.replace(/manha\b/g, 'manhã').replace(/amanha\b/g, 'amanhã');
    // o ditado às vezes come o "a" ("daqui 5 minutos") e as pessoas dizem "uns 5 minutos"
    s = s.replace(/\sdaqui\s+(?:h[áa]|à)\s+/g, ' daqui a ').replace(/\s(?:dentro de|em)\s+h[áa]\s+/g, ' dentro de '); // "daqui há 5 minutos"
    s = s.replace(/\sdaqui\s+(?=(?:uns|umas|\d|' + ALLNUM + '))/g, ' daqui a ');
    s = s.replace(new RegExp('\\s(?:uns|umas|cerca de|mais ou menos|aproximadamente|sensivelmente)\\s+(?=\\d|(?:' + ALLNUM + ')\\s)', 'g'), ' ');
    s = s.replace(/(\d)\s*m(?=[\s,.!?])/g, '$1 minutos').replace(/(\d)\s*mins?(?=[\s,.!?])/g, '$1 minutos');
    s = s.replace(/\s(?:ao|o)\s+meio[- ]dia/g, ' às 12h').replace(/\s(?:à|a)\s+meia[- ]noite/g, ' às 23h59');
    s = s.replace(/meio[- ]dia/g, '12h').replace(/meia[- ]noite/g, '23h59');
    s = s.replace(/(\s(?:[àa]s|pelas?)\s+\d{1,2})\s+(\d{2})(?=[\s,.!?])/g, '$1:$2'); // «às 12 30»
    s = s.replace(/de meia em meia hora/g, 'a cada 30 minutos')
      .replace(/de quarto em quarto de hora/g, 'a cada 15 minutos')
      .replace(/de hora (?:a|em) hora|todas as horas|hora a hora/g, 'a cada 60 minutos')
      .replace(/de minuto (?:a|em) minuto|todos os minutos|minuto a minuto/g, 'a cada 1 minuto')
      .replace(/de segundo (?:a|em) segundo/g, 'a cada 10 segundos')
      .replace(/meio minuto/g, '30 segundos')
      .replace(/(?:um )?quarto de hora/g, '15 minutos')
      .replace(/meia hora/g, '30 minutos')
      .replace(/e um quarto/g, 'e 15')
      .replace(/menos um quarto/g, 'menos 15');
    // números por extenso só quando estão num contexto de horas/minutos
    s = s.replace(new RegExp('((?:[àa]s|pelas?|cada|daqui a|dentro de|em|de|dia|at[ée](?: [àa]s?| ao)?|das?|antes das?)\\s+)(' + NUMPHRASE + ')(?=[\\s,.!?])', 'g'),
      (m, pre, num) => pre + phraseToDigits(num));
    s = s.replace(new RegExp('(\\s)(' + NUMPHRASE + ')(?=\\s+(?:horas?|minutos?|min|h|segundos?|seg)\\b)', 'g'),
      (m, pre, num) => pre + phraseToDigits(num));
    s = s.replace(new RegExp('(\\d\\s*(?:h|horas?)?\\s+e\\s+)(' + NUMPHRASE + ')(?=[\\s,.!?])', 'g'),
      (m, pre, num) => pre + phraseToDigits(num));
    s = s.replace(/(\d{1,2})\s*horas?\s+e\s+(\d{1,2})\s*minutos?/g, '$1:$2');
    return s;
  }

  // HH  HHh  HH:MM  HHhMM  HH horas  HH e meia  HH e 20  HH menos 15  ... da tarde
  const TIME = '(\\d{1,2})(?:\\s*(?:h|:|horas?)\\s*(\\d{2})?)?(?:\\s+e\\s+(meia|\\d{1,2})(?:\\s*minutos?)?)?(?:\\s+menos\\s+(\\d{1,2}))?(?:\\s*(?:da|de|à|a)\\s+(manhã|tarde|noite|madrugada))?(?=[\\s,.!?])';

  function timeFrom(m, globalPeriod) {
    let h = parseInt(m[1], 10);
    let min = m[2] ? parseInt(m[2], 10) : 0;
    if (m[3]) min = m[3] === 'meia' ? 30 : parseInt(m[3], 10);
    if (m[4]) { min = 60 - parseInt(m[4], 10); h -= 1; }
    const period = m[5] || globalPeriod;
    if ((period === 'tarde' || period === 'noite') && h < 12) h += 12;
    else if (!m[5] && !globalPeriod && h >= 1 && h <= 7) h += 12; // "até às 4" = 16h
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

  const DOW_PT = { domingo: 0, segunda: 1, 'terça': 2, terca: 2, quarta: 3, quinta: 4, sexta: 5, 'sábado': 6, sabado: 6 };
  const DOWRE_PT = '(?:domingo|segunda|ter[çc]a|quarta|quinta|sexta|s[áa]bado)s?(?:-feiras?)?';
  const dowOf = (w) => DOW_PT[w.replace(/s?(?:-feiras?)?$/, '').replace(/^ter[çc]a$/, 'terça').replace(/^s[áa]bado$/, 'sábado')];

  const toMin = (n, unit) => /^s/.test(unit) ? n / 60 : /^h/.test(unit) ? n * 60 : n;

  // dias até uma data («30 de novembro», «dia 5», «30/11»); se já passou, é no próximo mês/ano
  function dateOffset(d, mo, y, now) {
    const t0 = new Date(now); t0.setHours(0, 0, 0, 0);
    const Y = y != null ? (y < 100 ? 2000 + y : y) : t0.getFullYear();
    const M = mo != null ? mo : t0.getMonth();
    let t = new Date(Y, M, d);
    if (t < t0 && y == null) t = mo == null ? new Date(Y, M + 1, d) : new Date(Y + 1, M, d);
    return Math.max(0, Math.round((t - t0) / 864e5));
  }

  function parse(input, opts) {
    opts = opts || {};
    const now = opts.now != null ? opts.now : Date.now();
    const defaultInterval = opts.defaultInterval || 60;
    const dayEndHour = opts.dayEndHour || 22;
    let s = normalize(input);
    const cut = (re) => { const m = s.match(re); if (m) s = s.replace(m[0], ' '); return m; };

    let dayOffset = 0;
    if (cut(/\sdepois de amanhã(?=[\s,.!?])/)) dayOffset = 2;
    else if (cut(/\samanhã(?=[\s,.!?])/)) dayOffset = 1;
    cut(/\s(?:hoje|esta tarde|esta manhã|esta noite)(?=[\s,.!?])/);
    const tmp = String(input).toLowerCase();
    const gp = /esta tarde/.test(tmp) ? 'tarde' : /esta manhã|esta manha/.test(tmp) ? 'manhã' : /esta noite/.test(tmp) ? 'noite' : null;

    // repetição por dias: «todos os dias», «de segunda a sexta», «às segundas e quintas», «aos fins de semana», «dia 5 de cada mês»
    let recur = null, recurPeriod = null, rm;
    if (cut(/\s(?:todos os dias|diariamente|cada dia)\s+(?:exceto|excepto|menos|tirando|sem|fora)\s+(?:ao |aos |o |os |no |nos |durante o )?(?:fim|fins) de semana(?=[\s,.!?])/)) {
      recur = { kind: 'weekly', days: [1, 2, 3, 4, 5] };
    } else if ((rm = cut(/\s(?:todos os dias|diariamente|cada dia|todas as (manhãs|tardes|noites))(?=[\s,.!?])/))) {
      recur = { kind: 'daily' }; if (rm[1]) recurPeriod = rm[1].slice(0, -1);
    } else if (cut(/\s(?:de segunda a sexta(?:-feira)?|(?:nos |durante os |em )?dias (?:úteis|uteis|de semana)|durante a semana)(?=[\s,.!?])/)) {
      recur = { kind: 'weekly', days: [1, 2, 3, 4, 5] };
    } else if (cut(/\s(?:aos |ao |nos |todos os )?(?:fim|fins) de semana(?=[\s,.!?])/)) {
      recur = { kind: 'weekly', days: [0, 6] };
    } else if ((rm = s.match(new RegExp('\\s(?:todas as|todos os|às|as|aos|cada|nas|nos)\\s+' + DOWRE_PT + '(?:\\s*(?:,|e)\\s*(?:às|as|aos|nas|nos|à|ao)?\\s*' + DOWRE_PT + ')*(?=[\\s,.!?])')))) {
      s = s.replace(rm[0], ' ');
      const days = (rm[0].match(new RegExp(DOWRE_PT, 'g')) || []).map(dowOf).filter(d => d != null);
      recur = { kind: 'weekly', days: days.filter((d, i) => days.indexOf(d) === i).sort() };
    } else if ((rm = cut(/\s(?:no |ao |a )?dia (\d{1,2})(?: de cada mês| de todos os meses| todos os meses| de cada mes)(?=[\s,.!?])/)
             || cut(/\s(?:todos os meses|cada mês|cada mes|mensalmente)(?: no| ao| a)? dia (\d{1,2})(?=[\s,.!?])/))) {
      recur = { kind: 'monthly', dom: Math.max(1, Math.min(31, parseInt(rm[1], 10))) };
    }
    // um dia da semana, uma só vez: «na sexta às 10h», «na próxima segunda»
    if (!recur && !dayOffset) {
      const wd = cut(new RegExp('\\s(?:na|no|nesta|neste|esta|este|na próxima|no próximo|próxima|próximo)\\s+(' + DOWRE_PT + ')(?=[\\s,.!?])(?!\\s+(?:vez|vezes|parte|via|mão|metade|opção|hipótese|oportunidade))'));
      if (wd) { const d = dowOf(wd[1]); if (d != null) { const diff = (d - new Date(now).getDay() + 7) % 7; dayOffset = diff === 0 ? 7 : diff; } }
    }

    // uma data: «no dia 30 de novembro», «a 5 de dezembro de 2027», «dia 30», «30/11»
    if (!recur && !dayOffset) {
      const MES = '(janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)';
      const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
      const pre = '\\s(?:no |para o |a |em |dia |no dia |para o dia )?';
      let dm;
      if ((dm = cut(new RegExp(pre + '(\\d{1,2})º? de ' + MES + '(?: de (\\d{4}))?(?=[\\s,.!?])')))) {
        const mi = MESES.indexOf(dm[2] === 'marco' ? 'março' : dm[2]);
        dayOffset = dateOffset(+dm[1], mi, dm[3] ? +dm[3] : null, now);
      } else if ((dm = cut(new RegExp(pre + '(\\d{1,2})/(\\d{1,2})(?:/(\\d{2,4}))?(?=[\\s,.!?])')))) {
        dayOffset = dateOffset(+dm[1], +dm[2] - 1, dm[3] ? +dm[3] : null, now);
      } else if ((dm = cut(/\s(?:no |para o |a )?dia (\d{1,2})(?=[\s,.!?])/))) {
        dayOffset = dateOffset(+dm[1], null, null, now);
      }
    }

    // intervalo
    let interval = null;
    let m = cut(/\s(?:de|a cada|cada)\s+(\d+)\s+em\s+\1\s*(segundos?|seg|minutos?|min|horas?|h)(?=[\s,.!?])/);
    if (!m) m = cut(/\s(?:a\s+)?cada\s+(\d+)?\s*(segundos?|seg|minutos?|min|horas?|h)(?=[\s,.!?])/);
    if (m) {
      interval = toMin(m[1] ? parseInt(m[1], 10) : 1, m[2]);
    } else if (cut(/\s(?:várias vezes|varias vezes|de vez em quando|insistentemente|repetidamente)(?=[\s,.!?])/)) {
      interval = defaultInterval;
    }
    if (interval != null) interval = Math.max(10 / 60, Math.min(interval, 12 * 60)); // mínimo 10 segundos

    // "durante 2 minutos", "nas próximas 2 horas", "por 10 minutos"
    let forMs = null;
    const dur = cut(/\s(?:durante|por|nos próximos|nas próximas|ao longo de)\s+(\d+)\s*(segundos?|seg|minutos?|min|horas?|h)(?=[\s,.!?])/);
    if (dur) forMs = toMin(parseInt(dur[1], 10), dur[2]) * 60e3;
    const fromNow = !!cut(/\s(?:a partir de |começando |desde )?agora(?: mesmo)?(?=[\s,.!?])/);

    let period = gp;
    const pm = s.match(/\s(?:de|à|a|durante a|logo à|pela)\s+(manhã|tarde|noite)(?=[\s,.!?])/);
    if (pm) period = period || pm[1];

    const range = cut(new RegExp('\\s(?:d[ae]s?|entre\\s+[àa]s?|entre)\\s+' + TIME + '\\s+(?:at[ée]\\s+)?(?:[àa]s?|e\\s+[àa]s?|e)\\s+' + TIME));
    const deadline = cut(new RegExp('\\s(?:no máximo\\s+)?(?:at[ée]|antes)(?:\\s+(?:d?[àa]s?|ao|aos|de))?\\s+' + TIME));
    const startM = cut(new RegExp('\\s(?:a partir d[ae]s?|desde\\s+[àa]s|come[çc]a(?:ndo|r)?\\s+[àa]s)\\s+' + TIME));
    const rel = cut(/\s(?:daqui a|dentro de|em)\s+(\d+)\s*(segundos?|seg|minutos?|min|horas?|h)(?=[\s,.!?])/);
    const at = cut(new RegExp('\\s(?:[àa]s|pelas?|para as|para [àa]s|à)\\s+' + TIME));
    if (pm) cut(new RegExp(pm[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

    if (recur) {
      // sem «da tarde/noite», as horas ficam como ditas («às 7» = 7:00), que é o habitual em rotinas
      const per = recurPeriod || period;
      const tm = at ? timeFrom(at, per || 'manhã') : startM ? timeFrom(startM, per || 'manhã') : null;
      recur.h = tm ? tm.h : per ? PERIOD[per][0] + (per === 'tarde' ? 1 : per === 'noite' ? 2 : 0) : 9;
      recur.m = tm ? tm.m : 0;
      if (interval) {
        // «de hora a hora, de segunda a sexta, das 9h às 17h»: repete nesses dias, dentro dessa janela
        recur.every = interval;
        const ra = range ? timeFrom(range.slice(0, 5 + 1), period) : null, rb = range ? timeFrom([null].concat(range.slice(5 + 1, 2 * 5 + 1)), period) : null;
        const dl = deadline ? timeFrom(deadline, period) : null;
        if (ra && !at && !startM) { recur.h = ra.h; recur.m = ra.m; }
        const u = rb || dl;
        recur.until = u ? { h: u.h, m: u.m } : { h: dayEndHour, m: 0 };
        if (recur.until.h * 60 + recur.until.m <= recur.h * 60 + recur.m) recur.until = { h: 23, m: 0 };
      }
      const task0 = restoreCase(cleanTask(s), String(input));
      const say0 = task0.match(/^(?:diz|dizer|fala|falar|repete|repetir)(?:-me)?\s+(?:que\s+)?(.+)$/i);
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


    // "das 13h às 17h": janela com início e fim no mesmo dia (sem ser prazo)
    let rStart = null, rEnd = null;
    if (range) {
      const a = timeFrom(range.slice(0, 5 + 1), period), b = timeFrom([null].concat(range.slice(5 + 1, 2 * 5 + 1)), period);
      if (a && b) {
        const raw = (hm) => { const d = new Date(base); d.setHours(hm.h, hm.m, 0, 0); return d.getTime(); };
        rStart = raw(a); rEnd = raw(b);
        if (rEnd <= rStart) rEnd += 24 * 3600e3;            // "das 22h às 2h"
        if (dayOffset === 0 && rEnd <= now) { rStart += 24 * 3600e3; rEnd += 24 * 3600e3; } // já passou: amanhã
        if (rStart <= now) rStart = null;                    // já começou: avisa a partir de agora
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
      if (!end && interval < 1) end = (start || now) + 5 * 60e3; // segundos sem duração: só 5 minutos
      if (!end && period) end = atHour(PERIOD[period][1]);
      if (!end) {
        end = atHour(dayEndHour);
        if (end - now < 2 * 3600e3 && dayOffset === 0) end = now + 3 * 3600e3;
      }
      firstAt = start || (now + interval * 60e3);
      if (hasDeadline && firstAt >= end) firstAt = Math.max(now + 60e3, end - 15 * 60e3);
    }

    const task = restoreCase(cleanTask(s), String(input));
    // "diz o meu nome", "diz bebe água": a voz diz exatamente isso, sem "Lembrete:"
    const sayM = task.match(/^(?:diz|dizer|fala|falar|repete|repetir)(?:-me)?\s+(?:que\s+)?(.+)$/i);
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
    t = t.replace(/\s(?:por favor|se faz favor|sff)(?=[\s,.!?])/g, ' ').replace(/^[\s,.;:!?]+/, ' ');
    const lead = [
      /^\s*(?:diz|dizer|fala|avisa)[- ]?me\s+(?:para|de|que)\s+/,
      /^\s*(?:ok|olá|ola|ei|hey|então|olha|ouve)[,!]?\s+/,
      /^\s*(?:re)?(?:lembra|lembrar|avisa|avisar|recorda|recordar)[- ]?(?:-?me|me)?\s*(?:de que|que|de|para|disto|disso)?\s+/,
      /^\s*(?:eu\s+)?(?:tenho|tens|preciso|precisas)\s+(?:de|que)\s+/,
      /^\s*(?:não\s+)?(?:me\s+)?(?:posso|quero)\s+(?:me\s+)?esquecer(?:-me)?\s*(?:de que|de|que)?\s+/,
      /^\s*(?:que|de|e|para|a)\s+/,
    ];
    for (let i = 0; i < 4; i++) lead.forEach(re => { t = t.replace(re, ' '); });
    t = t.replace(/[,\s]+(?:e\s+)?(?:re)?(?:lembra|avisa)[- ]?(?:-?me|me)(?:\s+(?:disso|disto))?\s*$/, ' ');
    t = t.replace(/\s+,/g, ',').replace(/,+/g, ',').replace(/\s+/g, ' ').trim();
    t = t.replace(/^[,.\s]+|[,.\s]+$/g, '').replace(/\s+(?:e|de|que|a|às|as|até)$/i, '').trim();
    t = t.replace(/^(?:e|que)\s+/i, '');
    if (!t) return 'Lembrete';
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  // devolve as maiúsculas que vinham no texto original ("InPost", "Rui")
  function restoreCase(task, original) {
    const words = {};
    original.split(/[\s,.!?]+/).forEach(w => { if (w && w !== w.toLowerCase()) words[w.toLowerCase()] = w; });
    const out = task.split(' ').map((w, i) => words[w.toLowerCase()] || (i === 0 ? w : w)).join(' ');
    return out.charAt(0).toUpperCase() + out.slice(1);
  }

  const api = { parse, normalize, cleanTask, nextRecur };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LembreteParser = api;
})(typeof window !== 'undefined' ? window : this);
