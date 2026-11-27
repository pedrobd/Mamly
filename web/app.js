(function () {
  'use strict';

  const KEY = 'lembretes.v1';
  const SKEY = 'lembretes.settings.v1';
  const MIN = 60e3;
  const $ = (id) => document.getElementById(id);
  // Dentro da app Android existe window.AndroidBridge: a voz, o microfone e os alarmes passam a ser do telemóvel.
  const NATIVE = window.AndroidBridge || null;

  // ---------- estado ----------
  const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(reminders)); } catch (e) {} syncNative(); };
  const saveSettings = () => { try { localStorage.setItem(SKEY, JSON.stringify(settings)); } catch (e) {} syncNative(); };
  let reminders = load(KEY, []);
  const settings = Object.assign({ name: '', voiceURI: '', rate: 1, repeat: 1, chime: true, listenAfter: true, lockAlert: true, quietOn: true, quietFrom: '23:00', quietTo: '08:00', alarmVolume: true, nativeVoice: '', momMode: false, lang: 'auto', calOn: false, calIds: null, calLeads: ['1d', '1h'], calHour: '09:00', calDone: [] }, load(SKEY, {}));

  // ---------- língua ----------
  // 'auto' segue a língua do telemóvel: português se for pt-*, inglês em todas as outras.
  const deviceLang = () => (navigator.language || 'pt').toLowerCase().startsWith('pt') ? 'pt' : 'en';
  const LANG = settings.lang === 'pt' || settings.lang === 'en' ? settings.lang : deviceLang();
  const EN = LANG === 'en';
  const L = (pt, en) => EN ? en : pt;
  document.documentElement.lang = EN ? 'en' : 'pt-PT';
  // voz e microfone: português de Portugal, ou o inglês do telemóvel (en-GB, en-US…)
  const SPEECH_LANG = EN ? ((navigator.language || '').toLowerCase().startsWith('en') ? navigator.language : 'en-US') : 'pt-PT';

  // ---------- horas em texto ----------
  const pad = (n) => String(n).padStart(2, '0');
  const hm = (t) => { const d = new Date(t); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
  const dayWord = (t) => {
    const d = new Date(t); d.setHours(0, 0, 0, 0);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const diff = Math.round((d - today) / 864e5);
    if (diff === 0) return '';
    if (diff === 1) return L('amanhã ', 'tomorrow ');
    if (diff === -1) return L('ontem ', 'yesterday ');
    // mais de uma semana: diz também o mês («segunda-feira, 30 de novembro»)
    return d.toLocaleDateString(L('pt-PT', 'en-GB'), Math.abs(diff) > 6 ? { weekday: 'long', day: 'numeric', month: 'long' } : { weekday: 'long', day: 'numeric' }) + ' ';
  };
  const sayTime = (t) => {
    const d = new Date(t), h = d.getHours(), m = d.getMinutes();
    if (EN) {
      if (h === 12 && m === 0) return 'noon';
      if (h === 23 && m === 59) return 'midnight';
      const h12 = h % 12 || 12, ap = h < 12 ? 'AM' : 'PM';
      return m === 0 ? h12 + ' ' + ap : h12 + ':' + pad(m) + ' ' + ap;
    }
    if (h === 12 && m === 0) return 'meio-dia';
    if (h === 23 && m === 59) return 'meia-noite';
    if (m === 0) return h + (h === 1 ? ' hora' : ' horas');
    if (m === 30) return h + ' e meia';
    return h + ' e ' + m;
  };
  const sayDuration = (ms) => {
    if (ms < 59500) { const sec = Math.max(1, Math.round(ms / 1000)); return sec + (sec === 1 ? L(' segundo', ' second') : L(' segundos', ' seconds')); }
    const total = Math.max(1, Math.round(ms / MIN));
    const h = Math.floor(total / 60), m = total % 60;
    const hs = h ? h + (h === 1 ? L(' hora', ' hour') : L(' horas', ' hours')) : '';
    const ms_ = m ? m + (m === 1 ? L(' minuto', ' minute') : L(' minutos', ' minutes')) : '';
    return [hs, ms_].filter(Boolean).join(L(' e ', ' and '));
  };
  const sayInterval = (min) => {
    if (EN) {
      if (min < 1) return 'every ' + Math.round(min * 60) + ' seconds';
      if (min === 1) return 'every minute';
      if (min === 60) return 'every hour';
      if (min === 30) return 'every half hour';
      if (min % 60 === 0) return 'every ' + (min / 60) + ' hours';
      return 'every ' + min + ' minutes';
    }
    if (min < 1) { const sec = Math.round(min * 60); return 'de ' + sec + ' em ' + sec + ' segundos'; }
    if (min === 1) return 'de minuto a minuto';
    if (min === 60) return 'de hora a hora';
    if (min === 30) return 'de meia em meia hora';
    if (min === 15) return 'de quarto em quarto de hora';
    if (min % 60 === 0) return 'de ' + (min / 60) + ' em ' + (min / 60) + ' horas';
    return 'de ' + min + ' em ' + min + ' minutos';
  };
  const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const lowerFirst = (s) => s.charAt(0).toLowerCase() + s.slice(1);

  // ---------- agenda de cada lembrete ----------
  function plan(r) {
    const ev = [];
    if (r.calAts) {
      // vem do calendário: os avisos de X dias / 1 hora antes do evento
      r.calAts.forEach(a => ev.push({ at: a.at, kind: 'once' }));
    } else if (r.recur && r.recur.every) {
      // «de hora a hora, de segunda a sexta, das 9h às 17h»: em cada um desses dias, de X em X minutos dentro da janela
      const rc = r.recur, step = rc.every * MIN, u = rc.until || { h: 22, m: 0 };
      const d0 = new Date(Math.max(r.lastAt || 0, Date.now() - 864e5)); d0.setHours(0, 0, 0, 0);
      LembreteParser.nextRecur(rc, d0.getTime() - 1, 14).forEach(st => {
        const e = new Date(st); e.setHours(u.h, u.m, 0, 0);
        for (let t = st; t <= e.getTime() && ev.length < 400; t += step) if (t >= (r.createdAt || 0) - MIN) ev.push({ at: t, kind: 'regular' });
      });
    } else if (r.recur) {
      // repete por dias: as próximas ~60 vezes, a partir do último aviso
      const from = Math.max(r.lastAt || 0, (r.createdAt || Date.now()) - 1, Date.now() - 864e5);
      LembreteParser.nextRecur(r.recur, from, 60).forEach(at => ev.push({ at, kind: 'once' }));
    } else if (r.once) ev.push({ at: r.firstAt, kind: 'once' });
    else {
      const step = r.interval * MIN;
      const stop = r.hasDeadline ? r.end - 10 * MIN : r.end + 1;
      for (let t = r.firstAt; t < stop && ev.length < 400; t += step) ev.push({ at: t, kind: 'regular' });
      if (r.hasDeadline) {
        const f = r.end - 15 * MIN;
        if (r.interval >= 25 && f > r.createdAt + 2 * MIN) {
          for (let i = ev.length - 1; i >= 0; i--) if (Math.abs(ev[i].at - f) < 10 * MIN) ev.splice(i, 1);
          ev.push({ at: f, kind: 'final' });
        }
        ev.push({ at: r.end, kind: 'deadline' });
      }
    }
    if (r.snoozeAt) ev.push({ at: r.snoozeAt, kind: 'snooze' });
    return ev
      .filter(e => !(r.quietUntil && e.kind === 'regular' && e.at < r.quietUntil))
      // horas de silêncio: só calam as repetições automáticas (não na 1.ª hora depois de criar o lembrete)
      .filter(e => !(e.kind === 'regular' && inQuiet(e.at) && e.at - (r.createdAt || 0) > 60 * MIN))
      .map(dndShift).filter(Boolean)
      .sort((a, b) => a.at - b.at);
  }
  // «não me incomodes das 15h às 16h»: as repetições calam-se; o que tem hora marcada toca no fim
  const dndNow = () => (settings.dnd && settings.dnd.to > Date.now() ? settings.dnd : null);
  function dndShift(e) {
    // depois de acabar, a janela continua a contar (senão o que foi calado voltava a tocar de uma vez)
    const d = settings.dnd && settings.dnd.to > Date.now() - 864e5 ? settings.dnd : null;
    if (!d || e.at < d.from || e.at >= d.to) return e;
    if (e.kind === 'regular' || e.kind === 'final') return null;
    return { at: d.to, kind: e.kind };
  }
  function inQuiet(t) {
    if (!settings.quietOn) return false;
    const mins = (v, d) => { const [h, m] = String(v || d).split(':').map(Number); return (h || 0) * 60 + (m || 0); };
    const a = mins(settings.quietFrom, '23:00'), b = mins(settings.quietTo, '08:00');
    const dt = new Date(t), x = dt.getHours() * 60 + dt.getMinutes();
    return a === b ? false : a < b ? (x >= a && x < b) : (x >= a || x < b);
  }
  const pending = (r) => plan(r).filter(e => e.at > (r.lastAt || 0));
  const nextEvent = (r) => pending(r)[0] || null;
  function status(r) {
    if (r.done) return 'done';
    if (nextEvent(r)) return 'active';
    if (r.cal) return 'active';
    return r.hasDeadline || r.once ? 'waiting' : 'finished';
  }
  const DAYS_PT = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  const DAYS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const recurTime = (rc) => String(rc.h).padStart(2, '0') + ':' + String(rc.m).padStart(2, '0');
  const recurUntil = (rc) => String(rc.until.h).padStart(2, '0') + ':' + String(rc.until.m).padStart(2, '0');
  const hmToday = (h, m) => { const d = new Date(); d.setHours(h, m, 0, 0); return d.getTime(); };
  // «De segunda a sexta · De hora a hora, das 09:00 às 17:00» / «Todos os dias · 09:00»
  const recurDesc = (rc) => cap(recurLabel(rc)) + ' · ' + (rc.every ? shortInterval(rc.every) + L(', das ', ', ') + recurTime(rc) + L(' às ', '–') + recurUntil(rc) : recurTime(rc));
  // «Todos os dias», «De segunda a sexta», «Às segundas e quintas», «Dia 5 de cada mês»
  function recurLabel(rc, spoken) {
    const and = (a) => a.length < 2 ? a[0] : a.slice(0, -1).join(', ') + L(' e ', ' and ') + a[a.length - 1];
    if (rc.kind === 'daily') return L('todos os dias', 'every day');
    if (rc.kind === 'monthly') return L('no dia ' + rc.dom + ' de cada mês', 'on day ' + rc.dom + ' of every month');
    const d = rc.days.join();
    if (d === '1,2,3,4,5') return L('de segunda a sexta', 'on weekdays');
    if (d === '0,6') return L('aos fins de semana', 'on weekends');
    // dias seguidos de segunda em diante: «de segunda a quinta»
    const wk = rc.days.filter(x => x > 0);
    if (wk.length >= 3 && wk.length === rc.days.length && wk[wk.length - 1] - wk[0] === wk.length - 1)
      return EN ? DAYS_EN[wk[0]] + ' to ' + DAYS_EN[wk[wk.length - 1]] : 'de ' + DAYS_PT[wk[0]] + ' a ' + DAYS_PT[wk[wk.length - 1]];
    if (EN) return 'every ' + and(rc.days.map(x => DAYS_EN[x]));
    const plural = rc.days.map(x => DAYS_PT[x] + 's');
    return (rc.days.every(x => x === 0 || x === 6) ? 'aos ' : 'às ') + and(plural);
  }
  function describe(r) {
    if (r.cal) return '📅 ' + cap(dayWord(r.cal.begin) || L('hoje ', 'today ')) + L('às ', 'at ') + hm(r.cal.begin);
    if (r.recur) return recurDesc(r.recur);
    const day = dayWord(r.once ? r.firstAt : (r.end || r.firstAt));
    if (r.once) return (day ? cap(day) : L('Hoje ', 'Today ')) + L('às ', 'at ') + hm(r.firstAt) + L(' · uma vez', ' · once');
    let s = cap(sayInterval(r.interval));
    s += r.hasDeadline ? L(' · prazo ', ' · due ') + day + L('até às ', 'by ') + hm(r.end) : L(' · até às ', ' · until ') + hm(r.end);
    return s;
  }
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  // ---------- som ----------
  let audioCtx = null;
  let unlocked = !!NATIVE;
  let onUnlocked = [];
  function unlock() {
    if (unlocked) return;
    unlocked = true;
    setTimeout(() => { onUnlocked.forEach(f => f()); onUnlocked = []; }, 50);
    $('unlock').hidden = true;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
    } catch (e) {}
    if ('speechSynthesis' in window) {
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      speechSynthesis.speak(u);
    }
  }
  function chime() {
    return new Promise((res) => {
      if (!settings.chime || !audioCtx) return res();
      try {
        const t0 = audioCtx.currentTime;
        [[784, 0], [1047, 0.18], [1319, 0.36]].forEach(([f, dt]) => {
          const o = audioCtx.createOscillator(), g = audioCtx.createGain();
          o.type = 'sine'; o.frequency.value = f;
          g.gain.setValueAtTime(0.0001, t0 + dt);
          g.gain.exponentialRampToValueAtTime(0.35, t0 + dt + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, t0 + dt + 0.5);
          o.connect(g).connect(audioCtx.destination);
          o.start(t0 + dt); o.stop(t0 + dt + 0.55);
        });
      } catch (e) {}
      setTimeout(res, 900);
    });
  }

  let voices = [];
  function loadVoices() {
    if (!('speechSynthesis' in window)) return;
    voices = speechSynthesis.getVoices().filter(v => EN ? /^en/i.test(v.lang) : /^pt/i.test(v.lang));
    voices.sort((a, b) => score(b) - score(a));
    fillVoiceSelect();
  }
  const score = (v) => (EN ? (v.lang === SPEECH_LANG ? 10 : 0) : (/pt[-_]PT/i.test(v.lang) ? 10 : 0)) + (/natural|online|premium|enhanced|neural/i.test(v.name) ? 3 : 0) + (v.localService ? 0 : 1);
  function pickVoice() {
    return voices.find(v => v.voiceURI === settings.voiceURI) || voices[0] || null;
  }
  let tokSeq = 0;
  const nativeWaiters = {};
  function speakOnce(text) {
    if (NATIVE) {
      return new Promise((res) => {
        const tok = 't' + (++tokSeq);
        nativeWaiters[tok] = res;
        setTimeout(() => { if (nativeWaiters[tok]) { delete nativeWaiters[tok]; res(); } }, 5000 + text.length * 150);
        NATIVE.speak(text, settings.rate, tok);
      });
    }
    return new Promise((res) => {
      if (!('speechSynthesis' in window)) return res();
      const u = new SpeechSynthesisUtterance(text);
      const v = pickVoice();
      if (v) { u.voice = v; u.lang = v.lang; } else u.lang = SPEECH_LANG;
      u.rate = settings.rate;
      let done = false;
      const fin = () => { if (!done) { done = true; clearTimeout(guard); res(); } };
      u.onend = fin; u.onerror = fin;
      const guard = setTimeout(fin, 4000 + text.length * 120);
      speechSynthesis.speak(u);
    });
  }
  function cancelSpeech() {
    if (NATIVE) NATIVE.stopSpeaking();
    else if ('speechSynthesis' in window) speechSynthesis.cancel();
  }
  async function speak(text, times) {
    cancelSpeech();
    for (let i = 0; i < (times || 1); i++) {
      await speakOnce(text);
      if (i < times - 1) await sleep(700);
    }
  }
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  // ---------- reconhecimento de voz ----------
  const SR = NATIVE ? null : (window.SpeechRecognition || window.webkitSpeechRecognition);
  const CAN_LISTEN = !!(SR || NATIVE);
  let activeRec = null;
  let nativeListen = null;
  function listen({ onInterim, maxMs } = {}) {
    if (NATIVE) {
      return new Promise((resolve, reject) => {
        nativeListen = { resolve, reject, onInterim };
        NATIVE.listen(maxMs ? 'answer' : 'dictation');
      });
    }
    return new Promise((resolve, reject) => {
      if (!SR) return reject(new Error('unsupported'));
      if (activeRec) { try { activeRec.abort(); } catch (e) {} }
      const rec = new SR();
      activeRec = rec;
      rec.lang = SPEECH_LANG;
      rec.interimResults = true;
      // ditado: continua a ouvir nas pausas e só acaba após ~3,5 s de silêncio (ou novo toque no microfone)
      rec.continuous = !maxMs;
      rec.maxAlternatives = 1;
      let finalText = '', lastText = '', err = null;
      rec.onresult = (e) => {
        let interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const txt = e.results[i][0].transcript;
          if (e.results[i].isFinal) finalText += txt; else interim += txt;
        }
        lastText = (finalText + ' ' + interim).trim();
        if (onInterim) onInterim(lastText);
        if (!maxMs && lastText) armSilence(3500);
      };
      let silence = null;
      const armSilence = (ms) => { clearTimeout(silence); silence = setTimeout(() => { try { rec.stop(); } catch (e) {} }, ms); };
      if (!maxMs) armSilence(8000);
      rec.onerror = (e) => { err = e.error; };
      rec.onend = () => {
        clearTimeout(timer); clearTimeout(silence);
        if (activeRec === rec) activeRec = null;
        const text = (finalText || lastText).trim();
        if (text) resolve(text);
        else if (err && err !== 'no-speech' && err !== 'aborted') reject(new Error(err));
        else resolve('');
      };
      const timer = maxMs ? setTimeout(() => { try { rec.stop(); } catch (e) {} }, maxMs) : null;
      try { rec.start(); } catch (e) { reject(e); }
    });
  }
  function stopListening() {
    if (NATIVE) { if (nativeListen) NATIVE.stopListening(); return; }
    if (activeRec) { try { activeRec.stop(); } catch (e) {} }
  }

  // ---------- mensagens faladas ----------
  function message(r, kind) { return cap(rawMessage(r, kind)); }
  // Vários lembretes no mesmo aviso (igual a Msg.group no Android)
  const NUM_PT = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis'], NUM_EN = ['', 'one', 'two', 'three', 'four', 'five', 'six'];
  function groupMessage(items) {
    const now = Date.now(), n = items.length, short = n > 2;
    let suffix = false;
    const parts = items.map(({ r, kind }) => {
      let t = softLower((r.say ? withName(r.say) : r.text).replace(/[.!?]+$/, ''));
      if (kind === 'final' && r.end > now) { t += L(', último aviso, faltam ', ', last call, ') + sayDuration(r.end - now) + L('', ' left'); suffix = true; }
      else if (kind === 'deadline') { t += L(', chegou a hora limite', ", time's up"); suffix = true; }
      else if (!short && r.hasDeadline && r.end > now) { t += L(', até às ', ', until ') + sayTime(r.end); suffix = true; }
      return t;
    });
    const sep = suffix ? '; ' : ', ', lastSep = suffix ? L('; e ', '; and ') : L(' e ', ' and ');
    const list = parts.slice(0, -1).join(sep) + lastSep + parts[n - 1];
    const num = (EN ? NUM_EN : NUM_PT)[n] || String(n);
    const intro = settings.momMode
      ? L(momName() + ', tens ' + num + ' eventos, coração: ', momName() + ', you have ' + num + ' events, honey: ')
      : L((settings.name ? settings.name + ', ' : '') + 'tens ' + num + ' eventos: ', (settings.name ? settings.name + ', ' : '') + 'you have ' + num + ' events: ');
    return cap(intro + list + '.');
  }
  // "o meu nome" passa a ser o nome das definições
  const withName = (t) => t.replace(/\b(?:o\s+)?meu\s+nome\b|\bmy\s+name\b/gi, settings.name || L('o teu nome', 'your name'));
  // Frases variadas para soar a uma pessoa e não a um robô (iguais às do Android, em Msg.java).
  const PHRASES = {
    regularDl: ['{who}não te esqueças: {task}. Tens até às {time}, ainda faltam {left}.',
                '{who}só para lembrar: {task}. Faltam {left} para as {time}.',
                '{hey}{Task}. Ainda tens {left}, até às {time}.'],
    regular:   ['{who}não te esqueças: {task}.', '{who}só para lembrar: {task}.', '{hey}{Task}.'],
    final:     ['{who}último aviso! {Task}. Só faltam {left}.', '{who}atenção, está quase na hora: {task}. Tens até às {time}.'],
    deadline:  ['{who}chegou a hora limite: {task}. Já conseguiste?', '{who}a hora chegou: {task}. Já está feito?'],
    once:      ['{who}está na hora: {task}.', '{hey}Chegou a hora: {task}.', '{who}agora é a altura: {task}.'],
    snooze:    ['{who}voltei, como combinado: {task}.', '{who}outra vez eu: {task}.'],
  };
  // Modo mãe: a voz fala como uma mãe carinhosa. {name} = o teu nome, ou "meu amor" (iguais às do Android, em Msg.java).
  const MOM_PHRASES = {
    regularDl: ['{name}, não te esqueças: {task}. Ainda tens {left}, até às {time}.',
                'Então, {name}? Já trataste disto? {Task}. Só tens até às {time}.',
                '{name}, olha a hora: {task}. Faltam {left}, não deixes para a última, coração!'],
    regular:   ['{name}, não te esqueças: {task}.', 'Já trataste disto, {name}? {Task}.',
                '{name}, só para te lembrar: {task}. Faz isso agora, coração, que é rapidinho.'],
    final:     ['{name}! Último aviso: {task}. Só faltam {left}, despacha-te!', 'Vá lá, {name}, está quase na hora: {task}. Tens até às {time}.'],
    deadline:  ['{name}, chegou a hora: {task}. Conseguiste, coração?', 'Então, {name}? Era agora: {task}. Já está feito?'],
    once:      ['{name}, está na hora: {task}.', 'Vá, {name}, agora é a altura: {task}.', 'Coração, chegou a hora: {task}.'],
    snooze:    ['Eu disse que voltava, {name}: {task}.', '{name}, é outra vez a mãe: {task}. Não te esqueças!'],
  };
  // Frases em inglês (iguais às do Android, em Msg.java)
  const PHRASES_EN = {
    regularDl: ["{who}don't forget: {task}. You have until {time}, {left} left.",
                '{who}just a reminder: {task}. {Left} left until {time}.',
                '{hey}{Task}. You still have {left}, until {time}.'],
    regular:   ["{who}don't forget: {task}.", '{who}just a reminder: {task}.', '{hey}{Task}.'],
    final:     ['{who}last call! {Task}. Only {left} left.', "{who}heads up, it's almost time: {task}. You have until {time}."],
    deadline:  ["{who}it's time: {task}. Did you manage?", "{who}time's up: {task}. Is it done?"],
    once:      ["{who}it's time: {task}.", "{hey}It's time: {task}.", '{who}now is the moment: {task}.'],
    snooze:    ["{who}I'm back, as promised: {task}.", '{who}me again: {task}.'],
  };
  const MOM_PHRASES_EN = {
    regularDl: ["{name}, don't forget: {task}. You still have {left}, until {time}.",
                'So, {name}? Have you done this yet? {Task}. You only have until {time}.',
                "{name}, look at the time: {task}. {Left} left, don't leave it to the last minute, honey!"],
    regular:   ["{name}, don't forget: {task}.", 'Have you done this yet, {name}? {Task}.',
                "{name}, just reminding you: {task}. Do it now, honey, it'll only take a minute."],
    final:     ['{name}! Last call: {task}. Only {left} left, hurry up!', "Come on, {name}, it's almost time: {task}. You have until {time}."],
    deadline:  ["{name}, it's time: {task}. Did you manage, honey?", 'So, {name}? It was now: {task}. Is it done?'],
    once:      ["{name}, it's time: {task}.", "Come on, {name}, now's the moment: {task}.", "Honey, it's time: {task}."],
    snooze:    ["I said I'd be back, {name}: {task}.", "{name}, it's mom again: {task}. Don't forget!"],
  };
  const momName = () => settings.name || L('meu amor', 'sweetheart');
  // "Ir à InPost" → "ir à InPost", mas "IKEA" fica "IKEA"
  const softLower = (t) => /^[A-ZÀ-Ý][a-zà-ÿ]/.test(t) ? t.charAt(0).toLowerCase() + t.slice(1) : t;
  function rawMessage(r, kind) {
    if (r.calAts && r.calAts.length) {
      const now = Date.now();
      const a = r.calAts.filter(x => x.at <= now + 60000).pop() || r.calAts[0];
      return a.say;
    }
    if (r.say && kind !== 'final' && kind !== 'deadline') return withName(r.say) + (/[.!?]$/.test(r.say) ? '' : '.');
    const now = Date.now();
    const task = r.text.replace(/[.!]+$/, '');
    const dl = r.hasDeadline && r.end > now;
    const key = kind === 'regular' || !PHRASES[kind] ? (dl ? 'regularDl' : 'regular') : kind;
    const list = (EN ? (settings.momMode ? MOM_PHRASES_EN : PHRASES_EN) : (settings.momMode ? MOM_PHRASES : PHRASES))[key];
    let out = list[Math.floor(Math.random() * list.length)];
    if (kind === 'snooze' && dl) out += L(' Tens até às {time}.', ' You have until {time}.');
    return out
      .replace('{name}', momName())
      .replace('{who}', settings.name ? settings.name + ', ' : '')
      .replace('{hey}', settings.name ? L('Ei, ', 'Hey, ') + settings.name + '! ' : L('Ei! ', 'Hey! '))
      .replace('{task}', softLower(task)).replace('{Task}', cap(task))
      .replace(/\{time\}/g, r.end ? sayTime(r.end) : '')
      .replace('{Left}', r.end ? cap(sayDuration(r.end - now)) : '')
      .replace('{left}', r.end ? sayDuration(r.end - now) : '');
  }
  function confirmation(r) { return cap(rawConfirmation(r)); }
  function rawConfirmation(r) {
    const s0 = rawConfirmation0(r);
    if (!settings.momMode) return s0;
    return s0.replace(/^(?:Combinado|Okay)\./, pick(EN
      ? ['Okay, ' + momName() + '.', 'Of course, honey.', 'Leave it to me, ' + momName() + '.']
      : ['Está bem, ' + momName() + '.', 'Claro, coração.', 'Deixa comigo, ' + momName() + '.']));
  }
  function rawConfirmation0(r) {
    const task = lowerFirst(r.text);
    if (r.recur && r.recur.every) {
      const a = sayTime(hmToday(r.recur.h, r.recur.m)), b = sayTime(hmToday(r.recur.until.h, r.recur.until.m));
      return EN ? 'Okay. ' + cap(recurLabel(r.recur)) + ', ' + sayInterval(r.recur.every) + ' from ' + a + ' to ' + b + ", I'll remind you: " + task + '.'
                : 'Combinado. ' + cap(recurLabel(r.recur)) + ', ' + sayInterval(r.recur.every) + ', das ' + a + ' às ' + b + ', lembro-te de: ' + task + '.';
    }
    if (r.recur) return EN
      ? 'Okay. ' + cap(recurLabel(r.recur)) + ' at ' + sayTime(r.firstAt) + " I'll remind you: " + task + '.'
      : 'Combinado. ' + cap(recurLabel(r.recur)) + ', às ' + sayTime(r.firstAt) + ', lembro-te de: ' + task + '.';
    const day = dayWord(r.once ? r.firstAt : r.firstAt);
    if (EN) {
      if (r.once) return "Okay. I'll remind you " + (day ? day : '') + 'at ' + sayTime(r.firstAt) + ': ' + task + '.';
      let e = r.say ? "Okay. I'll say " + withName(r.say) + ', ' + sayInterval(r.interval) : "Okay. I'll remind you " + sayInterval(r.interval) + ': ' + task;
      if (r.hasDeadline) e += ', until ' + sayTime(r.end);
      else if (r.forMs) e += ', for ' + sayDuration(r.forMs);
      if (r.interval >= 1) e += '. The first reminder is ' + day + 'at ' + sayTime(r.firstAt) + '.';
      else e += '. Starting in ' + sayDuration(r.firstAt - Date.now()) + '.';
      return e;
    }
    if (r.once) return 'Combinado. ' + cap(day + 'às ') + sayTime(r.firstAt) + ' lembro-te de: ' + task + '.';
    let s = r.say
      ? 'Combinado. Vou dizer ' + withName(r.say) + ', ' + sayInterval(r.interval)
      : 'Combinado. Vou lembrar-te ' + sayInterval(r.interval) + ': ' + task;
    if (r.hasDeadline) s += ', até às ' + sayTime(r.end);
    else if (r.forMs) s += ', durante ' + sayDuration(r.forMs);
    if (r.interval >= 1) s += '. O primeiro aviso é ' + day + 'às ' + sayTime(r.firstAt) + '.';
    else s += '. Começo daqui a ' + sayDuration(r.firstAt - Date.now()) + '.';
    return s;
  }

  // ---------- disparo ----------
  const queue = [];
  const nativeWatch = {};
  let busy = false;
  let current = null;

  const GROUP_MS = 5 * MIN; // lembretes repetidos que iam tocar nos 5 min seguintes juntam-se ao mesmo aviso
  const inQueue = (r) => queue.some(q => q.items.some(x => x.r === r));
  let dndShown = false;
  function tick() {
    const now = Date.now();
    if (dndShown !== !!dndNow()) { dndShown = !!dndNow(); renderDnd(); }
    let changed = false;
    const fired = [];
    reminders.forEach(r => {
      if (r.done) return;
      const due = pending(r).filter(e => e.at <= now);
      if (!due.length) return;
      const ev = due[due.length - 1];
      r.lastAt = ev.at;
      if (ev.kind === 'snooze') r.snoozeAt = null;
      changed = true;
      if (!NATIVE && !inQueue(r)) fired.push({ r, kind: ev.kind });
      // Na app: quem fala é o Android. Se a app está à vista e o Android não disser nada em 15 s, falamos nós.
      if (NATIVE && !document.hidden) nativeWatch[r.id] = { kind: ev.kind, t: now };
    });
    if (fired.length) {
      // junta os repetidos que iam tocar daqui a pouco (nunca os avisos únicos, de último aviso ou de hora limite)
      reminders.forEach(r => {
        if (r.done || r.say || fired.some(x => x.r === r) || inQueue(r)) return;
        const ev = nextEvent(r);
        if (!ev || ev.at > now + GROUP_MS || (ev.kind !== 'regular' && ev.kind !== 'snooze')) return;
        r.lastAt = ev.at;
        if (ev.kind === 'snooze') r.snoozeAt = null;
        fired.push({ r, kind: ev.kind });
      });
      queue.push({ items: fired });
    }
    if (changed) { save(); render(); }
    Object.keys(nativeWatch).forEach(id => {
      if (now - nativeWatch[id].t < 15000) return;
      const r = reminders.find(x => x.id === id);
      if (r && !r.done && !inQueue(r)) queue.push({ items: [{ r, kind: nativeWatch[id].kind }] });
      delete nativeWatch[id];
    });
    if (!busy && queue.length) runQueue();
    updateCountdowns();
  }

  async function runQueue() {
    busy = true;
    while (queue.length) {
      const items = queue.shift().items.filter(x => !x.r.done && reminders.includes(x.r));
      if (!items.length) continue;
      if (items.length > 1) {
        current = { r: items[0].r, kind: items[0].kind, group: items };
        showGroupAlert(items);
        items.forEach(x => notify(x.r, x.kind));
        if (!unlocked) await new Promise(res => onUnlocked.push(res));
        if (!current || !current.group) continue;
        await chime();
        await speak(groupMessage(current.group), settings.repeat);
        if (settings.listenAfter && CAN_LISTEN && current) await listenForAnswer(current.r);
        continue;
      }
      const { r, kind } = items[0];
      current = { r, kind };
      showAlert(r, kind);
      notify(r, kind);
      // o browser só deixa falar depois de um toque na página
      if (!unlocked) await new Promise(res => onUnlocked.push(res));
      if (r.done || !current || current.r !== r) continue;
      await chime();
      await speak(message(r, kind), settings.repeat);
      if (settings.listenAfter && CAN_LISTEN && current && current.r === r) await listenForAnswer(r);
    }
    busy = false;
  }

  const DONE_RE = /(feito|fiz|já está|já foi|já fui|tratei|conclu|pronto|despachad|check|\bdone\b|did it|finished|completed|all set)/;
  const DEL_RE = /(apaga|cancela|esquece|elimina|remove|delete|cancel|forget it)/;
  const SNOOZE_RE = /(adia|adiar|depois|mais tarde|daqui a|espera|lembra.?me|snooze|later|remind me|wait|\bin \d)/;
  const ALL_RE = /\b(tudo|todas?|todos|as duas|os dois|as tr[eê]s|os tr[eê]s|ambas|ambos|everything|all|both)\b/;
  const fold = (t) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const STOP = new Set('feito fiz feita adia adiar apaga apagar cancela minutos minuto horas hora meia tudo todas todos duas dois tres ambas ambos para lembra depois mais tarde esta foi pronto ja done snooze delete minutes minute hours hour half the and all both everything later remind'.split(' '));
  // que lembrete do grupo foi nomeado («feito padaria» → «Ir à padaria»)
  function matchItem(text, items) {
    const words = fold(text).split(/[^a-z0-9]+/).filter(w => w.length >= 3 && !STOP.has(w));
    if (!words.length) return null;
    let best = null, bestScore = 0, tie = false;
    items.forEach(x => {
      const iw = fold(x.r.text).split(/[^a-z0-9]+/).filter(w => w.length >= 3);
      const sc = words.filter(w => iw.some(v => v.startsWith(w.slice(0, 4)) || w.startsWith(v.slice(0, 4)))).length;
      if (sc > bestScore) { best = x; bestScore = sc; tie = false; } else if (sc && sc === bestScore) tie = true;
    });
    return bestScore && !tie ? best : null;
  }
  const answerMinutes = (t) => {
    const P = EN && window.LembreteParserEN ? LembreteParserEN : LembreteParser;
    const m = P.normalize(t).match(/(\d+)\s*(minutos?|min|minutes?|mins?|horas?|hours?|hrs?|h)\b/);
    return m ? parseInt(m[1], 10) * (/^h/.test(m[2]) ? 60 : 1) : 10;
  };
  const groupNow = () => (current && current.group && current.group.length > 1 ? current.group.slice() : null);
  const joinOr = (list) => list.length < 2 ? (list[0] || '') : list.slice(0, -1).join(', ') + L(' ou ', ' or ') + list[list.length - 1];
  const joinAnd = (list) => list.length < 2 ? (list[0] || '') : list.slice(0, -1).join(', ') + L(' e ', ' and ') + list[list.length - 1];
  const taskName = (r) => softLower(r.text.replace(/[.!?]+$/, ''));

  async function listenForAnswer(r, round) {
    round = round || 0;
    const grp = groupNow();
    $('alertHint').textContent = grp
      ? L('A ouvir… diz «feito tudo», «feito» e o nome, ou «adia».', 'Listening… say “all done”, “done” and the name, or “snooze”.')
      : L('A ouvir… diz “feito”, “adia 15 minutos” ou “apaga”.', 'Listening… say “done”, “snooze 15 minutes” or “delete”.');
    let text = '', err = '';
    nativeLog(L('A ouvir a resposta…', 'Listening for a reply…'));
    try { text = await listen({ maxMs: 10000, onInterim: (t) => { $('alertHint').textContent = '“' + t + '”'; } }); } catch (e) { err = e.message || 'erro'; }
    nativeLog(text ? L('Resposta: «', 'Reply: “') + text + L('»', '”') : L('Sem resposta', 'No reply') + (err ? ' (' + err + ')' : ''));
    $('alertHint').textContent = '';
    if (!text || !current) return;
    const t = text.toLowerCase();
    if (!grp) {
      if (current.r !== r) return;
      if (DONE_RE.test(t)) await markDone(r, true);
      else if (DEL_RE.test(t)) { removeReminder(r); alertRemove(r); await speak(L('Apagado.', 'Deleted.')); }
      else if (SNOOZE_RE.test(t)) await snooze(r, answerMinutes(t), true);
      return;
    }
    // vários lembretes no mesmo aviso
    const all = ALL_RE.test(t);
    const target = all ? null : matchItem(t, grp);
    const askWhich = async () => {
      if (round >= 2) return;
      await speak(L('Qual deles? ', 'Which one? ') + joinOr(grp.map(x => taskName(x.r))) + '?');
      if (current) await listenForAnswer(current.r, round + 1);
    };
    if (DONE_RE.test(t)) {
      if (all) { await doneAll(grp); return; }
      if (!target) { await askWhich(); return; }
      await markDone(target.r, true);
      const left = groupNow() || (current ? [{ r: current.r }] : []);
      if (left.length && round < 3) {
        await speak(L('Falta: ', 'Still to do: ') + joinAnd(left.map(x => taskName(x.r))) + '.');
        if (current) await listenForAnswer(current.r, round + 1);
      }
    } else if (DEL_RE.test(t)) {
      if (!target) { await askWhich(); return; }
      removeReminder(target.r); alertRemove(target.r); await speak(L('Apagado.', 'Deleted.'));
    } else if (SNOOZE_RE.test(t)) {
      const m = answerMinutes(t);
      if (target) await snooze(target.r, m, true); else await snoozeAll(grp, m);
    }
  }
  async function doneAll(items) {
    for (let i = 0; i < items.length; i++) await markDone(items[i].r, i === items.length - 1);
  }
  async function snoozeAll(items, mins) {
    for (let i = 0; i < items.length; i++) await snooze(items[i].r, mins, i === items.length - 1);
  }

  function showAlert(r, kind) {
    // guardamos no próprio aviso de que lembrete se trata: os botões funcionam sempre, mesmo que algo se perca pelo caminho
    $('alert').dataset.rid = r.id;
    $('alert').dataset.kind = kind || 'regular';
    $('alert').hidden = false;
    $('alert').scrollTop = 0;
    $('alertKicker').textContent = (EN ? { final: 'Last call', deadline: "Time's up", snooze: 'Again', once: "It's time" } : { final: 'Último aviso', deadline: 'Hora limite', snooze: 'Outra vez', once: 'Está na hora' })[kind] || L('Lembrete', 'Reminder');
    $('alertTask').textContent = r.text;
    $('alertMeta').textContent = alertMetaText(r);
    $('alertList').hidden = true;
    $('alertDoneLabel').textContent = L('Feito', 'Done');
  }
  function alertMetaText(r) {
    if (r.recur) return r.recur.every ? recurDesc(r.recur) : cap(recurLabel(r.recur)) + L(' às ', ' at ') + recurTime(r.recur);
    return r.hasDeadline && r.end > Date.now() ? L('Tens até às ', 'You have until ') + hm(r.end) + L(' · faltam ', ' · ') + sayDuration(r.end - Date.now()) + L('', ' left')
      : !r.once && r.interval ? shortInterval(r.interval) + (r.end ? L(' até às ', ' until ') + hm(r.end) : '') : '';
  }
  // Vários lembretes no mesmo aviso: lista com um «Feito» para cada um, e «Feito tudo» / «Adiar tudo»
  function showGroupAlert(items) {
    $('alert').dataset.rid = items[0].r.id;
    $('alert').dataset.kind = items[0].kind || 'regular';
    $('alert').hidden = false;
    $('alert').scrollTop = 0;
    $('alertKicker').textContent = L('Eventos', 'Events');
    $('alertTask').textContent = L('Tens ' + items.length + ' eventos', 'You have ' + items.length + ' events');
    $('alertMeta').textContent = '';
    $('alertList').innerHTML = items.map(({ r }) => '<li><span><b>' + esc(r.text) + '</b><small>' + esc(alertMetaText(r)) + '</small></span>'
      + '<button class="alert-item-done" data-alert="done-item" data-rid="' + esc(r.id) + '">' + ICON.check + esc(L('Feito', 'Done')) + '</button></li>').join('');
    $('alertList').hidden = false;
    $('alertDoneLabel').textContent = L('Feito tudo', 'All done');
  }
  // tira um lembrete do aviso aberto: no grupo, a lista encolhe; se era o último, o aviso fecha
  function alertRemove(r) {
    if (!current) return;
    if (current.group && current.group.length > 1) {
      if (!current.group.some(x => x.r === r)) return;
      current.group = current.group.filter(x => x.r !== r);
      if (current.group.length > 1) { current.r = current.group[0].r; current.kind = current.group[0].kind; showGroupAlert(current.group); return; }
      const only = current.group[0];
      current = { r: only.r, kind: only.kind };
      showAlert(only.r, only.kind);
      return;
    }
    if (current.r === r) hideAlert();
  }
  function hideAlert() {
    $('alert').hidden = true; current = null; stopListening();
    if (NATIVE && NATIVE.alertClosed) NATIVE.alertClosed(); // se abriu no ecrã de bloqueio, volta ao bloqueio
  }

  function closeTopLayer() {
    if (!$('alert').hidden) { cancelSpeech(); hideAlert(); return true; }
    for (const id of ['editDlg', 'settingsDlg']) if ($(id).open) { $(id).close(); return true; }
    if (!$('typeForm').hidden) { setTyping(false); return true; }
    return false;
  }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('alert').hidden) closeTopLayer(); });

  async function markDone(r, spoken) {
    if (r.recur) {
      // repete por dias: fica feito o de hoje (ou o próximo, se ainda não tocou nas próximas horas) e continua
      const nx = nextEvent(r);
      // de X em X dentro do dia: «feito» cala o resto de hoje
      const endToday = r.recur.every ? hmToday(r.recur.until.h, r.recur.until.m) : 0;
      r.lastAt = Math.max(r.lastAt || 0, Date.now(), endToday > Date.now() ? endToday : 0, !r.recur.every && nx && nx.at - Date.now() < 12 * 3600e3 ? nx.at : 0);
      r.snoozeAt = null; r.lastDoneAt = Date.now();
    } else { r.done = true; r.doneAt = Date.now(); }
    if (r.cal) calMarkDone(r);
    save(); render();
    alertRemove(r);
    closeNotif(r.id);
    if (spoken) await speak(pick(settings.momMode
      ? (EN ? ["Well done! I'm proud of you.", "Good job, honey! That's the way.", "That's it, " + momName() + '! One less thing.']
            : ['Muito bem! Estou orgulhosa de ti.', 'Boa, coração! Assim é que é.', 'Isso mesmo, ' + momName() + '! Menos um evento.'])
      : (EN ? ["Nice! It's done.", 'Well done, one less thing.', 'Done. Nice!'] : ['Boa! Está feito.', 'Muito bem, menos um evento.', 'Feito. Boa!'])));
  }
  async function snooze(r, mins, spoken) {
    r.snoozeAt = Date.now() + mins * MIN;
    r.quietUntil = r.snoozeAt;
    if (r.done) r.done = false;
    save(); render();
    alertRemove(r);
    closeNotif(r.id);
    if (spoken) await speak(settings.momMode
      ? L('Está bem, mas daqui a ' + sayDuration(mins * MIN) + ' volto a lembrar, hein?', "Okay, but I'll remind you again in " + sayDuration(mins * MIN) + ', alright?')
      : L('Está bem, lembro-te daqui a ' + sayDuration(mins * MIN) + '.', "Okay, I'll remind you in " + sayDuration(mins * MIN) + '.'));
    else toast(L('Volto a lembrar às ', "I'll remind you again at ") + hm(r.snoozeAt));
  }
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  function removeReminder(r) {
    if (r.cal) calMarkDone(r); // apagado aqui: não volta a vir do calendário
    reminders = reminders.filter(x => x !== r);
    save(); render();
    closeNotif(r.id);
  }

  // ---------- notificações (para quando a app está noutro separador) ----------
  let swReg = null;
  if (!NATIVE && 'serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').then(reg => { swReg = reg; }).catch(() => {});
    navigator.serviceWorker.addEventListener('message', (e) => handleExternalAction(e.data || {}));
  }
  function notifAllowed() { return 'Notification' in window && Notification.permission === 'granted'; }
  function notify(r, kind) {
    if (NATIVE) return;
    if (!notifAllowed()) return;
    const title = (EN ? { final: 'Last call', deadline: "Time's up", once: "It's time" } : { final: 'Último aviso', deadline: 'Hora limite', once: 'Está na hora' })[kind] || L('Lembrete', 'Reminder');
    const body = r.text + (r.hasDeadline && r.end > Date.now() ? L(' · até às ', ' · until ') + hm(r.end) : '');
    const opts = { body, tag: 'lembrete-' + r.id, renotify: true, requireInteraction: true, icon: 'icon.svg', badge: 'icon.svg', data: { id: r.id } };
    if (swReg && swReg.showNotification) {
      swReg.showNotification(title, Object.assign(opts, { actions: [{ action: 'done', title: L('Feito ✓', 'Done ✓') }, { action: 'snooze', title: '+10 min' }] })).catch(() => {});
    } else if (document.hidden) {
      try { new Notification(title, opts); } catch (e) {}
    }
  }
  function closeNotif(id) {
    if (NATIVE) { NATIVE.cancelNotification(id); return; }
    if (swReg && swReg.getNotifications) swReg.getNotifications({ tag: 'lembrete-' + id }).then(ns => ns.forEach(n => n.close())).catch(() => {});
  }
  function handleExternalAction({ action, id }) {
    const r = reminders.find(x => x.id === id);
    if (!r) return;
    if (action === 'done') markDone(r, false);
    else if (action === 'snooze') snooze(r, 10, false);
  }
  function updateNotifButton() {
    $('enableNotif').hidden = !('Notification' in window) || Notification.permission !== 'default';
  }

  // ---------- manter ecrã ligado ----------
  let wakeLock = null, wantAwake = false;
  async function setAwake(on) {
    wantAwake = on;
    $('keepAwake').setAttribute('aria-pressed', String(on));
    if (!('wakeLock' in navigator)) { if (on) toast(L('Este browser não deixa manter o ecrã ligado.', "This browser can't keep the screen on.")); return; }
    try {
      if (on && !wakeLock) {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => { wakeLock = null; });
      } else if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
    } catch (e) { $('keepAwake').setAttribute('aria-pressed', 'false'); wantAwake = false; }
  }
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) { if (wantAwake && !wakeLock) setAwake(true); tick(); }
  });

  // ---------- criar a partir de texto/voz ----------
  let lastCreated = null;
  async function handleInput(text, opts) {
    opts = opts || {};
    text = text.trim();
    if (!text) return;
    const t = text.toLowerCase();

    if (/^(?:o\s+)?que\s+(?:é\s+que\s+)?(?:tenho|falta)|^(?:lista|lê|diz)\b.*(?:lembretes|tarefas)|^(?:quais|que)\s+(?:são\s+)?(?:os\s+)?(?:meus\s+)?lembretes/.test(t)
        || /^what(?:'s| is| do i have| have i got)\b|^(?:list|read|tell me)\b.*\b(?:reminders|tasks|things)\b|^(?:what are )?my reminders/.test(t)) {
      return readList();
    }
    if (DND_OFF_RE.test(t)) return stopDnd(true);
    if (DND_RE.test(t) && !/\b(?:lembra|lembrar|avisa-me (?:de|para|que)|remind)\b/.test(t)) return startDnd(text);
    const doneM = t.match(/^(?:já\s+)?(?:fiz|feito|terminei|acabei|já fui)\s+(?:o|a|de|que)?\s*(.+)$/)
      || t.match(/^(?:i\s+)?(?:did|done|finished|completed|i've done)\s+(?:the\s+|with\s+)?(.+)$/);
    if (doneM) {
      const r = findByWords(doneM[1]);
      if (r) { await markDone(r, true); return; }
    }

    const p = (EN && window.LembreteParserEN ? LembreteParserEN : LembreteParser).parse(text, { defaultInterval: 60 });
    const r = {
      id: Math.random().toString(36).slice(2, 10),
      text: p.task, interval: p.interval, firstAt: p.firstAt, end: p.end,
      once: p.once, hasDeadline: p.hasDeadline, createdAt: Date.now(), lastAt: 0, done: false,
      said: text, say: p.say || null, forMs: p.forMs || null, recur: p.recur || null,
    };
    nativeLog(L('Ouvi', 'Heard') + ': «' + text + '» → ' + r.text + ' · ' + (r.once ? hm(r.firstAt) : (r.interval + ' min' + (r.end ? ' → ' + hm(r.end) : ''))));
    reminders.push(r);
    lastCreated = r;
    save(); render();
    // não disse a hora: pergunta («A que horas te lembro?»). O lembrete já fica criado (daqui a 1 hora) e só se acerta a hora.
    if (p.noTime && !r.recur && !r.say) {
      if (opts.typed || !CAN_LISTEN) {
        toast(L('Adicionado: ', 'Added: ') + r.text + L(' · daqui a 1 hora', ' · in 1 hour'), [
          { label: L('Escolher hora', 'Pick a time'), fn: () => openEdit(r) },
          { label: L('Desfazer', 'Undo'), fn: () => { removeReminder(r); speak(L('Desfeito.', 'Undone.')); } },
        ]);
        await speak(L('Combinado. Lembro-te daqui a uma hora. Se quiseres outra hora, toca em escolher hora.', "Okay. I'll remind you in an hour. For another time, tap pick a time."));
        return;
      }
      return askTime(r, text, p);
    }
    toast(L('Adicionado: ', 'Added: ') + r.text, [
      { label: L('Editar', 'Edit'), fn: () => openEdit(r) },
      { label: L('Desfazer', 'Undo'), fn: () => { removeReminder(r); speak(L('Desfeito.', 'Undone.')); } },
    ]);
    await speak(confirmation(r));
  }

  const NO_TIME_RE = /^(?:tanto faz|n[ãa]o sei|qualquer (?:hora|altura)|quando quiseres|whatever|any ?time|i don'?t know|don'?t know|doesn'?t matter|não interessa)/;
  async function askTime(r, text, p) {
    const tomorrow = r.firstAt - Date.now() > 12 * 3600e3;
    await speak(settings.momMode
      ? L('Está bem, ' + momName() + '. A que horas te lembro' + (tomorrow ? ', amanhã?' : '?'), 'Okay, ' + momName() + '. What time should I remind you' + (tomorrow ? ' tomorrow?' : '?'))
      : L('Combinado. A que horas te lembro' + (tomorrow ? ', amanhã?' : '?'), 'Okay. What time should I remind you' + (tomorrow ? ' tomorrow?' : '?')));
    if (!reminders.includes(r)) return;
    let ans = '';
    micBusy = true;
    $('mic').classList.add('listening');
    $('micLabel').textContent = L('A ouvir…', 'Listening…');
    $('transcript').textContent = L('A que horas? Ex.: «às 6», «daqui a meia hora»', 'What time? E.g. “at 6”, “in half an hour”');
    try { ans = await listen({ maxMs: 8000, onInterim: (t) => { $('transcript').textContent = '“' + t + '”'; } }); } catch (e) {}
    micBusy = false;
    $('mic').classList.remove('listening');
    $('micLabel').textContent = L('Toca e fala', 'Tap and talk');
    nativeLog(ans ? L('Hora: «', 'Time: “') + ans + L('»', '”') : L('Sem resposta à hora', 'No answer for the time'));
    const keep = async (msg) => {
      $('transcript').textContent = '';
      toast(L('Adicionado: ', 'Added: ') + r.text + ' · ' + hm(r.firstAt), [{ label: L('Escolher hora', 'Pick a time'), fn: () => openEdit(r) }]);
      await speak(msg);
    };
    if (!ans || NO_TIME_RE.test(ans.toLowerCase().trim())) {
      return keep(L('Está bem, lembro-te daqui a uma hora.', "Okay, I'll remind you in an hour."));
    }
    $('transcript').textContent = '“' + ans + '”';
    hideTranscriptSoon();
    // junta a resposta ao que tinha dito: «ir ao supermercado» + «às 6» = «ir ao supermercado às 6»
    const q = (EN && window.LembreteParserEN ? LembreteParserEN : LembreteParser).parse(text + ' ' + ans, { defaultInterval: 60 });
    if (q.noTime || !reminders.includes(r)) {
      return keep(L('Não percebi a hora. Fica para daqui a uma hora, e podes mudar em editar.', "I didn't catch the time. I'll remind you in an hour; you can change it in edit."));
    }
    Object.assign(r, { text: q.task || r.text, interval: q.interval, firstAt: q.firstAt, end: q.end, once: q.once, hasDeadline: q.hasDeadline,
      forMs: q.forMs || null, recur: q.recur || null, said: text + ' · ' + ans, lastAt: 0 });
    save(); render();
    toast(L('Adicionado: ', 'Added: ') + r.text, [
      { label: L('Editar', 'Edit'), fn: () => openEdit(r) },
      { label: L('Desfazer', 'Undo'), fn: () => { removeReminder(r); speak(L('Desfeito.', 'Undone.')); } },
    ]);
    await speak(confirmation(r));
  }

  // ---------- não incomodar (por voz) ----------
  const DND_RE = /n[ãa]o\s+(?:me\s+)?(?:incomodes|incomode|chateies|interrompas|avises)|n[ãa]o\s+incomodar|modo\s+(?:de\s+)?sil[êe]ncio|sem\s+avisos|n[ãa]o\s+quero\s+(?:ser\s+incomodad[oa]|avisos)|\b(?:do\s+not\s+disturb|don'?t\s+disturb|no\s+reminders|leave\s+me\s+alone|quiet\s+time)\b/;
  const DND_OFF_RE = /(?:j[áa]\s+)?podes\s+(?:voltar\s+a\s+)?(?:incomodar|avisar|falar)|(?:desliga|acaba|cancela|termina|tira)r?\s+(?:o\s+)?(?:modo\s+)?(?:n[ãa]o\s+incomodar|sil[êe]ncio)|\byou\s+can\s+(?:disturb|remind)\s+me\b|\b(?:turn\s+off|cancel|end|stop)\s+(?:the\s+)?(?:do\s+not\s+disturb|quiet\s+time)\b/;
  async function startDnd(text) {
    const now = Date.now();
    const s = ' ' + text.toLowerCase()
      .replace(/(?:na|durante a)\s+próxima\s+hora|(?:for\s+)?the\s+next\s+hour/g, ' durante 1 hora ')
      .replace(/(?:for\s+)?an\s+hour/g, ' for 1 hour ')
      .replace(/(?:durante\s+)?uma\s+hora/g, ' durante 1 hora ') + ' ';
    const p = (EN && window.LembreteParserEN ? LembreteParserEN : LembreteParser).parse(s, { defaultInterval: 60 });
    let from = now, to = null;
    if (p.win && p.win.to > now) { from = Math.max(now, p.win.from || now); to = p.win.to; }
    else if (p.once && p.firstAt > now && /\b(?:at[ée]|until|till)\b/.test(s)) to = p.firstAt;
    if (!to) to = now + 60 * MIN;
    const old = settings.dnd;
    if (old && old.to <= now) { reminders.forEach(r => { if (!r.done) r.lastAt = Math.max(r.lastAt || 0, old.to); }); save(); }
    settings.dnd = { from, to };
    saveSettings(); render();
    const later = from > now + MIN;
    toast(later ? L('Não incomodar: ' + hm(from) + '–' + hm(to), 'Do not disturb: ' + hm(from) + '–' + hm(to))
                : L('Não incomodar até às ' + hm(to), 'Do not disturb until ' + hm(to)),
      [{ label: L('Cancelar', 'Cancel'), fn: () => stopDnd(false) }]);
    nativeLog(L('Ouvi', 'Heard') + ': «' + text + '» → ' + L('não incomodar ', 'do not disturb ') + hm(from) + '–' + hm(to));
    await speak(later
      ? L('Combinado. Das ' + sayTime(from) + ' às ' + sayTime(to) + ' não te incomodo.', 'Okay. From ' + sayTime(from) + ' to ' + sayTime(to) + " I won't disturb you.")
      : L('Combinado. Até às ' + sayTime(to) + ' não te incomodo.', "Okay. I won't disturb you until " + sayTime(to) + '.'));
  }
  async function stopDnd(say) {
    const had = !!dndNow();
    // fecha a janela agora: o que estava adiado toca já, as repetições caladas não voltam
    if (had) settings.dnd = { from: Math.min(settings.dnd.from, Date.now()), to: Date.now() };
    saveSettings(); render();
    if (say) await speak(had ? L('Pronto, já te volto a avisar.', "Okay, I'll remind you again.") : L('Não estava a pausar os avisos.', "Reminders weren't paused."));
  }
  function renderDnd() {
    const d = dndNow(), bar = $('dndBar');
    if (!bar) return;
    bar.hidden = !d;
    if (!d) return;
    $('dndText').textContent = d.from > Date.now()
      ? L('Não incomodar das ' + hm(d.from) + ' às ' + hm(d.to), 'Do not disturb ' + hm(d.from) + '–' + hm(d.to))
      : L('Não incomodar até às ' + hm(d.to), 'Do not disturb until ' + hm(d.to));
  }

  function findByWords(phrase) {
    const words = phrase.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    let best = null, bestScore = 0;
    reminders.filter(r => !r.done).forEach(r => {
      const txt = r.text.toLowerCase();
      const sc = words.filter(w => txt.includes(w)).length;
      if (sc > bestScore) { best = r; bestScore = sc; }
    });
    return best;
  }

  async function readList() {
    const open = reminders.filter(r => !r.done);
    if (!open.length) return speak(L('Não tens nada pendente. Boa!', 'You have nothing pending. Nice!'));
    const parts = open.map(r => {
      if (r.recur && r.recur.every) return r.text + ', ' + recurLabel(r.recur) + ', ' + sayInterval(r.recur.every);
      if (r.recur) return r.text + ', ' + recurLabel(r.recur) + L(' às ', ' at ') + sayTime(r.firstAt);
      if (r.once) return r.text + ', ' + dayWord(r.firstAt) + L('às ', 'at ') + sayTime(r.firstAt);
      if (r.hasDeadline) return r.text + L(', até às ', ', by ') + sayTime(r.end);
      return r.text;
    });
    await speak(L('Tens ', 'You have ') + open.length + (open.length === 1 ? L(' evento', ' thing') : L(' eventos', ' things')) + L(' por fazer. ', ' to do. ') + parts.join('. ') + '.');
  }

  // ---------- microfone ----------
  let micBusy = false;
  async function onMic() {
    unlock();
    if (micBusy) { stopListening(); return; } // segundo toque: terminei de falar
    if (!CAN_LISTEN) { setTyping(true); toast(L('Este browser não percebe voz. Usa o Chrome, o Edge ou o Safari, ou escreve.', "This browser doesn't understand speech. Use Chrome, Edge or Safari, or type.")); return; }
    cancelSpeech();
    micBusy = true;
    $('mic').classList.add('listening');
    $('micLabel').textContent = L('Toca para terminar', 'Tap to finish');
    clearTimeout(transcriptTimer);
    $('transcript').textContent = '';
    try {
      const text = await listen({ onInterim: (t) => { $('transcript').textContent = '“' + t + '”'; } });
      $('mic').classList.remove('listening');
      $('micLabel').textContent = L('Toca e fala', 'Tap and talk');
      micBusy = false;
      if (!text) { $('transcript').textContent = L('Não ouvi nada. Tenta outra vez.', "I didn't hear anything. Try again."); hideTranscriptSoon(); return; }
      $('transcript').textContent = '“' + text + '”';
      await handleInput(text);
      hideTranscriptSoon();
    } catch (e) {
      micBusy = false;
      $('mic').classList.remove('listening');
      $('micLabel').textContent = L('Toca e fala', 'Tap and talk');
      const msg = e.message === 'not-allowed' || e.message === 'service-not-allowed'
        ? (NATIVE ? L('Tens de autorizar o microfone: Definições do Android → Apps → Mamly → Permissões.', 'Allow the microphone: Android Settings → Apps → Mamly → Permissions.')
                  : L('Tens de dar autorização ao microfone (no cadeado ao lado do endereço).', 'Allow the microphone (padlock next to the address).'))
        : e.message === 'network' ? L('O reconhecimento de voz precisa de internet.', 'Speech recognition needs internet.') : L('Não consegui ouvir. Tenta outra vez ou escreve.', "I couldn't hear you. Try again or type.");
      $('transcript').textContent = msg;
      hideTranscriptSoon(8000);
    }
  }
  // o texto ouvido fica uns segundos (para confirmares) e depois sai sozinho
  let transcriptTimer = 0;
  function hideTranscriptSoon(ms) {
    clearTimeout(transcriptTimer);
    transcriptTimer = setTimeout(() => { if (!micBusy) $('transcript').textContent = ''; }, ms || 4000);
  }

  // ---------- desenhar ----------
  const ICON = {
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2Z"/></svg>',
    repeat: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 7h10v3l4-4-4-4v3H5v6h2V7Zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4Z"/></svg>',
    clock: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 10.4 3.5 2.1-.8 1.3L11 13V7h2v5.4Z"/></svg>',
    bell: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 22a2.5 2.5 0 0 0 2.4-2h-4.8a2.5 2.5 0 0 0 2.4 2Zm7-6V11a7 7 0 0 0-5.5-6.8V3.5a1.5 1.5 0 0 0-3 0v.7A7 7 0 0 0 5 11v5l-2 2v1h18v-1l-2-2Z"/></svg>',
    say: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M3 10v4h4l5 4V6L7 10H3Zm13.5 2A4.5 4.5 0 0 0 14 8v8a4.5 4.5 0 0 0 2.5-4Z"/></svg>',
    undo: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M12.5 8c-2.6 0-5 1-6.9 2.6L2 7v9h9l-3.6-3.6A8 8 0 0 1 20.1 16l2.4-.8A10.5 10.5 0 0 0 12.5 8Z"/></svg>',
    trash: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12ZM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4Z"/></svg>',
  };
  const shortInterval = (min) => EN ? cap(sayInterval(min)) : min < 1 ? 'De ' + Math.round(min * 60) + ' em ' + Math.round(min * 60) + ' s' : min === 1 ? 'De minuto a minuto' : min === 60 ? 'De hora a hora' : min === 30 ? 'De meia em meia hora' : min % 60 === 0 ? 'De ' + (min / 60) + ' em ' + (min / 60) + ' h' : 'De ' + min + ' em ' + min + ' min';

  // ---------- apoiantes (web/supporters.js) ----------
  const SUP = window.MAMLY_SUPPORTERS || {};
  const supOk = (s) => s && s.name && s.logo && /^https?:\/\//.test(s.url || '');
  const supMain = supOk(SUP.main) ? SUP.main : null;
  const supOthers = (SUP.others || []).filter(supOk);
  const supLogo = (s) => (s.logoDark ? '<picture><source srcset="' + esc(s.logoDark) + '" media="(prefers-color-scheme: dark)">' : '')
    + '<img class="sp-logo' + (s.logoDark ? '' : ' sp-nodark') + '" src="' + esc(s.logo) + '" alt="' + esc(s.name) + '">' + (s.logoDark ? '</picture>' : '');
  const supLink = (s, inner, cls) => '<a' + (cls ? ' class="' + cls + '"' : '') + ' href="' + esc(s.url) + '" target="_blank" rel="noopener sponsored">' + inner + '</a>';
  function renderSupporters(openCount) {
    $('spStrip').hidden = !supMain || openCount === 0;
    $('spEmpty').hidden = !supMain;
    if (!supMain) return;
    $('spStrip').innerHTML = '<small>' + L('Com o apoio de', 'Supported by') + '</small>' + supLink(supMain, supLogo(supMain));
    $('spEmpty').innerHTML = L('Este momento de calma é oferecido por', 'This calm moment is brought to you by') + '<br>' + supLink(supMain, supLogo(supMain));
  }
  function renderSupportWall() {
    if (!supMain && !supOthers.length) { $('supportMail').hidden = !SUP.open; return; } // cartão «Este espaço pode ser teu»
    const mail = EN ? 'mailto:hello@mamly.app?subject=Supporting%20Mamly' : 'mailto:ola@mamly.app?subject=Quero%20apoiar%20o%20Mamly';
    $('spWall').innerHTML = '<h4>' + L('Apoiantes do Mamly', 'Mamly supporters') + ' 💛</h4>'
      + (supMain ? supLink(supMain, supLogo(supMain) + '<span>' + L('Apoiante principal', 'Main supporter') + '</span>', 'sp-main') : '')
      + (supOthers.length ? '<div class="sp-grid">' + supOthers.map(s => supLink(s, supLogo(s))).join('') + '</div>' : '')
      + '<p class="sp-cta">' + L('Queres aparecer aqui?', 'Want to be here?') + ' <a href="' + mail + '">' + L('Fala connosco', 'Get in touch') + '</a></p>';
    $('spWall').hidden = false;
    $('supportMail').hidden = true;
  }

  function render() {
    renderDnd();
    const open = reminders.filter(r => !r.done).sort((a, b) => {
      const na = nextEvent(a), nb = nextEvent(b);
      return (na ? na.at : 9e15) - (nb ? nb.at : 9e15);
    });
    const done = reminders.filter(r => r.done).sort((a, b) => b.doneAt - a.doneAt);
    $('list').innerHTML = open.map(itemHTML).join('');
    $('empty').hidden = open.length > 0;
    renderSupporters(open.length);
    $('count').textContent = open.length ? String(open.length) : '';
    $('doneWrap').hidden = done.length === 0;
    $('doneCount').textContent = String(done.length);
    $('doneList').innerHTML = done.map(r => `<li class="item finished" data-id="${r.id}">
        <span class="check" aria-hidden="true">${ICON.check}</span>
        <div class="item-body"><p class="item-task">${esc(r.text)}</p></div>
        <div class="item-when"><small>${L('feito às ', 'done at ')}${hm(r.doneAt)}</small>
          <span style="display:flex;gap:6px"><button class="say" data-act="undo" aria-label="${L('Voltar a pôr na lista', 'Put back on the list')}" title="${L('Desfazer', 'Undo')}">${ICON.undo}</button>
          <button class="say" data-act="delete" aria-label="${L('Apagar', 'Delete')}" title="${L('Apagar', 'Delete')}">${ICON.trash}</button></span></div></li>`).join('');
    renderHeader(open, done);
    updateCountdowns();
  }

  function renderHeader(open, done) {
    const h = new Date().getHours();
    const hello = EN ? (h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening')
                     : (h < 6 ? 'Boa noite' : h < 13 ? 'Bom dia' : h < 20 ? 'Boa tarde' : 'Boa noite');
    $('greeting').textContent = hello + (settings.name ? ', ' + settings.name : settings.momMode ? L(', meu amor', ', sweetheart') : '') + (settings.momMode ? ' 💛' : '.');
    $('today').textContent = cap(new Date().toLocaleDateString(L('pt-PT', 'en-GB'), { weekday: 'long', day: 'numeric', month: 'short' }).replace('.', ''));
    document.querySelector('.list-head').hidden = open.length === 0;
    const n = open.length;
    $('summary').innerHTML = n === 0
      ? (done.length ? L('Tudo feito. <b>Boa!</b>', 'All done. <b>Nice!</b>') : L('Nada pendente. Diz-me o que tens de fazer.', 'Nothing pending. Tell me what you need to do.'))
      : EN ? 'You have <b>' + n + (n === 1 ? ' thing' : ' things') + '</b> to do' + (done.length ? ' · ' + done.length + ' already done' : '') + '.'
      : 'Tens <b>' + n + (n === 1 ? ' evento' : ' eventos') + '</b> por fazer' + (done.length ? ' · ' + done.length + ' já ' + (done.length === 1 ? 'feito' : 'feitos') : '') + '.';
  }

  function itemHTML(r) {
    const st = status(r);
    const tags = [];
    if (r.cal) tags.push(`<span class="tag">📅 ${esc(cap(dayWord(r.cal.begin) || L('hoje ', 'today ')) + L('às ', 'at ') + hm(r.cal.begin))}</span>`);
    else if (r.recur) tags.push(`<span class="tag">${ICON.repeat}${esc(cap(recurLabel(r.recur)) + (r.recur.every ? ' · ' + shortInterval(r.recur.every).toLowerCase() : ''))}</span>`);
    else if (r.once) tags.push(`<span class="tag">${ICON.bell}${L('Uma vez', 'Once')}</span>`);
    else tags.push(`<span class="tag">${ICON.repeat}${esc(shortInterval(r.interval))}</span>`);
    if (r.hasDeadline) tags.push(`<span class="tag deadline">${ICON.clock}${EN ? 'by ' + dayWord(r.end) : dayWord(r.end) + 'até '}${hm(r.end)}</span>`);
    else if (!r.once && r.end) tags.push(`<span class="tag">${L('até', 'until')} ${hm(r.end)}</span>`);
    return `<li class="item ${st}" data-id="${r.id}">
      <button class="check" data-act="done" aria-label="${L('Marcar como feito', 'Mark as done')}">${ICON.check}</button>
      <button class="item-body" data-act="edit" aria-label="${L('Editar', 'Edit')} ${esc(r.text)}">
        <p class="item-task">${esc(r.text)}</p>
        <div class="item-meta">${tags.join('')}</div>
        ${r.hasDeadline ? `<div class="item-bar"><i data-bar="${r.id}"></i></div>` : ''}
      </button>
      <div class="item-when" data-next="${r.id}"><b></b><small></small></div>
    </li>`;
  }

  const progress = (r, now) => {
    const from = r.createdAt || r.firstAt, to = r.end;
    return to > from ? Math.min(1, Math.max(0, (now - from) / (to - from))) : 1;
  };

  function updateCountdowns() {
    const now = Date.now();
    document.querySelectorAll('[data-next]').forEach(el => {
      const r = reminders.find(x => x.id === el.dataset.next);
      if (!r) return;
      const ev = nextEvent(r);
      const b = el.querySelector('b'), sm = el.querySelector('small');
      if (r.cal && !ev) { // evento do calendário sem mais avisos: mostra a hora do evento
        const cb = hm(r.cal.begin), cs = (dayWord(r.cal.begin) || L('hoje ', 'today ')).trim() + L(' · sem aviso', ' · no reminder');
        if (b.textContent !== cb) b.textContent = cb;
        if (sm.textContent !== cs) sm.textContent = cs;
        return;
      }
      const big = ev ? bigTime(ev.at, now) : (r.hasDeadline || r.once ? '!' : '—');
      const small = ev ? (dayWord(ev.at) ? dayWord(ev.at).trim() : L('em ', 'in ') + shortDur(ev.at - now)) : (r.hasDeadline || r.once ? L('Já passou. Fizeste?', 'Time passed. Done?') : L('sem avisos', 'no reminders'));
      if (b.textContent !== big) b.textContent = big;
      if (sm.textContent !== small) sm.textContent = small;
    });
    document.querySelectorAll('[data-bar]').forEach(el => {
      const r = reminders.find(x => x.id === el.dataset.bar);
      if (r) el.style.width = Math.round(progress(r, now) * 100) + '%';
    });
    updateNext(now);
  }

  // cartão grande: o próximo aviso de todos
  function updateNext(now) {
    let best = null, bestEv = null;
    reminders.forEach(r => {
      if (r.done) return;
      const ev = nextEvent(r);
      if (ev && (!bestEv || ev.at < bestEv.at)) { best = r; bestEv = ev; }
    });
    $('next').hidden = !best;
    if (!best) return;
    const label = (EN ? { final: 'Last call', deadline: "Time's up", snooze: 'Back soon', once: 'Up next' } : { final: 'Último aviso', deadline: 'Hora limite', snooze: 'Volto a lembrar', once: 'A seguir' })[bestEv.kind] || L('Próximo aviso', 'Next reminder');
    setText('nextKind', label);
    setText('nextIn', dayWord(bestEv.at) ? cap(dayWord(bestEv.at).trim()) : L('daqui a ', 'in ') + shortDur(bestEv.at - now));
    setText('nextTime', bigTime(bestEv.at, now));
    setText('nextTask', best.text);
    const meta = best.cal ? '📅 ' + cap(dayWord(best.cal.begin) || L('hoje ', 'today ')) + L('às ', 'at ') + hm(best.cal.begin) : best.recur ? cap(recurLabel(best.recur)) : best.once ? L('Aviso único', 'One-time reminder') : shortInterval(best.interval) + (best.hasDeadline ? L(' · prazo às ', ' · due at ') + hm(best.end) : '');
    setText('nextMeta', meta);
    // anel: quanto falta para o próximo aviso (cheio = acabou de avisar, vazio = vai tocar)
    const span = best.once || best.recur ? Math.max(bestEv.at - Math.max(best.createdAt || now, best.recur ? best.lastAt || 0 : 0), MIN) : (bestEv.kind === 'regular' ? best.interval * MIN : 15 * MIN);
    const left = Math.min(1, Math.max(0, (bestEv.at - now) / span));
    $('nextRing').style.strokeDashoffset = String(326.7 * (1 - left));
    $('nextBarWrap').hidden = !best.hasDeadline;
    if (best.hasDeadline) $('nextBar').style.width = Math.round(progress(best, now) * 100) + '%';
  }
  // a menos de um minuto, mostra a contagem em segundos em vez da hora
  const bigTime = (at, now) => at - now < 60e3 ? Math.max(0, Math.ceil((at - now) / 1000)) + ' s' : hm(at);
  const setText = (id, t) => { const el = $(id); if (el.textContent !== t) el.textContent = t; };
  const shortDur = (ms) => {
    if (ms < 60e3) return Math.max(0, Math.ceil(ms / 1000)) + ' s';
    const m = Math.max(0, Math.ceil(ms / MIN));
    if (m < 60) return m + ' min';
    const h = Math.floor(m / 60), r = m % 60;
    return h + ' h' + (r ? ' ' + r + ' min' : '');
  };

  let toastTimer = null;
  function toast(text, actions, ms) {
    const el = $('toast');
    el.innerHTML = '<span>' + esc(text) + '</span>';
    el.classList.toggle('wide', text.length > 60 && !!(actions && actions.length));
    (actions || []).forEach(a => {
      const b = document.createElement('button');
      b.textContent = a.label;
      b.onclick = () => { el.hidden = true; a.fn(); };
      el.appendChild(b);
    });
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, ms || (actions ? 9000 : 4000));
  }

  // ---------- editar ----------
  let editing = null;
  const toTimeInput = (t) => hm(t);
  const toDateInput = (t) => { const d = new Date(t); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  function fromTimeInput(val, ref) {
    const [h, m] = val.split(':').map(Number);
    const d = new Date(ref || Date.now()); d.setHours(h, m, 0, 0);
    return d.getTime();
  }
  const setDays = (days) => document.querySelectorAll('#eDaysWrap [data-day]').forEach(b => b.setAttribute('aria-pressed', String(days.includes(+b.dataset.day))));
  const getDays = () => [...document.querySelectorAll('#eDaysWrap [data-day][aria-pressed="true"]')].map(b => +b.dataset.day).sort();
  document.querySelectorAll('#eDaysWrap [data-day]').forEach((b, i) => {
    if (EN) { b.textContent = 'MTWTFSS'[i]; b.setAttribute('aria-label', DAYS_EN[+b.dataset.day]); }
    b.addEventListener('click', () => b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true')));
  });
  function openEdit(r) {
    editing = r;
    $('eTask').value = r.text;
    $('eInterval').querySelectorAll('option[data-recur]').forEach(o => o.remove());
    setDays([1, 2, 3, 4, 5]);
    if (r.recur && r.recur.kind !== 'monthly') {
      // todos os dias / dias da semana: escolhe-se nos botões
      $('eInterval').value = 'days';
      setDays(r.recur.kind === 'daily' ? [0, 1, 2, 3, 4, 5, 6] : r.recur.days);
      $('eStart').value = recurTime(r.recur);
      $('eEnd').value = r.recur.every ? recurUntil(r.recur) : ''; $('eDeadline').checked = false;
      syncEditFields();
      $('editDlg').showModal();
      return;
    }
    if (r.recur) {
      const o = document.createElement('option'); o.value = 'recur'; o.dataset.recur = '1'; o.textContent = cap(recurLabel(r.recur));
      $('eInterval').appendChild(o); $('eInterval').value = 'recur';
      $('eStart').value = recurTime(r.recur);
      $('eEnd').value = ''; $('eDeadline').checked = false;
      syncEditFields();
      $('editDlg').showModal();
      return;
    }
    $('eInterval').value = r.once ? '0' : String(r.interval);
    if (!$('eInterval').value) {
      const o = document.createElement('option'); o.value = r.interval; o.textContent = L('De ' + r.interval + ' em ' + r.interval + ' min', 'Every ' + r.interval + ' min');
      $('eInterval').appendChild(o); $('eInterval').value = String(r.interval);
    }
    const at0 = r.snoozeAt && r.snoozeAt > Date.now() ? r.snoozeAt : (nextEvent(r) || { at: r.firstAt }).at;
    $('eStart').value = toTimeInput(at0);
    $('eDate').value = toDateInput(Math.max(at0, Date.now()));
    $('eDate').min = toDateInput(Date.now());
    $('eEnd').value = r.end ? toTimeInput(r.end) : '';
    $('eDeadline').checked = !!r.hasDeadline;
    syncEditFields();
    $('editDlg').showModal();
  }
  function syncEditFields() {
    const v = $('eInterval').value, days = v === 'days';
    const every = days && editing && editing.recur && editing.recur.every; // «de hora a hora, de segunda a sexta»
    const once = v === '0' || v === 'recur' || days;
    $('eEndWrap').style.visibility = once && !every ? 'hidden' : 'visible';
    $('eDeadline').closest('label').hidden = once;
    $('eStartLabel').textContent = every ? L('Das', 'From') : once ? L('Hora do aviso', 'Reminder time') : L('Próximo aviso', 'Next reminder');
    $('eDateWrap').hidden = v === 'recur' || days;
    $('eDaysWrap').hidden = !days;
  }
  function saveEdit() {
    const r = editing; if (!r) return;
    if ($('eInterval').value === 'days') {
      const days = getDays().length ? getDays() : [0, 1, 2, 3, 4, 5, 6];
      const [h, m] = ($('eStart').value || '09:00').split(':').map(Number);
      const rc = days.length === 7 ? { kind: 'daily', h: h || 0, m: m || 0 } : { kind: 'weekly', days, h: h || 0, m: m || 0 };
      if (r.recur && r.recur.every) {
        rc.every = r.recur.every;
        const [uh, um] = ($('eEnd').value || recurUntil(r.recur)).split(':').map(Number);
        rc.until = { h: uh || 0, m: um || 0 };
        if (rc.until.h * 60 + rc.until.m <= rc.h * 60 + rc.m) rc.until = { h: 23, m: 0 };
      }
      if (r.cal) { calMarkDone(r); delete r.cal; delete r.calAts; }
      r.recur = rc; r.text = $('eTask').value.trim() || r.text;
      r.once = false; r.interval = null; r.end = null; r.hasDeadline = false;
      r.snoozeAt = null; r.quietUntil = null; r.done = false;
      r.lastAt = Date.now();
      r.firstAt = LembreteParser.nextRecur(rc, Date.now())[0];
      save(); render(); toast(L('Guardado', 'Saved'));
      return;
    }
    if (r.recur && $('eInterval').value === 'recur') {
      const [h, m] = $('eStart').value.split(':').map(Number);
      r.text = $('eTask').value.trim() || r.text;
      if (!isNaN(h)) { r.recur.h = h; r.recur.m = m || 0; }
      r.lastAt = Date.now(); r.snoozeAt = null;
      r.firstAt = LembreteParser.nextRecur(r.recur, Date.now())[0];
      save(); render(); toast(L('Guardado', 'Saved'));
      return;
    }
    if (r.recur) r.recur = null; // passou a «uma vez» / «de X em X»
    const interval = parseFloat($('eInterval').value);
    // o dia escolhido (ou, se faltar, o dia que já tinha)
    const dv = $('eDate').value;
    const ref = dv ? new Date(dv.split('-').map(Number)[0], dv.split('-').map(Number)[1] - 1, dv.split('-').map(Number)[2]).getTime()
                   : (r.once ? r.firstAt : (r.end || r.firstAt));
    let start = fromTimeInput($('eStart').value, ref);
    while (start < Date.now() - MIN) start += 864e5; // dia ou hora que já passou: o próximo possível
    if (r.cal) { calMarkDone(r); delete r.cal; delete r.calAts; } // editado à mão: deixa de vir do calendário
    r.text = $('eTask').value.trim() || r.text;
    r.once = interval === 0;
    r.interval = r.once ? null : interval;
    r.firstAt = start;
    r.snoozeAt = null; r.quietUntil = null;
    r.lastAt = Math.min(Date.now(), start - 1);
    if (r.once) { r.end = null; r.hasDeadline = false; }
    else {
      let end = $('eEnd').value ? fromTimeInput($('eEnd').value, start) : start + 6 * 3600e3;
      if (end <= start) end += 864e5;
      r.end = end;
      r.hasDeadline = $('eDeadline').checked && !!$('eEnd').value;
    }
    r.done = false;
    save(); render();
    toast(L('Guardado', 'Saved'));
  }

  // ---------- definições ----------
  // Na app: vozes do Android (as "naturais" usam internet; sem rede, a app usa uma do telemóvel)
  function fillNativeVoices() {
    let list = [];
    try { list = JSON.parse(NATIVE.voices() || '[]'); } catch (e) {}
    list = list.filter(v => v.installed !== false && (EN ? /^(en|eng)/i.test(v.lang || 'en') : true));
    list.sort((a, b) => (b.country === 'PT') - (a.country === 'PT') || (b.network - a.network) || (b.quality - a.quality) || a.name.localeCompare(b.name));
    const count = {};
    const opts = list.map(v => {
      const c = EN ? ({ GB: 'UK', US: 'US', AU: 'Australia', IN: 'India', IE: 'Ireland', CA: 'Canada', ZA: 'South Africa' }[v.country] || v.country || 'English')
                   : v.country === 'PT' ? 'Portugal' : v.country === 'BR' ? 'Brasil' : (v.country || 'Português');
      count[c] = (count[c] || 0) + 1;
      const tag = v.network ? L(' · natural (usa internet)', ' · natural (uses internet)') : v.quality >= 400 ? L(' · alta qualidade', ' · high quality') : '';
      return `<option value="${esc(v.name)}">${L('Voz', 'Voice')} ${count[c]} · ${c}${tag}</option>`;
    });
    $('sVoice').innerHTML = '<option value="">' + L('Automática (a do sistema)', 'Automatic (system voice)') + '</option>' + opts.join('');
    $('sVoice').value = settings.nativeVoice || '';
    if ($('sVoice').value !== (settings.nativeVoice || '')) $('sVoice').value = '';
  }
  function fillVoiceSelect() {
    if (NATIVE) return fillNativeVoices();
    const sel = $('sVoice');
    if (!voices.length) { sel.innerHTML = '<option value="">' + L('Voz do sistema', 'System voice') + '</option>'; return; }
    sel.innerHTML = voices.map(v => `<option value="${esc(v.voiceURI)}">${esc(v.name)} (${esc(v.lang)})</option>`).join('');
    sel.value = (pickVoice() || {}).voiceURI || '';
  }
  function openSettings() {
    $('sName').value = settings.name;
    $('sRate').value = settings.rate; $('sRateOut').textContent = settings.rate.toFixed(2) + '×';
    $('sRepeat').value = String(settings.repeat);
    $('sChime').checked = settings.chime;
    $('sListen').checked = settings.listenAfter;
    $('sLockAlert').checked = settings.lockAlert;
    $('sQuiet').checked = !!settings.quietOn;
    $('sQuietFrom').value = settings.quietFrom || '23:00';
    $('sQuietTo').value = settings.quietTo || '08:00';
    $('sQuietTimes').hidden = !settings.quietOn;
    $('sAlarm').checked = settings.alarmVolume;
    $('sMom').checked = !!settings.momMode;
    $('sListen').disabled = !CAN_LISTEN;
    fillVoiceSelect();
    renderCalSettings();
    $('appVersion').textContent = NATIVE && NATIVE.version ? L('versão ', 'version ') + NATIVE.version() : L('versão web', 'web version');
    $('settingsDlg').showModal();
    if (NATIVE) {
      showDiag();
      clearInterval(diagTimer);
      diagTimer = setInterval(() => { if ($('settingsDlg').open) showDiag(); else clearInterval(diagTimer); }, 2000);
    }
  }
  let diagTimer = null;
  function showDiag() {
    let d = {};
    try { d = JSON.parse(NATIVE.diag()); } catch (e) {}
    const st = d.status || {};
    const yn = (v) => v ? '✅' : '❌';
    $('diagInfo').innerHTML = esc(d.device || '') + '<br>' +
      yn(st.notifications) + L(' notificações · ', ' notifications · ') + yn(st.exact) + L(' alarmes exatos · ', ' exact alarms · ') + yn(st.battery) + L(' sem poupança de bateria · ', ' no battery saving · ') + yn(st.tts) + L(' voz<br>', ' voice<br>') +
      L('Avisos marcados no Android: <b>', 'Reminders scheduled on Android: <b>') + (d.events || 0) + '</b>' + (d.next ? L(' · próximo às <b>', ' · next at <b>') + esc(d.next) + '</b>' : '');
    const lines = (d.log || []).slice().reverse();
    $('diagLog').textContent = lines.length ? lines.join('\n') : L('Ainda sem registos.', 'No entries yet.');
  }
  function readSettings() {
    settings.name = $('sName').value.trim();
    if (NATIVE) settings.nativeVoice = $('sVoice').value; else settings.voiceURI = $('sVoice').value;
    settings.rate = parseFloat($('sRate').value);
    settings.repeat = parseInt($('sRepeat').value, 10);
    settings.chime = $('sChime').checked;
    settings.listenAfter = $('sListen').checked;
    settings.lockAlert = $('sLockAlert').checked;
    settings.quietOn = $('sQuiet').checked;
    settings.quietFrom = $('sQuietFrom').value || '23:00';
    settings.quietTo = $('sQuietTo').value || '08:00';
    $('sQuietTimes').hidden = !settings.quietOn;
    settings.alarmVolume = $('sAlarm').checked;
    settings.momMode = $('sMom').checked;
    saveSettings();
    render(); // as horas de silêncio mudam os próximos avisos
  }

  // ---------- eventos ----------
  $('mic').addEventListener('click', onMic);
  $('typeForm').addEventListener('submit', (e) => {
    e.preventDefault(); unlock();
    const v = $('typeInput').value; $('typeInput').value = '';
    $('transcript').textContent = '';
    handleInput(v, { typed: true });
  });
  function setTyping(on) {
    $('typeForm').hidden = !on;
    $('typeToggle').setAttribute('aria-expanded', String(on));
    if (on) setTimeout(() => $('typeInput').focus(), 30);
  }
  $('typeToggle').addEventListener('click', () => setTyping($('typeForm').hidden));
  $('readAll').addEventListener('click', () => { unlock(); readList(); });
  document.querySelectorAll('[data-example]').forEach(b => b.addEventListener('click', () => {
    setTyping(true);
    $('typeInput').value = b.dataset.example;
  }));
  $('unlock').addEventListener('click', () => { unlock(); speak('Som ligado. Estou aqui para te lembrar.'); });
  document.addEventListener('pointerdown', unlock, { capture: true });
  document.addEventListener('keydown', unlock, { capture: true });

  $('list').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]'); if (!b) return;
    const r = reminders.find(x => x.id === b.closest('[data-id]').dataset.id); if (!r) return;
    if (b.dataset.act === 'done') {
      const li = b.closest('.item');
      li.classList.add('completing');
      setTimeout(() => markDone(r, true), 380);
    }
    else if (b.dataset.act === 'edit') openEdit(r);
    else if (b.dataset.act === 'say') speak(message(r, 'regular'));
  });
  $('doneList').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]'); if (!b) return;
    const r = reminders.find(x => x.id === b.closest('[data-id]').dataset.id); if (!r) return;
    if (b.dataset.act === 'undo') { r.done = false; r.lastAt = Date.now(); save(); render(); }
    else if (b.dataset.act === 'delete') removeReminder(r);
  });
  $('dndCancel').addEventListener('click', () => stopDnd(false));
  $('clearDone').addEventListener('click', () => { reminders = reminders.filter(r => !r.done); save(); render(); });

  $('alert').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-alert]'); if (!b) return;
    const a = b.dataset.alert;
    const rid = $('alert').dataset.rid;
    const r = (current && current.r) || reminders.find(x => x.id === rid);
    const kind = (current && current.kind) || $('alert').dataset.kind || 'regular';
    nativeLog('Botão do aviso: ' + a + (r ? '' : ' (lembrete não encontrado)'));
    cancelSpeech();   // na app, isto também cala a voz do alarme
    stopListening();
    if (!r || a === 'close') { hideAlert(); return; }
    if (a === 'done-item') { const x = reminders.find(y => y.id === b.dataset.rid); if (x) markDone(x, true); return; }
    const grp = groupNow();
    if (grp) {
      if (a === 'done') doneAll(grp);
      else if (a === 'snooze10') snoozeAll(grp, 10);
      else if (a === 'snooze30') snoozeAll(grp, 30);
      else if (a === 'repeat') speak(groupMessage(grp));
      return;
    }
    if (a === 'done') markDone(r, true);
    else if (a === 'snooze10') snooze(r, 10, true);
    else if (a === 'snooze30') snooze(r, 30, true);
    else if (a === 'repeat') { current = { r, kind }; speak(message(r, kind)); }
  });

  $('eInterval').addEventListener('change', syncEditFields);
  $('editForm').addEventListener('submit', (e) => { if (e.submitter && e.submitter.value === 'save') saveEdit(); });
  $('eCancel').addEventListener('click', () => $('editDlg').close());
  $('eDelete').addEventListener('click', () => {
    if (editing) { removeReminder(editing); alertRemove(editing); }
    $('editDlg').close();
  });

  $('openSettings').addEventListener('click', openSettings);
  $('settingsForm').addEventListener('input', (e) => {
    if (e.target.id === 'sRate') $('sRateOut').textContent = parseFloat(e.target.value).toFixed(2) + '×';
  });
  $('settingsForm').addEventListener('change', readSettings);
  $('sMom').addEventListener('change', () => {
    readSettings(); unlock(); render();
    if (settings.momMode) speak(message({ text: L('Pagar a conta da luz', 'Pay the electricity bill'), hasDeadline: true, end: Date.now() + 55 * MIN }, 'regular'));
    else speak(L('Modo mãe desligado.', 'Mom mode off.'));
  });
  $('settingsDlg').addEventListener('close', readSettings);
  // X no topo das caixas: faz o mesmo que «Cancelar» / «Agora não» / fechar
  document.querySelectorAll('.dlg-x').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.x === 'close') b.closest('dialog').close(); else $(b.dataset.x).click();
  }));
  $('sTest').addEventListener('click', () => {
    readSettings(); unlock();
    speak(message({ text: L('Pagar a conta da luz', 'Pay the electricity bill'), hasDeadline: true, end: Date.now() + 130 * MIN }, 'regular'));
  });

  $('keepAwake').addEventListener('click', () => setAwake(!wantAwake));
  $('enableNotif').addEventListener('click', async () => {
    try { await Notification.requestPermission(); } catch (e) {}
    updateNotifButton();
  });

  // ---------- ligação à app Android ----------
  // escreve no registo do Diagnóstico (só na app)
  function nativeLog(msg) { try { if (NATIVE && NATIVE.log) NATIVE.log(String(msg).slice(0, 200)); } catch (e) {} }
  window.addEventListener('error', (e) => nativeLog('Erro na interface: ' + e.message + ' (' + (e.lineno || '?') + ')'));
  window.addEventListener('unhandledrejection', (e) => nativeLog('Erro na interface: ' + ((e.reason && e.reason.message) || e.reason)));
  let syncTimer = null;
  // ---------- calendário (Android) ----------
  const hmToMin = (v) => { const [h, m] = String(v || '09:00').split(':').map(Number); return (h || 0) * 60 + (m || 0); };
  const calBegin = (rid) => Number(String(rid).split(':')[2]) || 0;
  function calMarkDone(r) {
    const now = Date.now();
    settings.calDone = (settings.calDone || []).filter(id => calBegin(id) > now);
    if (!settings.calDone.includes(r.id)) settings.calDone.push(r.id);
    saveSettings();
  }
  // Traz os avisos do calendário (lidos pelo Android) para a lista
  function syncCalendar() {
    if (!NATIVE || !NATIVE.calendarItems) return;
    let items = [];
    if (settings.calOn) { try { items = JSON.parse(NATIVE.calendarItems() || '[]'); } catch (e) {} }
    const now = Date.now(), seen = new Set();
    let changed = false;
    items.forEach(it => {
      if (!it.ats) it.ats = [];
      seen.add(it.rid);
      let r = reminders.find(x => x.id === it.rid);
      if (!r) {
        r = { id: it.rid, createdAt: now, lastAt: 0, done: false, once: true, interval: null, end: null, hasDeadline: false };
        reminders.push(r); changed = true;
      }
      const ats = it.ats.map(a => ({ at: a.at, say: a.say })).sort((x, y) => x.at - y.at);
      if (r.text !== it.title || JSON.stringify(r.calAts) !== JSON.stringify(ats)) {
        r.text = it.title; r.calAts = ats; r.cal = { begin: it.begin }; r.firstAt = ats.length ? ats[0].at : it.begin; changed = true;
      }
    });
    // apagado ou mudado no calendário, calendário desligado, ou o evento já passou
    const before = reminders.length;
    reminders = reminders.filter(r => {
      if (!r.cal || seen.has(r.id)) return true;
      if (r.done) return r.cal.begin > now - 7 * 864e5;
      return false; // apagado ou mudado no calendário, ou calendário desligado
    });
    if (changed || reminders.length !== before) { save(); render(); }
  }
  function renderCalSettings() {
    const wrap = $('sCalWrap');
    if (!NATIVE || !NATIVE.calendars) { wrap.hidden = true; return; }
    wrap.hidden = false;
    $('sCal').checked = !!settings.calOn;
    $('sCalBody').hidden = !settings.calOn;
    if (!settings.calOn) return;
    let st = {};
    try { st = JSON.parse(NATIVE.status()); } catch (e) {}
    $('sCalPerm').hidden = !!st.calendar;
    let cals = [];
    if (st.calendar) { try { cals = JSON.parse(NATIVE.calendars() || '[]'); } catch (e) {} }
    // primeira vez: escolhe os calendários principais das contas (os outros ficam à escolha)
    if (settings.calIds == null && cals.length) { settings.calIds = cals.filter(c => c.name === c.account).map(c => c.id); saveSettings(); }
    const ids = settings.calIds || [];
    let html = '', acc = null;
    cals.forEach(c => {
      if (c.account !== acc) { acc = c.account; html += '<p class="cal-acc">' + esc(acc) + '</p>'; }
      const nm = c.name === c.account ? L('Calendário principal', 'Main calendar') : c.name;
      html += '<label class="cal-item"><input type="checkbox" data-cal="' + c.id + '"' + (ids.includes(c.id) ? ' checked' : '') + '>'
        + '<i style="background:' + esc(c.color) + '"></i><span>' + esc(nm) + '</span></label>';
    });
    let n = 0;
    if (st.calendar) { try { n = JSON.parse(NATIVE.calendarItems() || '[]').length; } catch (e) {} }
    $('sCalCount').textContent = !st.calendar ? '' : !ids.length ? L('Escolhe pelo menos um calendário.', 'Pick at least one calendar.')
      : !(settings.calLeads || []).length ? L('Escolhe quando queres ser avisado.', 'Choose when to be reminded.')
      : n ? L('✓ A ler o calendário: ' + n + (n === 1 ? ' evento' : ' eventos') + ' com hora nos próximos 5 dias.', '✓ Reading your calendar: ' + n + (n === 1 ? ' event' : ' events') + ' with a time in the next 5 days.')
      : L('✓ A ler o calendário: sem eventos com hora nos próximos 5 dias.', '✓ Reading your calendar: no events with a time in the next 5 days.');
    $('sCalList').innerHTML = html || (st.calendar ? '<p class="quiet-hint">' + L('Não encontrei calendários neste telemóvel.', 'No calendars found on this phone.') + '</p>' : '');
    document.querySelectorAll('#sCalLeads input').forEach(i => { i.checked = (settings.calLeads || []).includes(i.dataset.lead); });
    $('sCalHour').value = settings.calHour || '09:00';
    $('sCalHourWrap').hidden = !(settings.calLeads || []).some(l => /d$/.test(l));
  }
  function readCalSettings() {
    settings.calOn = $('sCal').checked;
    const list = [...document.querySelectorAll('#sCalList input')];
    if (list.length) settings.calIds = list.filter(i => i.checked).map(i => Number(i.dataset.cal));
    settings.calLeads = [...document.querySelectorAll('#sCalLeads input:checked')].map(i => i.dataset.lead);
    settings.calHour = $('sCalHour').value || '09:00';
    saveSettings();
    setTimeout(syncCalendar, 400); // o Android lê o calendário com as escolhas novas
  }
  if ($('sCalWrap')) {
    $('sCal').addEventListener('change', () => {
      settings.calOn = $('sCal').checked; saveSettings();
      if (settings.calOn && NATIVE && NATIVE.requestCalendar) NATIVE.requestCalendar();
      renderCalSettings(); setTimeout(syncCalendar, 400);
    });
    $('sCalGrant').addEventListener('click', () => NATIVE && NATIVE.requestCalendar && NATIVE.requestCalendar());
    $('sCalBody').addEventListener('change', (e) => {
      if (e.target.id === 'sCal') return;
      readCalSettings();
      setTimeout(renderCalSettings, 500);
      $('sCalHourWrap').hidden = !(settings.calLeads || []).some(l => /d$/.test(l));
    });
  }

  // ---------- cópia de segurança (para mudar de telemóvel) ----------
  function backupData() {
    const st = Object.assign({}, settings);
    delete st.calIds; delete st.calDone; delete st.dnd; // são deste telemóvel
    return JSON.stringify({ app: 'mamly', v: 1, at: Date.now(), reminders: reminders.filter(r => !r.cal), settings: st });
  }
  function saveBackup() {
    const name = 'mamly-copia-' + toDateInput(Date.now()) + '.json';
    if (NATIVE && NATIVE.saveBackup) { NATIVE.saveBackup(backupData(), name); return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([backupData()], { type: 'application/json' }));
    a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
    toast(L('Cópia guardada nas transferências.', 'Backup saved to your downloads.'));
  }
  function openBackup() {
    if (NATIVE && NATIVE.openBackup) { NATIVE.openBackup(); return; }
    $('backupFile').value = ''; $('backupFile').click();
  }
  function restoreBackup(text) {
    if (!text) return;
    let d = null;
    try { d = JSON.parse(text); } catch (e) {}
    if (!d || d.app !== 'mamly' || !Array.isArray(d.reminders)) { toast(L('Este ficheiro não é uma cópia do Mamly.', "This file isn't a Mamly backup.")); return; }
    const list = d.reminders.filter(r => r && typeof r.id === 'string' && typeof r.text === 'string' && typeof r.firstAt === 'number' && !r.cal)
      .map(r => Object.assign({}, r, { recur: r.recur ? validRecur(r.recur) : null }));
    const open = list.filter(r => !r.done).length;
    const when = d.at ? new Date(d.at).toLocaleDateString(L('pt-PT', 'en-GB'), { day: 'numeric', month: 'long' }) : '';
    toast(L('Cópia' + (when ? ' de ' + when : '') + ' com ' + open + ' lembretes. Substituir os que tens agora?', 'Backup' + (when ? ' from ' + when : '') + ' with ' + open + ' reminders. Replace the ones you have now?'), [
      { label: L('Restaurar', 'Restore'), fn: () => {
        reminders = list.concat(reminders.filter(r => r.cal));
        if (d.settings && typeof d.settings === 'object') {
          const keep = { calOn: settings.calOn, calIds: settings.calIds, calDone: settings.calDone, dnd: settings.dnd, onboarded: true };
          Object.keys(d.settings).forEach(k => { if (k in settings || k === 'onboarded') settings[k] = d.settings[k]; });
          Object.assign(settings, keep);
        }
        saveSettings(); save(); render();
        if ($('settingsDlg').open) openSettings();
        toast(L('Pronto! Recuperei ' + open + ' lembretes.', 'Done! Restored ' + open + ' reminders.'));
        speak(L('Pronto, recuperei os teus lembretes.', 'Done, I restored your reminders.'));
      } },
      { label: L('Cancelar', 'Cancel'), fn: () => {} },
    ], 20000);
  }
  $('backupSave').addEventListener('click', saveBackup);
  $('backupOpen').addEventListener('click', openBackup);
  $('backupFile').addEventListener('change', () => {
    const f = $('backupFile').files[0]; if (!f) return;
    const rd = new FileReader(); rd.onload = () => restoreBackup(String(rd.result || '')); rd.readAsText(f);
  });

  function syncNative() {
    if (!NATIVE) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      const now = Date.now();
      const events = [];
      reminders.filter(r => !r.done).forEach(r => {
        pending(r).filter(e => e.at > now && !(r.cal && e.kind !== 'snooze')).slice(0, 60).forEach(e => events.push({
          rid: r.id, at: e.at, kind: e.kind, task: r.text, end: r.end || 0, hasDeadline: !!r.hasDeadline,
          say: r.say ? withName(r.say) : '',
        }));
      });
      NATIVE.sync(JSON.stringify({
        events,
        settings: { name: settings.name, rate: settings.rate, repeat: settings.repeat, chime: settings.chime, alarmVolume: settings.alarmVolume, voiceName: settings.nativeVoice || '', momMode: !!settings.momMode, lang: LANG, lockAlert: settings.lockAlert !== false,
          calOn: !!settings.calOn, calIds: settings.calIds || [], calLeads: settings.calLeads || [], calHour: hmToMin(settings.calHour || '09:00'), calDone: settings.calDone || [] },
      }));
    }, 200);
  }
  function applyNativeActions() {
    let list = [];
    try { list = JSON.parse(NATIVE.takeActions() || '[]'); } catch (e) {}
    if (!list.length) return;
    list.forEach(a => {
      const r = reminders.find(x => x.id === a.rid);
      if (!r) return;
      if (a.type === 'done') {
        if (r.recur) { r.lastAt = Math.max(r.lastAt || 0, a.at || Date.now()); r.snoozeAt = null; r.lastDoneAt = a.at || Date.now(); }
        else { r.done = true; r.doneAt = a.at || Date.now(); }
        if (r.cal) calMarkDone(r);
      }
      else if (a.type === 'snooze') { r.snoozeAt = a.until; r.quietUntil = a.until; r.lastAt = Math.max(r.lastAt || 0, Date.now()); }
      alertRemove(r);
    });
    save(); render();
  }
  function updateNativeNotice() {
    let st = {};
    try { st = JSON.parse(NATIVE.status()); } catch (e) {}
    if (st.noPortuguese) {
      $('noticeText').innerHTML = EN
        ? "<b>Your phone has no English voice.</b> Reminders still ring and show up, but the voice stays quiet (so it doesn't speak another language). "
          + (st.googleTts ? 'Install an <b>English</b> voice and choose <b>Google</b> as the speech engine.' : 'Install <b>Speech Services by Google</b> and then an <b>English</b> voice.') + ' Then come back here.'
        : '<b>O teu telemóvel não tem voz em português.</b> Os avisos tocam e aparecem, mas a voz fica calada (para não falar noutra língua). '
          + (st.googleTts ? 'Instala a voz <b>Português (Portugal)</b> e escolhe <b>Google</b> como motor de voz.' : 'Instala os <b>Serviços de voz da Google</b> e depois a voz <b>Português (Portugal)</b>.')
          + ' Depois volta aqui.';
    } else {
      $('noticeText').innerHTML = st.battery && st.notifications && st.exact
        ? L('<b>Tudo pronto.</b> Os avisos tocam e falam mesmo com o ecrã desligado.', '<b>All set.</b> Reminders ring and speak even with the screen off.')
        : L('<b>Falta um passo</b> para os avisos tocarem com o ecrã desligado:', '<b>One more step</b> so reminders ring with the screen off:');
    }
    $('fixVoice').hidden = !st.noPortuguese;
    $('fixVoiceSettings').hidden = !st.noPortuguese;
    $('fixBattery').hidden = !!st.battery;
    $('fixNotif').hidden = !!st.notifications;
    $('fixAlarm').hidden = !!st.exact;
    $('fixFullScreen').hidden = st.fullScreen !== false || !settings.lockAlert || !settings.listenAfter;
  }
  // O último aviso que tocou no Android: mostra-o e, quando a voz acabar, ouve a resposta
  // (funciona também quando a app abriu por cima do ecrã de bloqueio, depois de o aviso tocar).
  let alertHandled = '', alertPoll = 0;
  function checkNativeAlert() {
    clearTimeout(alertPoll);
    if (!NATIVE || !NATIVE.alertState) return;
    let a = null;
    try { a = JSON.parse(NATIVE.alertState() || 'null'); } catch (e) {}
    if (!a || !a.rid) return;
    const ids = a.rids && a.rids.length ? a.rids : [a.rid];
    const kinds = a.kinds || [];
    const items = ids.map((id, i) => ({ r: reminders.find(x => x.id === id && !x.done), kind: kinds[i] || a.kind })).filter(x => x.r);
    if (!items.length) return;
    const key = ids.join(',') + '@' + a.at;
    if (alertHandled === key) return;
    const r = items[0].r;
    if (items.length > 1) {
      const same = current && current.group && current.group.map(x => x.r.id).join() === items.map(x => x.r.id).join();
      if (!same) { current = { r, kind: items[0].kind, group: items }; showGroupAlert(items); }
    } else if (!current || current.r !== r || current.group) { current = { r, kind: items[0].kind }; showAlert(r, items[0].kind); }
    if (!a.spoken) { alertPoll = setTimeout(checkNativeAlert, 600); return; }
    if (!settings.listenAfter) { alertHandled = key; return; }
    if (document.hidden) { nativeLog('Aviso com a app escondida: espero que abra para ouvir'); return; } // ouve quando a app aparecer (onResume)
    alertHandled = key;
    listenForAnswer(r);
  }
  if (NATIVE) {
    window.__native = {
      onSpeakDone(tok) { const f = nativeWaiters[tok]; if (f) { delete nativeWaiters[tok]; f(); } },
      onListen(text, err) {
        const f = nativeListen; nativeListen = null;
        if (!f) return;
        if (!text && err) f.reject(new Error(err)); else f.resolve(text || '');
      },
      onBackupSaved(st) {
        if (st === 'ok') toast(L('Cópia guardada. No telemóvel novo, abre o Mamly → Definições → Restaurar.', 'Backup saved. On your new phone, open Mamly → Settings → Restore.'));
        else if (st === 'error') toast(L('Não consegui guardar a cópia. Tenta outro sítio.', "Couldn't save the backup. Try another place."));
      },
      onBackupOpened(text) { restoreBackup(text); },
      onPartial(text) { if (nativeListen && nativeListen.onInterim) nativeListen.onInterim(text); },
      onFired(id, kind, at) {
        delete nativeWatch[id];
        const r = reminders.find(x => x.id === id);
        if (!r) return;
        // o Android pode juntar um aviso que ia tocar daqui a pouco: conta esse, não o de agora
        r.lastAt = Math.max(r.lastAt || 0, Number(at) || 0, Date.now() - 1000);
        if (kind === 'snooze') r.snoozeAt = null;
        save(); render();
        if (NATIVE.alertState) checkNativeAlert();
        else { current = { r, kind }; showAlert(r, kind); }
      },
      onSpoken() { checkNativeAlert(); },
      onActions() { applyNativeActions(); },
      onResume() { applyNativeActions(); syncCalendar(); tick(); syncNative(); updateNativeNotice(); checkNativeAlert(); updateWelcomePerms(); if ($('settingsDlg').open) renderCalSettings(); },
      onSharedLink() { checkIncomingLink(); },
      onVoiceReady() { updateNativeNotice(); if (settings.nativeVoice) NATIVE.setVoice(settings.nativeVoice); },
      // botão "voltar" do Android: fecha o que estiver aberto; devolve false se não havia nada para fechar
      onBack() { return closeTopLayer(); },
    };
    document.documentElement.classList.add('native');
    $('keepAwake').hidden = true;
    $('enableNotif').hidden = true;
    NATIVE.setVoice(settings.nativeVoice || '');
    // ao escolher uma voz, ouve logo como soa
    $('sVoice').addEventListener('change', () => {
      settings.nativeVoice = $('sVoice').value;
      NATIVE.setVoice(settings.nativeVoice);
      saveSettings();
      speak((settings.name ? L('Olá, ', 'Hi, ') + settings.name + '! ' : L('Olá! ', 'Hi! ')) + L('É assim que te vou lembrar das coisas.', "This is how I'll remind you of things."));
    });
    $('sAlarmWrap').hidden = false;
    $('sLockAlertWrap').hidden = false;
    $('sTestStandby').hidden = false;
    $('diagWrap').hidden = false;
    $('sTestNow').addEventListener('click', () => {
      NATIVE.testNow();
      toast(L('Daqui a 10 segundos deve falar. Podes desligar o ecrã.', 'It should speak in 10 seconds. You can turn the screen off.'));
      showDiag();
    });
    $('fixBattery').addEventListener('click', () => {
      toast(L('Toca em «Utilização da bateria» → «Sem restrições». Se vires «Permitir utilização em segundo plano», toca nas palavras (não no botão).', 'Tap “App battery usage” → “Unrestricted”. If you see “Allow background usage”, tap the words (not the switch).'), null, 9000);
      setTimeout(() => NATIVE.openBatterySettings(), 2500);
    });
    $('fixNotif').addEventListener('click', () => NATIVE.openNotificationSettings());
    $('fixAlarm').addEventListener('click', () => NATIVE.openAlarmSettings());
    $('fixFullScreen').addEventListener('click', () => {
      toast(L('Ativa «Permitir notificações em ecrã inteiro» para o Mamly.', 'Turn on “Allow full screen notifications” for Mamly.'));
      setTimeout(() => NATIVE.openFullScreenSettings && NATIVE.openFullScreenSettings(), 1200);
    });
    $('fixVoice').addEventListener('click', () => NATIVE.openVoiceInstall());
    $('fixVoiceSettings').addEventListener('click', () => NATIVE.openTtsSettings());
    $('sTestStandby').addEventListener('click', () => {
      readSettings();
      $('settingsDlg').close();
      const r = {
        id: Math.random().toString(36).slice(2, 10), text: L('Isto é um teste do Mamly', 'This is a Mamly test'), interval: null,
        firstAt: Date.now() + 60e3, end: null, once: true, hasDeadline: false, createdAt: Date.now(), lastAt: 0, done: false,
      };
      reminders.push(r); save(); render();
      speak(L('Desliga o ecrã agora. Daqui a um minuto vou falar.', "Turn the screen off now. I'll speak in one minute."));
    });
  }

  // ---------- partilhar lembretes por link ----------
  // O lembrete vai dentro do próprio link, depois do "#": essa parte nunca é enviada a nenhum servidor.
  const SHARE_BASE = 'https://mamly.app/add.html';
  const b64url = (str) => btoa(unescape(encodeURIComponent(str))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const unb64url = (str) => decodeURIComponent(escape(atob(str.replace(/-/g, '+').replace(/_/g, '/'))));
  function shareLink(r) {
    const data = { v: 1, t: r.text, i: r.interval || 0, o: r.once ? 1 : 0, f: r.firstAt, e: r.end || 0, d: r.hasDeadline ? 1 : 0, n: settings.name || '' };
    if (r.say) data.s = r.say;
    if (r.recur) data.rc = r.recur;
    return SHARE_BASE + '#r=' + b64url(JSON.stringify(data));
  }
  function validRecur(rc) {
    const v = validRecur0(rc);
    if (v && rc.every > 0 && rc.until) { v.every = Math.min(720, Math.max(1, +rc.every || 60)); v.until = { h: Math.min(23, Math.max(0, rc.until.h | 0)), m: Math.min(59, Math.max(0, rc.until.m | 0)) }; }
    return v;
  }
  function validRecur0(rc) {
    if (!rc || typeof rc !== 'object' || !['daily', 'weekly', 'monthly'].includes(rc.kind)) return null;
    const h = Math.min(23, Math.max(0, rc.h | 0)), m = Math.min(59, Math.max(0, rc.m | 0));
    if (rc.kind === 'weekly') { const days = (Array.isArray(rc.days) ? rc.days : []).map(x => x | 0).filter(x => x >= 0 && x <= 6); return days.length ? { kind: 'weekly', days, h, m } : null; }
    if (rc.kind === 'monthly') return { kind: 'monthly', dom: Math.min(31, Math.max(1, rc.dom | 0)), h, m };
    return { kind: 'daily', h, m };
  }
  function decodeShare(str) {
    try {
      const m = String(str).match(/[#?&]r=([A-Za-z0-9_-]+)/) || [null, str];
      const d = JSON.parse(unb64url(m[1]));
      if (!d || d.v !== 1 || typeof d.t !== 'string' || !d.t.trim()) return null;
      return {
        text: d.t.slice(0, 200), interval: d.i > 0 ? Math.max(10 / 60, Math.min(+d.i, 720)) : null, once: !!d.o,
        firstAt: +d.f || Date.now(), end: +d.e || null, hasDeadline: !!d.d, say: typeof d.s === 'string' ? d.s.slice(0, 200) : null,
        from: typeof d.n === 'string' ? d.n.slice(0, 40) : '',
        recur: validRecur(d.rc),
      };
    } catch (e) { return null; }
  }
  async function shareReminder(r) {
    const url = shareLink(r);
    const text = EN
      ? (settings.name ? settings.name + ' wants' : 'Someone wants') + ' to remind you: ' + r.text + ' (' + lowerFirst(describe(r)) + '). Tap to add it to Mamly 💛 ' + url
      : (settings.name ? settings.name + ' quer' : 'Querem') + ' lembrar-te de: ' + r.text + ' (' + lowerFirst(describe(r)) + '). Toca para adicionar ao Mamly 💛 ' + url;
    nativeLog('Partilhar lembrete');
    if (NATIVE && NATIVE.share) { NATIVE.share(text); return; }
    if (navigator.share) { try { await navigator.share({ text }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
    try { await navigator.clipboard.writeText(text); toast(L('Link copiado. Cola-o no WhatsApp ou numa mensagem.', 'Link copied. Paste it into WhatsApp or a message.')); }
    catch (e) { prompt(L('Copia este link e envia-o:', 'Copy this link and send it:'), url); }
  }

  let incoming = null;
  function showIncoming(sh) {
    if (!sh) return;
    const now = Date.now();
    // se o primeiro aviso já passou, avança para o próximo (ou avisa, se era só uma vez)
    let expired = false;
    if (sh.recur) sh.firstAt = LembreteParser.nextRecur(sh.recur, now)[0];
    else if (!sh.once && sh.interval) {
      const step = sh.interval * MIN;
      while (sh.firstAt <= now) sh.firstAt += step;
      if (sh.end && sh.firstAt >= sh.end && !sh.hasDeadline) expired = true;
      if (sh.hasDeadline && sh.end && sh.end <= now) expired = true;
    } else if (sh.once && sh.firstAt <= now) expired = true;
    incoming = sh;
    $('shareTitle').textContent = sh.from ? sh.from + L(' quer lembrar-te de', ' wants to remind you') : L('Recebeste um lembrete', 'You got a reminder');
    $('shareTask').textContent = sh.text;
    $('shareWhen').textContent = describe(Object.assign({}, sh, { interval: sh.interval || 60 }));
    $('shareNote').textContent = expired
      ? L('Atenção: a hora deste lembrete já passou. Se aceitares, podes ajustá-la a seguir.', "Heads up: this reminder's time has passed. If you accept, you can adjust it next.")
      : L('Se aceitares, o Mamly lembra-te disto como se o tivesses criado tu.', "If you accept, Mamly will remind you as if you'd created it yourself.");
    if (!$('shareDlg').open) $('shareDlg').showModal();
  }
  $('shareYes').addEventListener('click', async () => {
    const sh = incoming; incoming = null; $('shareDlg').close();
    if (!sh) return;
    const r = {
      id: Math.random().toString(36).slice(2, 10), text: sh.text, interval: sh.once ? null : (sh.interval || 60),
      firstAt: sh.firstAt, end: sh.once ? null : sh.end, once: sh.once, hasDeadline: sh.hasDeadline,
      createdAt: Date.now(), lastAt: 0, done: false, say: sh.say, sharedBy: sh.from || '', recur: sh.recur || null,
    };
    if (r.recur) { r.once = false; r.interval = null; r.end = null; r.hasDeadline = false; }
    if (r.once && r.firstAt <= Date.now()) r.firstAt = Date.now() + 5 * MIN;
    reminders.push(r); save(); render();
    unlock();
    await speak(EN
      ? (settings.momMode ? 'Okay, ' + momName() + '. ' : 'Okay. ') + (sh.from ? sh.from + ' asked me to remind you: ' : "I'll remind you: ") + lowerFirst(sh.text) + '.'
      : (settings.momMode ? 'Está bem, ' + momName() + '. ' : 'Combinado. ') + (sh.from ? sh.from + ' pediu-me para te lembrar: ' : 'Vou lembrar-te: ') + lowerFirst(sh.text) + '.');
    if (r.once && sh.firstAt <= Date.now()) openEdit(r);
  });
  $('shareNo').addEventListener('click', () => { incoming = null; $('shareDlg').close(); });
  $('eShare').addEventListener('click', () => { if (editing) shareReminder(editing); });
  // links recebidos: na versão web chegam no endereço (#r=…); na app Android, através do NATIVE
  function checkIncomingLink() {
    if (/[#&]r=/.test(location.hash)) {
      const sh = decodeShare(location.hash);
      history.replaceState(null, '', location.pathname + location.search);
      if (sh) showIncoming(sh); else toast(L('Este link de lembrete não está completo.', 'This reminder link is incomplete.'));
    }
    if (NATIVE && NATIVE.takeSharedLink) {
      const link = NATIVE.takeSharedLink();
      if (link) { const sh = decodeShare(link); if (sh) showIncoming(sh); else toast(L('Este link de lembrete não está completo.', 'This reminder link is incomplete.')); }
    }
  }
  window.addEventListener('hashchange', checkIncomingLink);

  // ---------- interface em inglês ----------
  // Os textos do index.html estão em português; em inglês trocamo-los ao arrancar (texto e atributos).
  const UI_EN = {
    'Toca aqui para ligar o som': 'Tap here to turn on sound',
    'O browser só deixa falar depois de um toque.': 'The browser only allows speech after a tap.',
    'Ecrã ligado': 'Screen on', 'A seguir': 'Up next', 'Hoje e a seguir': 'Today and next',
    'A tua cabeça fica livre.': 'Free your mind.',
    'Carrega no microfone e diz o que não te podes esquecer. Eu lembro-te em voz alta.': "Tap the microphone and say what you can't forget. I'll remind you out loud.",
    '“De 30 em 30 min, das 13h às 17h, pagar a luz”': '“Every 30 min, 1pm to 5pm, pay the electric bill”',
    '“Daqui a 20 min tirar a roupa”': '“In 20 minutes take out the laundry”',
    '“Amanhã às 9 ligar ao dentista”': '“Tomorrow at 9 call the dentist”',
    'Feitos': 'Done', 'Limpar feitos': 'Clear done',
    'Deixa esta página aberta.': 'Keep this page open.',
    'Os avisos tocam enquanto a página estiver aberta (pode estar noutro separador ou com o ecrã ligado). Se fechares o browser, não toca.': "Reminders ring while this page is open (another tab or with the screen on is fine). If you close the browser, it won't ring.",
    'Ativar notificações': 'Turn on notifications', 'Permitir funcionar em segundo plano': 'Allow running in the background',
    'Permitir alarmes': 'Allow alarms', 'Instalar voz portuguesa': 'Install an English voice', 'Definições de voz': 'Voice settings',
    'Fechar': 'Close', 'Agora': 'Now', 'Feito': 'Done', 'Repetir': 'Repeat', 'Escrever': 'Type', 'Toca e fala': 'Tap and talk', 'Ouvir': 'Listen',
    'Editar lembrete': 'Edit reminder', 'O que tens de fazer': 'What you need to do', 'Só uma vez': 'Just once',
    'De 30 em 30 segundos': 'Every 30 seconds', 'De minuto a minuto': 'Every minute', 'De 5 em 5 min': 'Every 5 min', 'De 10 em 10 min': 'Every 10 min',
    'De 15 em 15 min': 'Every 15 min', 'De meia em meia hora': 'Every half hour', 'De 45 em 45 min': 'Every 45 min', 'De hora a hora': 'Every hour',
    'De hora e meia em hora e meia': 'Every hour and a half', 'De 2 em 2 horas': 'Every 2 hours', 'De 3 em 3 horas': 'Every 3 hours',
    '💾 Cópia de segurança': '💾 Backup', 'Vais mudar de telemóvel? Guarda uma cópia dos teus lembretes e definições (por exemplo no Google Drive ou enviada para ti por email) e, no telemóvel novo, carrega em «Restaurar».': 'Changing phones? Save a copy of your reminders and settings (for example to Google Drive or emailed to yourself) and, on the new phone, tap “Restore”.', 'Guardar cópia': 'Save backup', 'Restaurar': 'Restore',
    'Dia': 'Day', 'Dias': 'Days', 'Em dias da semana': 'On days of the week', 'Das': 'From', 'Primeiro aviso': 'First reminder', 'Até às': 'Until', 'É um prazo (avisa 15 min antes e à hora limite)': "It's a deadline (reminds you 15 min before and at the time)",
    'Apagar': 'Delete', 'Partilhar': 'Share', 'Cancelar': 'Cancel', 'Guardar': 'Save',
    'Recebeste um lembrete': 'You got a reminder', 'Se aceitares, o Mamly lembra-te disto como se o tivesses criado tu.': "If you accept, Mamly will remind you as if you'd created it yourself.",
    'Agora não': 'Not now', 'Aceitar': 'Accept', 'Definições': 'Settings',
    'O teu nome (a voz chama-te pelo nome)': 'Your name (the voice calls you by name)', 'Voz (escolhe e ouve como soa)': 'Voice (pick one and hear it)',
    'Voz do sistema': 'System voice', 'Velocidade da voz': 'Voice speed', 'Quando não dizes de quanto em quanto tempo': "When you don't say how often",
    'Repetir a mensagem': 'Repeat the message', '1 vez': 'Once', '2 vezes': 'Twice', '3 vezes': '3 times',
    'Modo mãe 💛': 'Mom mode 💛', 'A voz fala como uma mãe carinhosa:': 'The voice talks like a caring mom:', 'Meu amor, não te esqueças…': "Sweetheart, don't forget…",
    'Tocar um sinal antes de falar': 'Play a chime before speaking',
    'Usar o volume do alarme (ouve-se mesmo com o telemóvel em silêncio)': 'Use alarm volume (heard even when the phone is on silent)',
    'Depois do aviso, ouvir a resposta (': 'After a reminder, listen for a reply (', 'feito': 'done', 'adia 15 minutos': 'snooze 15 minutes',
    'Diagnóstico': 'Diagnostics', 'Testar agora (fala daqui a 10 s)': 'Test now (speaks in 10 s)', 'Sobre e privacidade': 'About & privacy',
    'Os teus lembretes ficam guardados': 'Your reminders are stored', 'só neste telemóvel': 'only on this phone',
    '. A app não tem contas, não tem publicidade e não envia os teus lembretes para lado nenhum.': ". The app has no accounts, no ads, and doesn't send your reminders anywhere.",
    'Quando falas para o microfone, o áudio é transformado em texto pelo serviço de voz do Android (normalmente da Google), como num ditado normal. A voz que lê os avisos também é a do Android.': "When you speak into the microphone, the audio is turned into text by Android's speech service (usually Google's), like normal dictation. The voice reading reminders is also Android's.",
    'Se desinstalares a app, os lembretes são apagados.': 'If you uninstall the app, your reminders are deleted.',
    'Testar voz': 'Test voice', 'Olá! Eu sou o Mamly 💛': "Hi! I'm Mamly 💛", 'Dizes-me o que tens de fazer e eu lembro-te': 'Tell me what you need to do and I’ll remind you', 'em voz alta': 'out loud', ', à hora certa. E insisto até fazeres.': ', right on time. And I’ll keep at it until it’s done.', 'Como te chamas? (a voz chama-te pelo nome)': 'What’s your name? (the voice will call you by it)', 'Seguinte': 'Next', 'Fala comigo como falas com alguém': 'Talk to me like you’d talk to a friend', 'Toca no microfone e diz, por exemplo:': 'Tap the microphone and say, for example:', '«Daqui a 20 minutos tirar a roupa da máquina»': '“In 20 minutes take the laundry out”', '«Todos os dias às 9h tomar a medicação»': '“Every day at 9 take my meds”', '«De hora a hora até às 17h ir ao mecânico»': '“Every hour until 5pm go to the mechanic”', 'Quando o aviso tocar, podes responder': 'When a reminder rings, you can reply', '«feito»': '“done”', 'ou': 'or', '«adia 15 minutos»': '“snooze 15 minutes”', 'Para tocar com o ecrã desligado': 'To ring with the screen off', 'O Android precisa de algumas autorizações. Toca em cada uma, faz o que diz e volta aqui:': 'Android needs a few permissions. Tap each one, do what it says and come back:', 'Para veres os avisos. Toca em «Permitir».': 'So you can see reminders. Tap “Allow”.', 'Para tocar à hora certa. Liga «Permitir alarmes e lembretes».': 'So it rings on time. Turn on “Allow setting alarms and reminders”.', 'Para o Android não desligar o Mamly. Toca em «Utilização da bateria» (ou «Bateria») e escolhe «Sem restrições». Se aparecer «Permitir utilização em segundo plano», toca nessas palavras (não no botão) e escolhe «Sem restrições».': 'So Android doesn’t shut Mamly down. Tap “App battery usage” (or “Battery”) and choose “Unrestricted”. If you see “Allow background usage”, tap the words (not the switch) and choose “Unrestricted”.', 'Para falares os lembretes. Toca em «Permitir».': 'So you can speak your reminders. Tap “Allow”.', 'Notificações': 'Notifications', 'Alarmes e lembretes': 'Alarms & reminders', 'Funcionar em segundo plano': 'Run in the background', 'Microfone': 'Microphone', 'Começar': 'Start', 'Horas de silêncio': 'Quiet hours', '📅 Calendário': '📅 Calendar', '· Avisar dos eventos do teu calendário': '· Remind me of my calendar events', 'Para ler os teus calendários, o Mamly precisa de autorização.': 'To read your calendars, Mamly needs permission.', 'Dar acesso': 'Allow access', 'Calendários a seguir': 'Calendars to follow', 'Avisar': 'Remind me', '3 dias antes': '3 days before', '2 dias antes': '2 days before', '1 dia antes': '1 day before', '1 hora antes': '1 hour before', 'À hora do evento': 'At the event time', 'Avisos de dias antes, às': 'Day-before reminders at', 'Só eventos com hora. O Mamly só lê o calendário: não muda nada e nada sai do telemóvel.': 'Only events with a time. Mamly only reads your calendar: it changes nothing and nothing leaves your phone.', 'Para uma pausa, diz ao microfone: «não me incomodes das 15h às 16h» ou «durante 1 hora».': 'For a break, tell the mic: “don’t disturb me from 3 to 4pm” or “for 1 hour”.', 'Não incomodar': 'Do not disturb', '· Não repetir avisos de noite': "· Don't repeat reminders at night", 'Das': 'From', 'Os avisos com hora marcada (ex.: «às 7h», «todos os dias às 9h») tocam sempre.': 'Reminders set for a specific time (e.g. “at 7”, “every day at 9”) always ring.', 'Com o ecrã bloqueado, mostrar o aviso por cima (como um despertador), para poderes responder por voz': 'When the screen is locked, show the reminder on top (like an alarm clock) so you can reply by voice', 'Responder por voz com o ecrã bloqueado': 'Reply by voice with the screen locked', 'Testar com ecrã desligado': 'Test with screen off',
    'Língua': 'Language', 'Automática (a do telemóvel)': 'Automatic (phone language)', 'Contacto:': 'Contact:', 'Segue-nos no Instagram': 'Follow us on Instagram', 'Apoiantes do Mamly': 'Mamly supporters', 'Este espaço pode ser teu': 'This space could be yours', 'Queres apoiar o projeto? Fala connosco.': 'Want to support the project? Get in touch.',
    // atributos
    'Impede o ecrã de desligar enquanto a página está aberta': 'Keeps the screen on while the page is open',
    'De 30 em 30 minutos das 13h às 17h avisa-me para pagar a conta da luz': 'Every 30 minutes from 1pm to 5pm remind me to pay the electricity bill',
    'Daqui a 20 minutos tirar a roupa da máquina': 'In 20 minutes take out the laundry', 'Amanhã às 9 ligar ao dentista': 'Tomorrow at 9 call the dentist',
    'Fechar e voltar à lista': 'Close and go back to the list', 'Ex.: às 15h ligar à mãe': 'E.g. at 3pm call mom', 'Escrever lembrete': 'Type a reminder',
    'Adicionar': 'Add', 'Escrever em vez de falar': 'Type instead of talking', 'Falar um lembrete': 'Speak a reminder',
    'Ouvir o que tenho para fazer': 'Hear what I have to do', 'opcional': 'optional', 'Marcar como feito': 'Mark as done',
  };
  function translateUI() {
    if (!EN) return;
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) {
      const raw = n.nodeValue, key = raw.replace(/\s+/g, ' ').trim();
      if (key && UI_EN[key]) n.nodeValue = raw.replace(raw.trim(), UI_EN[key]);
    }
    document.querySelectorAll('[placeholder],[aria-label],[title],[data-example]').forEach(el => {
      ['placeholder', 'aria-label', 'title', 'data-example'].forEach(a => { const v = el.getAttribute(a); if (v && UI_EN[v]) el.setAttribute(a, UI_EN[v]); });
    });
  }
  translateUI();
  if (EN) { $('contactMail').href = 'mailto:hello@mamly.app'; $('contactMail').textContent = 'hello@mamly.app'; $('supportMail').href = 'mailto:hello@mamly.app?subject=Supporting%20Mamly'; }
  renderSupportWall();
  $('sLang').value = settings.lang || 'auto';
  $('sLang').addEventListener('change', () => {
    settings.lang = $('sLang').value; saveSettings();
    setTimeout(() => location.reload(), 150);   // a língua aplica-se ao recarregar
  });

  // ---------- arranque ----------
  if ('speechSynthesis' in window) {
    loadVoices();
    speechSynthesis.addEventListener ? speechSynthesis.addEventListener('voiceschanged', loadVoices) : (speechSynthesis.onvoiceschanged = loadVoices);
  }
  if (!CAN_LISTEN) {
    $('micLabel').textContent = L('Sem voz neste browser', 'No voice in this browser');
    setTyping(true);
    $('mic').disabled = true;
  }
  if (!NATIVE) {
    if (!('speechSynthesis' in window)) toast(L('Este browser não consegue falar. Usa o Chrome, o Edge ou o Safari.', "This browser can't speak. Use Chrome, Edge or Safari."));
    $('unlock').hidden = false;
    updateNotifButton();
  } else {
    applyNativeActions();
    syncCalendar();
    updateNativeNotice();
    checkNativeAlert();
  }

  const qs = new URLSearchParams(location.search);
  if (qs.get('action') && qs.get('id')) { handleExternalAction({ action: qs.get('action'), id: qs.get('id') }); history.replaceState(null, '', location.pathname); }

  // lembretes de dias anteriores já feitos: limpar automaticamente
  const cutoff = Date.now() - 2 * 864e5;
  reminders = reminders.filter(r => !(r.done && r.doneAt < cutoff));
  render();
  setInterval(tick, 1000);
  tick();
  syncNative();
  checkIncomingLink();

  // ---------- primeira abertura ----------
  let wStep = 1;
  function welcomeStep(n) {
    wStep = n;
    document.querySelectorAll('#welcomeDlg .w-step').forEach(el => { el.hidden = Number(el.dataset.step) !== n; });
    const steps = NATIVE ? 3 : 2;
    document.querySelectorAll('#welcomeDlg .w-dots i').forEach((d, i) => { d.hidden = i >= steps; d.classList.toggle('on', i === n - 1); });
    $('wNext2').textContent = NATIVE ? L('Seguinte', 'Next') : L('Começar', 'Start');
    if (n === 3) updateWelcomePerms();
  }
  function updateWelcomePerms() {
    if (!NATIVE || !$('welcomeDlg').open) return;
    let st = {};
    try { st = JSON.parse(NATIVE.status()); } catch (e) {}
    const ok = { notif: st.notifications, alarm: st.exact, battery: st.battery, mic: st.mic };
    document.querySelectorAll('#welcomeDlg .w-perm').forEach(b => {
      const v = ok[b.dataset.perm];
      b.classList.toggle('ok', !!v);
      b.hidden = v === undefined;
    });
  }
  function finishWelcome() {
    settings.name = $('wName').value.trim() || settings.name;
    settings.onboarded = true;
    saveSettings();
    if ($('welcomeDlg').open) $('welcomeDlg').close();
    render();
    unlock();
    speak((settings.name ? L('Olá, ', 'Hi, ') + settings.name + '! ' : L('Olá! ', 'Hi! ')) + L('Estou pronta. Toca no microfone e diz-me o que tens de fazer.', "I'm ready. Tap the microphone and tell me what you need to do."));
  }
  $('welcomeDlg').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.classList.contains('w-next')) {
      if (wStep === 1) { settings.name = $('wName').value.trim(); welcomeStep(2); }
      else if (wStep === 2) { if (NATIVE) welcomeStep(3); else finishWelcome(); }
    } else if (b.classList.contains('w-done')) finishWelcome();
    else if (b.dataset.perm && NATIVE) {
      const p = b.dataset.perm;
      if (p === 'notif') NATIVE.openNotificationSettings();
      else if (p === 'alarm') NATIVE.openAlarmSettings();
      else if (p === 'battery') { toast(L('Toca em «Utilização da bateria» → «Sem restrições». Se vires «Permitir utilização em segundo plano», toca nas palavras (não no botão).', 'Tap “App battery usage” → “Unrestricted”. If you see “Allow background usage”, tap the words (not the switch).'), null, 9000); setTimeout(() => NATIVE.openBatterySettings(), 2500); }
      else if (p === 'mic' && NATIVE.requestMic) NATIVE.requestMic();
    }
  });
  $('welcomeDlg').addEventListener('close', () => { if (!settings.onboarded) { settings.onboarded = true; saveSettings(); } });
  // aparece uma vez a quem ainda não a viu (também a quem já usava a app antes de haver introdução,
  // ou a quem o Android repôs os dados de uma cópia de segurança)
  if (!settings.onboarded && !location.hash.includes('r=')) {
    $('wName').value = settings.name || '';
    welcomeStep(1);
    $('welcomeDlg').showModal();
  }

  window.__lembretes = { shareLink, decodeShare, handleInput, get reminders() { return reminders; }, plan, message, confirmation, tick };
})();
