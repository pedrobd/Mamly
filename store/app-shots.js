// Refaz as capturas da app usadas no site, na Play Store e no Instagram.
// node store/app-shots.js   (depois: node store/gen.js e node store/instagram-posts.js)
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..');
const WEB = path.join(root, 'web');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.webmanifest': 'application/json' };

const LANGS = {
  pt: {
    out: 'site/img', locale: 'pt-PT', name: 'Pedro',
    say: ['De 30 em 30 minutos das 13h às 17h avisa-me para pagar a conta da luz', 'Daqui a 20 minutos tirar a roupa da máquina', 'De meia em meia hora beber água', 'Amanhã às 9 ligar ao dentista'],
    alert: ['Pagar a conta da luz', 'Lembrete', 'De meia em meia hora até às 17:00'],
    share: ['Ligar à avó', 'Mãe'],
  },
  en: {
    out: 'site/img/en', locale: 'en-GB', name: 'Sam',
    say: ['Every 30 minutes from 1pm to 5pm remind me to pay the electricity bill', 'In 20 minutes take the laundry out', 'Every half hour drink water', 'Tomorrow at 9 call the dentist'],
    alert: ['Pay the electricity bill', 'Reminder', 'Every half hour until 17:00'],
    share: ['Call grandma', 'Mom'],
  },
};

(async () => {
  const server = http.createServer((req, res) => {
    let f = path.join(WEB, decodeURIComponent(req.url.split(/[?#]/)[0]));
    if (f.endsWith('/')) f += 'index.html';
    if (!f.startsWith(WEB) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  }).listen(0);
  const URL = 'http://localhost:' + server.address().port + '/';
  const b = await chromium.launch();

  for (const T of Object.values(LANGS)) {
    const OUT = path.join(root, T.out);
    const mk = async (scheme) => {
      const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: scheme, reducedMotion: 'reduce', locale: T.locale });
      const page = await ctx.newPage();
      await page.clock.install({ time: new Date(2026, 10, 23, 13, 35) });
      await page.addInitScript(() => {
        window.AndroidBridge = { version(){return '3.0'}, log(){}, voices(){return '[]'}, setVoice(){}, speak(t,r,tok){ setTimeout(()=>__native.onSpeakDone(tok),5); }, stopSpeaking(){}, listen(){}, stopListening(){}, sync(){}, takeActions(){ return '[]'; }, cancelNotification(){}, keepScreenOn(){}, testNow(){}, diag(){ return '{}'; }, status(){ return '{"notifications":true,"exact":true,"battery":true,"tts":true}'; }, openBatterySettings(){}, openNotificationSettings(){}, openAlarmSettings(){}, openVoiceInstall(){}, openTtsSettings(){}, share(){}, takeSharedLink(){ return ''; } };
      });
      await page.goto(URL);
      await page.evaluate((name) => { localStorage.clear(); localStorage.setItem('lembretes.settings.v1', JSON.stringify({ name, momMode: true })); }, T.name);
      await page.reload();
      for (const t of T.say) { await page.evaluate(t => window.__lembretes.handleInput(t), t); await page.clock.runFor(300); }
      await page.clock.runFor(10000);
      await page.evaluate(() => { document.getElementById('toast').hidden = true; });
      return page;
    };
    const light = await mk('light');
    await light.screenshot({ path: `${OUT}/ecra-inicio.png` });
    await light.evaluate(([task, kicker, meta]) => { document.getElementById('alert').hidden = false; document.getElementById('alertTask').textContent = task; document.getElementById('alertKicker').textContent = kicker; document.getElementById('alertMeta').textContent = meta; }, T.alert);
    await light.screenshot({ path: `${OUT}/ecra-aviso.png` });
    await light.evaluate(() => { document.getElementById('alert').hidden = true; });
    await light.click('#openSettings'); await light.waitForTimeout(300);
    await light.evaluate(() => { document.getElementById('sMom').closest('label').scrollIntoView({ block: 'center' }); });
    await light.waitForTimeout(200);
    await light.screenshot({ path: `${OUT}/ecra-modo-mae.png` });
    await light.evaluate(() => document.getElementById('settingsDlg').close());
    await light.evaluate(([t, n]) => { const data = { v: 1, t, i: 0, o: 1, f: Date.now() + 5 * 3600e3, e: 0, d: 0, n };
      location.hash = 'r=' + btoa(unescape(encodeURIComponent(JSON.stringify(data)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }, T.share);
    await light.waitForTimeout(500);
    await light.screenshot({ path: `${OUT}/ecra-partilha.png` });
    const dark = await mk('dark');
    await dark.screenshot({ path: `${OUT}/ecra-escuro.png` });
  }
  await b.close(); server.close(); console.log('ok');
})();
