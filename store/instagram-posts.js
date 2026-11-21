// Gera os primeiros posts do Instagram (1080×1350): node store/instagram-posts.js
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..');
const u = p => 'file://' + path.join(root, p);
const out = path.join(__dirname, 'out/instagram');
const icon = fs.readFileSync(path.join(root, 'web/icon.svg'), 'utf8');
const C = { plum: '#330A2A', plum2: '#5C1E4E', coral: '#FD726B', coralSoft: '#FFE6E2', sun: '#FBD270', cream: '#FCFBF6', ink2: '#5E3A55' };
const base = `
@font-face{font-family:B;src:url(${u('web/fonts/bricolage-grotesque.woff2')});font-weight:200 800}
@font-face{font-family:M;src:url(${u('web/fonts/manrope.woff2')});font-weight:200 800}
*{box-sizing:border-box}body{margin:0}
.p{width:1080px;height:1350px;position:relative;overflow:hidden;font-family:M;padding:96px 88px}
h1{font-family:B;font-weight:800;letter-spacing:-.035em;line-height:1;margin:0}
.hl{background:linear-gradient(transparent 60%,${C.sun} 60%,${C.sun} 92%,transparent 92%)}
.brand{position:absolute;left:88px;bottom:80px;display:flex;align-items:center;gap:18px;font-family:B;font-weight:800;font-size:44px;letter-spacing:-.03em}
.brand svg{width:72px;height:72px}
.phone{position:absolute;border-radius:70px;background:#1b0716;padding:16px;box-shadow:0 40px 90px rgba(51,10,42,.3)}
.phone img{width:100%;display:block;border-radius:56px}
.bubble{font-size:46px;line-height:1.3;padding:34px 40px;border-radius:44px;font-weight:600}
.swipe{position:absolute;right:88px;bottom:92px;font-size:30px;font-weight:800;padding:12px 24px;border-radius:999px;border:2.5px solid currentColor;opacity:.85}`;
const brand = (color) => `<div class="brand" style="color:${color}">${icon.replace(/width="512" height="512"/, '')}mamly</div>`;

const posts = {
  '1-apresentacao': `<div class="p" style="background:${C.cream};color:${C.plum}">
    <h1 style="font-size:120px">A mãe que te<br>lembra de tudo.<br><span class="hl">Em voz alta.</span></h1>
    <p style="font-size:38px;color:${C.ink2};margin:40px 0 0;max-width:440px;line-height:1.35">Lembretes falados, mesmo com o telemóvel bloqueado.</p>
    <div class="phone" style="right:72px;top:640px;width:430px"><img src="${u('site/img/ecra-aviso.png')}"></div>
    ${brand(C.plum)}</div>`,
  '2-diz-nao-escrevas': `<div class="p" style="background:${C.coralSoft};color:${C.plum}">
    <h1 style="font-size:104px">Diz.<br><span class="hl">Não escrevas.</span></h1>
    <div style="margin-top:70px;display:grid;gap:36px">
      <div class="bubble" style="background:#fff;justify-self:end;max-width:780px;border-bottom-right-radius:12px">🎙️ «De 30 em 30 minutos, das 13h às 17h, avisa-me para pagar a conta da luz.»</div>
      <div class="bubble" style="background:${C.plum};color:${C.cream};max-width:800px;border-bottom-left-radius:12px">🔊 Combinado. Vou lembrar-te de meia em meia hora: pagar a conta da luz. O primeiro aviso é às 13h.</div>
    </div>
    <p style="font-size:42px;line-height:1.35;color:${C.ink2};margin:50px 0 0">Falas como falarias com alguém. O Mamly percebe a hora, a repetição e quando parar.</p>
    ${brand(C.plum)}</div>`,
  '3-modo-mae': `<div class="p" style="background:${C.plum};color:${C.cream}">
    <h1 style="font-size:112px">Modo<br><span style="color:${C.coral}">mãe</span> 💛</h1>
    <div style="margin-top:90px;display:grid;gap:40px;max-width:900px">
      <div class="bubble" style="background:${C.plum2}">«Meu amor, não te esqueças de beber água.»</div>
      <div class="bubble" style="background:${C.plum2};margin-left:60px">«Então, Pedro? Já trataste disto?»</div>
      <div class="bubble" style="background:${C.plum2}">«Eu disse que voltava…»</div>
      <div class="bubble" style="background:${C.coral};color:${C.plum};margin-left:60px">«Muito bem! Que orgulho.»</div>
    </div>
    ${brand(C.cream)}</div>`,
  '4-phda': `<div class="p" style="background:${C.cream};color:${C.plum}">
    <h1 style="font-size:92px">Esqueces-te das coisas assim que pousas o telemóvel?</h1>
    <p style="font-family:B;font-weight:800;font-size:64px;margin:40px 0 0;color:${C.coral}">Não és só tu.</p>
    <div style="margin-top:80px;display:grid;gap:44px;font-size:46px;line-height:1.3">
      <div style="display:flex;gap:26px"><span style="font-size:52px">🗣️</span><span><b>Falas</b> em vez de escrever: zero fricção.</span></div>
      <div style="display:flex;gap:26px"><span style="font-size:52px">🔁</span><span><b>Insiste</b> até fazeres. Sem culpas.</span></div>
      <div style="display:flex;gap:26px"><span style="font-size:52px">🔒</span><span><b>Sem contas</b>, sem anúncios. Fica tudo no teu telemóvel.</span></div>
    </div>
    ${brand(C.plum)}</div>`,
  '5-testadores': `<div class="p" style="background:${C.sun};color:${C.plum}">
    <p style="font-size:34px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;margin:0 0 40px;display:inline-block;background:${C.plum};color:${C.sun};padding:12px 22px;border-radius:14px">Procuram-se testadores</p>
    <h1 style="font-size:120px">O Mamly vai chegar à Google&nbsp;Play.</h1>
    <p style="font-size:46px;line-height:1.35;margin:70px 0 0;max-width:880px">Precisamos de pessoas com Android para testar durante 14 dias antes do lançamento.</p>
    <p style="font-size:46px;line-height:1.35;margin:40px 0 0;font-weight:800">Queres ajudar? Manda mensagem 💌</p>
    ${brand(C.plum)}</div>`,
};

