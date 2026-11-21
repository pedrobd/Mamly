// Mockup das posições dos apoiantes na app (logos fictícios): node store/apoiantes-mockup.js
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..'), WEB = path.join(root, 'web'), OUT = path.join(__dirname, 'out/apoiantes');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
fs.mkdirSync(OUT, { recursive: true });

// logos de exemplo (genéricos)
const logo = (txt, color, h = 28) => `<svg height="${h}" viewBox="0 0 ${txt.length * 11 + 40} 32" style="display:block"><rect x="2" y="4" width="24" height="24" rx="7" fill="${color}"/><circle cx="14" cy="16" r="5" fill="#fff" opacity=".9"/><text x="34" y="22" font-family="Manrope,sans-serif" font-weight="800" font-size="16" fill="currentColor">${txt}</text></svg>`;
const MAIN = logo('A tua marca', '#2F80ED', 30);

const CSS = `
.sp-strip { margin: 28px auto 8px; text-align: center; color: var(--muted); }
.sp-strip small { display:block; font-size: 11px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; margin-bottom: 8px; opacity: .8; }
.sp-strip a { display: inline-flex; color: var(--ink-2); opacity: .75; text-decoration: none; }
.sp-empty { margin: 22px auto 0; padding-top: 18px; border-top: 1px solid var(--line); text-align: center; color: var(--muted); font-size: 13px; max-width: 300px; }
.sp-empty a { display: inline-flex; margin-top: 8px; color: var(--ink-2); opacity: .8; }
.sp-wall { display: grid; gap: 12px; padding: 16px 18px; border-radius: 18px; background: var(--bg-2); border: 1px solid var(--line); }
.sp-wall h4 { margin: 0; font-size: 11px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: var(--accent-2); text-align: center; }
.sp-main { text-decoration: none; display: grid; place-items: center; gap: 4px; padding: 14px; border-radius: 14px; background: var(--card); color: var(--ink); }
.sp-main span { font-size: 12px; color: var(--muted); }
.sp-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.sp-grid div { display: grid; place-items: center; padding: 10px 4px; border-radius: 12px; background: var(--card); color: var(--ink-2); }
.sp-cta { text-align: center; font-size: 13px; color: var(--muted); }
.sp-cta b { color: var(--accent-2); }
.mock-hl { outline: 3px solid #FD726B; outline-offset: 6px; border-radius: 16px; }`;

