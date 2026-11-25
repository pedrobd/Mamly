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
  '6-todos-os-dias': `<div class="p" style="background:${C.cream};color:${C.plum}">
    <h1 style="font-size:104px">Todos os dias.<br><span class="hl">À mesma hora.</span></h1>
    <div style="margin-top:60px;display:grid;gap:30px">
      <div class="bubble" style="background:#fff;justify-self:end;max-width:800px;border-bottom-right-radius:12px;box-shadow:0 10px 30px rgba(51,10,42,.08)">🎙️ «Todos os dias às 9h tomar a medicação.»</div>
      <div class="bubble" style="background:${C.plum};color:${C.cream};max-width:820px;border-bottom-left-radius:12px">🔊 Combinado. Todos os dias, às 9 horas, lembro-te de: tomar a medicação. 💊</div>
    </div>
    <div style="margin-top:50px;display:flex;flex-wrap:wrap;gap:14px">
      ${['De segunda a sexta', 'Às segundas e quintas', 'Aos fins de semana', 'Dia 5 de cada mês'].map(t => `<span style="font-size:32px;font-weight:700;padding:14px 24px;border-radius:999px;background:${C.coralSoft}">🔁 ${t}</span>`).join('')}
    </div>
    ${brand(C.plum)}</div>`,
  '7-responde-por-voz': `<div class="p" style="background:${C.plum};color:${C.cream}">
    <h1 style="font-size:100px">Nem precisas de <span style="color:${C.coral}">tocar</span> no telemóvel.</h1>
    <div style="margin-top:70px;display:grid;gap:30px;max-width:920px">
      <div class="bubble" style="background:${C.plum2}">🔊 «Pedro, está na hora: tirar a roupa da máquina.»</div>
      <div class="bubble" style="background:${C.coral};color:${C.plum};justify-self:end">🎙️ «Feito!»</div>
      <div class="bubble" style="background:${C.plum2}">🔊 «Boa! Menos um evento.»</div>
    </div>
    <p style="font-size:42px;line-height:1.35;margin:56px 0 0;opacity:.9">Mesmo com o ecrã bloqueado, o aviso aparece e ouve a tua resposta.</p>
    ${brand(C.cream)}</div>`,
  '8-dois-eventos': `<div class="p" style="background:${C.coralSoft};color:${C.plum}">
    <h1 style="font-size:100px">Dois eventos à mesma hora?<br><span class="hl">Um só aviso.</span></h1>
    <div style="margin-top:60px;display:grid;gap:30px">
      <div class="bubble" style="background:${C.plum};color:${C.cream};max-width:880px;border-bottom-left-radius:12px">🔊 «Pedro, tens dois eventos: ir à padaria, até às 15 horas; e ir ao mecânico, até às 17 horas.»</div>
      <div class="bubble" style="background:#fff;justify-self:end;border-bottom-right-radius:12px">🎙️ «Feito padaria.»</div>
      <div class="bubble" style="background:${C.plum};color:${C.cream};max-width:760px;border-bottom-left-radius:12px">🔊 «Boa! Falta: ir ao mecânico.»</div>
    </div>
    ${brand(C.plum)}</div>`,
  '9-nao-me-incomodes': `<div class="p" style="background:${C.plum};color:${C.cream}">
    <h1 style="font-size:104px">Precisas de <span style="color:${C.coral}">sossego</span>? 🤫</h1>
    <div style="margin-top:70px;display:grid;gap:30px">
      <div class="bubble" style="background:${C.coral};color:${C.plum};justify-self:end;max-width:820px;border-bottom-right-radius:12px">🎙️ «Não me incomodes das 15h às 16h.»</div>
      <div class="bubble" style="background:${C.plum2};max-width:860px;border-bottom-left-radius:12px">🔊 «Combinado. Das 15 horas às 16 horas não te incomodo.»</div>
    </div>
    <p style="font-size:42px;line-height:1.35;margin:56px 0 0;opacity:.9">As repetições calam-se. O que tinha hora marcada avisa-te quando acabar. E basta dizer «já podes incomodar».</p>
    ${brand(C.cream)}</div>`,
  '10-datas': `<div class="p" style="background:${C.sun};color:${C.plum}">
    <h1 style="font-size:92px">Daqui a uma semana?<br>Daqui a um mês?</h1>
    <div style="margin-top:48px;display:grid;gap:30px">
      <div class="bubble" style="background:#fff;justify-self:end;max-width:840px;border-bottom-right-radius:12px">🎙️ «No dia 30 de novembro às 15h lembra-me para ir ao supermercado.»</div>
      <div class="bubble" style="background:${C.plum};color:${C.cream};max-width:860px;border-bottom-left-radius:12px">🔊 «Combinado. Segunda-feira, 30 de novembro, às 15 horas, lembro-te de ir ao supermercado.»</div>
    </div>
    <div style="margin-top:36px;display:flex;flex-wrap:wrap;gap:14px">
      ${['📅 A 5 de dezembro', '📅 Dia 2 às 10h', '📅 15/12 às 9h'].map(t => `<span style="font-size:32px;font-weight:700;padding:14px 24px;border-radius:999px;background:${C.cream}">${t}</span>`).join('')}
    </div>
    ${brand(C.plum)}</div>`,
  '11-modo-noite': `<div class="p" style="background:#1b0716;color:${C.cream}">
    <div style="position:absolute;right:100px;bottom:200px;font-size:260px;line-height:1">🌙</div>
    <h1 style="font-size:110px">De noite,<br><span style="color:${C.sun}">ninguém insiste.</span></h1>
    <p style="font-size:46px;line-height:1.35;margin:70px 0 0;max-width:880px">Das 23h às 8h, o Mamly não repete avisos. Escolhes tu o horário.</p>
    <p style="font-size:46px;line-height:1.35;margin:36px 0 0;max-width:880px">O despertador da medicação às 7h? <b style="color:${C.sun}">Esse toca sempre.</b></p>
    ${brand(C.cream)}</div>`,
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
  '6-todos-os-dias': `<div class="p" style="background:${C.cream};color:${C.plum}">
    <h1 style="font-size:104px">Every day.<br><span class="hl">Same time.</span></h1>
    <div style="margin-top:60px;display:grid;gap:30px">
      <div class="bubble" style="background:#fff;justify-self:end;max-width:800px;border-bottom-right-radius:12px;box-shadow:0 10px 30px rgba(51,10,42,.08)">🎙️ “Every day at 9 take my meds.”</div>
      <div class="bubble" style="background:${C.plum};color:${C.cream};max-width:820px;border-bottom-left-radius:12px">🔊 Okay. Every day at 9 AM I’ll remind you: take my meds. 💊</div>
    </div>
    <div style="margin-top:50px;display:flex;flex-wrap:wrap;gap:14px">
      ${['On weekdays', 'Mondays & Thursdays', 'On weekends', 'The 5th of every month'].map(t => `<span style="font-size:32px;font-weight:700;padding:14px 24px;border-radius:999px;background:${C.coralSoft}">🔁 ${t}</span>`).join('')}
    </div>
    ${brand(C.plum)}</div>`,
  '7-responde-por-voz': `<div class="p" style="background:${C.plum};color:${C.cream}">
    <h1 style="font-size:100px">You don’t even need to <span style="color:${C.coral}">touch</span> your phone.</h1>
    <div style="margin-top:70px;display:grid;gap:30px;max-width:920px">
      <div class="bubble" style="background:${C.plum2}">🔊 “Sam, it’s time: take the laundry out.”</div>
      <div class="bubble" style="background:${C.coral};color:${C.plum};justify-self:end">🎙️ “Done!”</div>
      <div class="bubble" style="background:${C.plum2}">🔊 “Nice! One less thing.”</div>
    </div>
    <p style="font-size:42px;line-height:1.35;margin:56px 0 0;opacity:.9">Even with the screen locked, the reminder shows up and listens for your reply.</p>
    ${brand(C.cream)}</div>`,
  '8-dois-eventos': `<div class="p" style="background:${C.coralSoft};color:${C.plum}">
    <h1 style="font-size:100px">Two events at once?<br><span class="hl">One reminder.</span></h1>
    <div style="margin-top:60px;display:grid;gap:30px">
      <div class="bubble" style="background:${C.plum};color:${C.cream};max-width:880px;border-bottom-left-radius:12px">🔊 “Sam, you have two events: go to the bakery, until 3 PM; and go to the mechanic, until 5 PM.”</div>
      <div class="bubble" style="background:#fff;justify-self:end;border-bottom-right-radius:12px">🎙️ “Done bakery.”</div>
      <div class="bubble" style="background:${C.plum};color:${C.cream};max-width:760px;border-bottom-left-radius:12px">🔊 “Nice! Still to do: go to the mechanic.”</div>
    </div>
    ${brand(C.plum)}</div>`,
  '9-nao-me-incomodes': `<div class="p" style="background:${C.plum};color:${C.cream}">
    <h1 style="font-size:104px">Need some <span style="color:${C.coral}">quiet</span>? 🤫</h1>
    <div style="margin-top:70px;display:grid;gap:30px">
      <div class="bubble" style="background:${C.coral};color:${C.plum};justify-self:end;max-width:820px;border-bottom-right-radius:12px">🎙️ “Don’t disturb me from 3 to 4pm.”</div>
      <div class="bubble" style="background:${C.plum2};max-width:860px;border-bottom-left-radius:12px">🔊 “Okay. From 3 PM to 4 PM I won’t disturb you.”</div>
    </div>
    <p style="font-size:42px;line-height:1.35;margin:56px 0 0;opacity:.9">Repeats go quiet. Anything set for that time reminds you when it ends. Just say “you can disturb me”.</p>
    ${brand(C.cream)}</div>`,
  '10-datas': `<div class="p" style="background:${C.sun};color:${C.plum}">
    <h1 style="font-size:92px">Next week?<br>Next month?</h1>
    <div style="margin-top:48px;display:grid;gap:30px">
      <div class="bubble" style="background:#fff;justify-self:end;max-width:840px;border-bottom-right-radius:12px">🎙️ “On November 30 at 3pm remind me to go to the supermarket.”</div>
      <div class="bubble" style="background:${C.plum};color:${C.cream};max-width:860px;border-bottom-left-radius:12px">🔊 “Okay. Monday, 30 November, at 3 PM, I’ll remind you to go to the supermarket.”</div>
    </div>
    <div style="margin-top:36px;display:flex;flex-wrap:wrap;gap:14px">
      ${['📅 On December 5th', '📅 On the 2nd at 10', '📅 Dec 15 at 9am'].map(t => `<span style="font-size:32px;font-weight:700;padding:14px 24px;border-radius:999px;background:${C.cream}">${t}</span>`).join('')}
    </div>
    ${brand(C.plum)}</div>`,
  '11-modo-noite': `<div class="p" style="background:#1b0716;color:${C.cream}">
    <div style="position:absolute;right:100px;bottom:200px;font-size:260px;line-height:1">🌙</div>
    <h1 style="font-size:110px">At night,<br><span style="color:${C.sun}">no nagging.</span></h1>
    <p style="font-size:46px;line-height:1.35;margin:70px 0 0;max-width:880px">From 11pm to 8am, Mamly doesn’t repeat reminders. You pick the hours.</p>
    <p style="font-size:46px;line-height:1.35;margin:36px 0 0;max-width:880px">Your 7am meds reminder? <b style="color:${C.sun}">That one always rings.</b></p>
    ${brand(C.cream)}</div>`,
};

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  const all = [];
  for (const [name, html] of Object.entries(posts)) {
    const dark = /^(3|7|9|11)-/.test(name);
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