const postsEn = {
  '1-apresentacao': `<div class="p" style="background:${C.cream};color:${C.plum}">
    <h1 style="font-size:112px">The mom who<br>reminds you of<br>everything.<br><span class="hl">Out loud.</span></h1>
    <p style="font-size:38px;color:${C.ink2};margin:40px 0 0;max-width:440px;line-height:1.35">Spoken reminders, even when your phone is locked.</p>
    <div class="phone" style="right:72px;top:700px;width:430px"><img src="${u('site/img/en/ecra-aviso.png')}"></div>
    ${brand(C.plum)}</div>`,
  '2-diz-nao-escrevas': `<div class="p" style="background:${C.coralSoft};color:${C.plum}">
    <h1 style="font-size:104px">Say it.<br><span class="hl">Don’t type it.</span></h1>
    <div style="margin-top:70px;display:grid;gap:36px">
      <div class="bubble" style="background:#fff;justify-self:end;max-width:780px;border-bottom-right-radius:12px">🎙️ “Every 30 minutes, from 1pm to 5pm, remind me to pay the electricity bill.”</div>
      <div class="bubble" style="background:${C.plum};color:${C.cream};max-width:800px;border-bottom-left-radius:12px">🔊 Okay. I’ll remind you every half hour: pay the electricity bill. The first reminder is at 1pm.</div>
    </div>
    <p style="font-size:42px;line-height:1.35;color:${C.ink2};margin:50px 0 0">Talk like you’d talk to a friend. Mamly gets the time, how often and when to stop.</p>
    ${brand(C.plum)}</div>`,
  '3-modo-mae': `<div class="p" style="background:${C.plum};color:${C.cream}">
    <h1 style="font-size:112px"><span style="color:${C.coral}">Mom</span><br>mode 💛</h1>
    <div style="margin-top:90px;display:grid;gap:40px;max-width:900px">
      <div class="bubble" style="background:${C.plum2}">“Sweetheart, don’t forget to drink water.”</div>
      <div class="bubble" style="background:${C.plum2};margin-left:60px">“So, Sam? Have you done it yet?”</div>
      <div class="bubble" style="background:${C.plum2}">“I told you I’d be back…”</div>
      <div class="bubble" style="background:${C.coral};color:${C.plum};margin-left:60px">“Well done! I’m so proud.”</div>
    </div>
    ${brand(C.cream)}</div>`,
  '4-phda': `<div class="p" style="background:${C.cream};color:${C.plum}">
    <h1 style="font-size:92px">Forget things the moment you put your phone down?</h1>
    <p style="font-family:B;font-weight:800;font-size:64px;margin:40px 0 0;color:${C.coral}">It’s not just you.</p>
    <div style="margin-top:80px;display:grid;gap:44px;font-size:46px;line-height:1.3">
      <div style="display:flex;gap:26px"><span style="font-size:52px">🗣️</span><span><b>Talk</b> instead of typing: zero friction.</span></div>
      <div style="display:flex;gap:26px"><span style="font-size:52px">🔁</span><span><b>It nudges</b> until you do it. No guilt.</span></div>
      <div style="display:flex;gap:26px"><span style="font-size:52px">🔒</span><span><b>No accounts</b>, no ads. Everything stays on your phone.</span></div>
    </div>
    ${brand(C.plum)}</div>`,
  '5-testadores': `<div class="p" style="background:${C.sun};color:${C.plum}">
    <p style="font-size:34px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;margin:0 0 40px;display:inline-block;background:${C.plum};color:${C.sun};padding:12px 22px;border-radius:14px">Testers wanted</p>
    <h1 style="font-size:120px">Mamly is coming to Google&nbsp;Play.</h1>
    <p style="font-size:46px;line-height:1.35;margin:70px 0 0;max-width:880px">We need Android users to test it for 14 days before launch.</p>
    <p style="font-size:46px;line-height:1.35;margin:40px 0 0;font-weight:800">Want to help? Send us a message 💌</p>
    ${brand(C.plum)}</div>`,
};

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  const all = [];
  for (const [name, html] of Object.entries(posts)) {
    const dark = name.startsWith('3-');
    all.push([name + '-pt', html.replace(/<\/div>$/, `<div class="swipe" style="color:${dark ? C.cream : C.plum}${name.startsWith('1-') ? ';top:100px;bottom:auto' : ''}">English →</div></div>`)]);
    all.push([name + '-en', postsEn[name]]);
  }
  for (const f of fs.readdirSync(out)) if (/^post-.*\.png$/.test(f)) fs.unlinkSync(path.join(out, f));
  for (const [name, html] of all) {
    const p = await b.newPage({ viewport: { width: 1080, height: 1350 } });
    const tmp = path.join(out, '_t.html');
    fs.writeFileSync(tmp, `<!doctype html><meta charset="utf-8"><style>${base}</style><body>${html}</body>`);
    await p.goto('file://' + tmp); await p.evaluate(() => document.fonts.ready);
    await p.screenshot({ path: path.join(out, `post-${name}.png`) });
    await p.close();
  }
  fs.unlinkSync(path.join(out, '_t.html'));
  await b.close(); console.log('ok');
})();