(async () => {
  const server = http.createServer((req, res) => {
    let f = path.join(WEB, decodeURIComponent(req.url.split(/[?#]/)[0])); if (f.endsWith('/')) f += 'index.html';
    if (!f.startsWith(WEB) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
  }).listen(0);
  const URL = 'http://localhost:' + server.address().port + '/';
  const b = await chromium.launch();
  const page = async (withReminders) => {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: 'light', reducedMotion: 'reduce', locale: 'pt-PT' });
    const p = await ctx.newPage();
    await p.clock.install({ time: new Date(2026, 10, 23, 13, 35) });
    await p.addInitScript(() => { window.AndroidBridge = { version(){return '3.4'}, log(){}, voices(){return '[]'}, setVoice(){}, speak(t,r,tok){ setTimeout(()=>__native.onSpeakDone(tok),5); }, stopSpeaking(){}, listen(){}, stopListening(){}, sync(){}, takeActions(){ return '[]'; }, cancelNotification(){}, keepScreenOn(){}, testNow(){}, diag(){ return '{}'; }, status(){ return '{"notifications":true,"exact":true,"battery":true,"tts":true}'; }, openBatterySettings(){}, openNotificationSettings(){}, openAlarmSettings(){}, openVoiceInstall(){}, openTtsSettings(){}, share(){}, takeSharedLink(){ return ''; } }; });
    await p.goto(URL);
    await p.evaluate(() => { localStorage.clear(); localStorage.setItem('lembretes.settings.v1', JSON.stringify({ name: 'Pedro', momMode: true })); });
    await p.reload();
    if (withReminders) for (const t of ['De 30 em 30 minutos das 13h às 17h avisa-me para pagar a conta da luz', 'Daqui a 20 minutos tirar a roupa da máquina', 'Amanhã às 9 ligar ao dentista'])
      { await p.evaluate(t => window.__lembretes.handleInput(t), t); await p.clock.runFor(300); }
    await p.clock.runFor(10000);
    await p.addStyleTag({ content: CSS });
    await p.evaluate(() => { document.getElementById('toast').hidden = true; });
    return p;
  };

  // 1 · fundo do ecrã principal
  let p = await page(true);
  await p.evaluate((MAIN) => {
    const d = document.createElement('div'); d.className = 'sp-strip mock-hl';
    d.innerHTML = '<small>Com o apoio de</small><a href="#">' + MAIN + '</a>';
    document.querySelector('.list-wrap').after(d);
    window.scrollTo(0, document.body.scrollHeight);
  }, MAIN);
  await p.waitForTimeout(200); await p.screenshot({ path: path.join(OUT, '1-ecra-principal.png') });

  // 2 · ecrã "nada pendente"
  p = await page(false);
  await p.evaluate((MAIN) => {
    const d = document.createElement('div'); d.className = 'sp-empty mock-hl';
    d.innerHTML = 'Este momento de calma é oferecido por<br><a href="#">' + MAIN + '</a>';
    document.querySelector('#empty .examples').after(d);
    d.scrollIntoView({ block: 'center' });
  }, MAIN);
  await p.waitForTimeout(200); await p.screenshot({ path: path.join(OUT, '2-nada-pendente.png') });

  // 3 · definições: mural de apoiantes
  p = await page(true);
  await p.click('#openSettings'); await p.waitForTimeout(300);
  await p.evaluate(([MAIN, L1, L2, L3]) => {
    const w = document.createElement('div'); w.className = 'sp-wall mock-hl';
    w.innerHTML = '<h4>Apoiantes do Mamly 💛</h4><a class="sp-main" href="#">' + MAIN + '<span>Apoiante principal</span></a>'
      + '<div class="sp-grid"><div>' + L1 + '</div><div>' + L2 + '</div><div>' + L3 + '</div></div>'
      + '<p class="sp-cta">Queres aparecer aqui? <b>Fala connosco</b></p>';
    const s = document.getElementById('supportMail'); s.replaceWith(w);
    const dg = document.getElementById('sTestNow').parentElement; dg.style.display = 'none';
    w.scrollIntoView({ block: 'center' });
  }, [MAIN, logo('Logo', '#27AE60', 22), logo('Logo', '#F2994A', 22), logo('Logo', '#9B51E0', 22)]);
  await p.waitForTimeout(200); await p.screenshot({ path: path.join(OUT, '3-definicoes.png') });

  // composição
  const img = n => 'data:image/png;base64,' + fs.readFileSync(path.join(OUT, n)).toString('base64');
  const c = await (await b.newContext({ viewport: { width: 1500, height: 1100 } })).newPage();
  const card = (n, num, title, sub) => `<figure><div class="ph"><img src="${img(n)}"></div><figcaption><b><span>${num}</span>${title}</b>${sub}</figcaption></figure>`;
  await c.setContent(`<style>
    @font-face{font-family:B;src:url(data:font/woff2;base64,${fs.readFileSync(path.join(WEB,'fonts/bricolage-grotesque.woff2')).toString('base64')})}
    @font-face{font-family:M;src:url(data:font/woff2;base64,${fs.readFileSync(path.join(WEB,'fonts/manrope.woff2')).toString('base64')})}
    body{margin:0;background:#FCFBF6;font-family:M;color:#330A2A;padding:56px 70px}
    h1{font-family:B;font-size:46px;letter-spacing:-.03em;margin:0 0 6px}p.s{margin:0 0 40px;font-size:20px;color:#5E3A55}
    .row{display:flex;gap:56px;justify-content:center}figure{margin:0;width:390px}
    .ph{border-radius:44px;background:#1b0716;padding:10px;box-shadow:0 30px 60px -25px rgba(51,10,42,.45)}.ph img{width:100%;display:block;border-radius:36px}
    figcaption{margin-top:22px;font-size:17px;line-height:1.45;color:#5E3A55}figcaption b{display:flex;align-items:center;gap:10px;font-family:B;font-size:22px;color:#330A2A;margin-bottom:6px}
    figcaption span{display:grid;place-items:center;width:32px;height:32px;border-radius:99px;background:#FD726B;color:#fff;font-size:17px}</style>
    <h1>Onde ficam os apoiantes no Mamly</h1><p class="s">Visíveis todos os dias, sem interromper os lembretes. (Logos de exemplo.)</p>
    <div class="row">${card('1-ecra-principal.png', 1, 'Ecrã principal', 'Faixa discreta no fim da lista. Vista várias vezes por dia. <i>Apoiante principal.</i>')}
    ${card('2-nada-pendente.png', 2, '«Nada pendente»', 'Aparece quando está tudo feito: a marca fica ligada a um momento bom. <i>Apoiante principal.</i>')}
    ${card('3-definicoes.png', 3, 'Mural de apoiantes', 'Nas definições, com o principal em destaque e os restantes em grelha. <i>Todos os apoiantes.</i>')}</div>`);
  await c.waitForTimeout(400);
  const h = await c.evaluate(() => document.body.scrollHeight);
  await c.setViewportSize({ width: 1500, height: h });
  await c.screenshot({ path: path.join(OUT, 'mockup-apoiantes.png') });
  await b.close(); server.close(); console.log('ok');
})();
