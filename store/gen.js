// Gera as imagens da ficha da Play Store: node store/gen.js (a partir da raiz do repo)
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..');
const u = p => 'file://' + path.join(root, p);
const fonts = `
@font-face{font-family:B;src:url(${u('web/fonts/bricolage-grotesque.woff2')});font-weight:200 800}
@font-face{font-family:M;src:url(${u('web/fonts/manrope.woff2')});font-weight:200 800}
*{box-sizing:border-box}body{margin:0;font-family:M}h1{font-family:B;letter-spacing:-.03em;margin:0;line-height:1.02}
.hl{background:linear-gradient(transparent 62%,#FBD270 62%,#FBD270 92%,transparent 92%)}`;
const iconSvg = fs.readFileSync(path.join(root, 'web/icon.svg'), 'utf8');
const squareIcon = iconSvg.replace(/rx="265"/g, 'rx="0"');

const T = {
  pt: {
    dir: 'pt-PT', img: 'site/img',
    feat: ['A mãe que te lembra', 'de tudo. <span class="hl">Em voz alta.</span>'],
    featSub: 'Lembretes falados, mesmo com o telemóvel bloqueado.',
    shots: [
      ['ecra-inicio', 'Diz o que tens de fazer.', 'Ela <span class="hl">lembra-te</span> em voz alta.'],
      ['ecra-aviso', 'Toca à hora certa,', 'mesmo com o <span class="hl">ecrã desligado</span>.'],
      ['ecra-modo-mae', 'Modo mãe:', 'a voz <span class="hl">carinhosa</span> da mãe.'],
      ['ecra-partilha', 'Partilha lembretes', 'com <span class="hl">quem gostas</span>.'],
      ['ecra-escuro', 'Pensado para PHDA.', '<span class="hl">Útil para toda a gente</span>.'],
    ],
  },
  en: {
    dir: 'en-US', img: 'site/img/en',
    feat: ['The mom who reminds you', 'of everything. <span class="hl">Out loud.</span>'], featSize: 47,
    featSub: 'Spoken reminders, even when your phone is locked.',
    shots: [
      ['ecra-inicio', 'Say what you need to do.', 'She’ll <span class="hl">remind you</span> out loud.'],
      ['ecra-aviso', 'Rings right on time,', 'even with the <span class="hl">screen off</span>.'],
      ['ecra-modo-mae', 'Mom mode:', 'a <span class="hl">caring</span>, motherly voice.'],
      ['ecra-partilha', 'Share reminders', 'with the <span class="hl">people you love</span>.'],
      ['ecra-escuro', 'Made for ADHD.', '<span class="hl">Handy for everyone</span>.'],
    ],
  },
};

const brand = s => `<div style="display:flex;align-items:center;gap:${s*.3}px"><div style="width:${s}px;height:${s}px">${iconSvg.replace('width="512" height="512"', `width="${s}" height="${s}"`)}</div><span style="font-family:B;font-weight:800;font-size:${s*.62}px;color:#330A2A;letter-spacing:-.03em">mamly</span></div>`;

function shotHtml(t, [file, a, b], i) {
  const dark = file === 'ecra-escuro';
  const bg = ['#FCFBF6', '#FFE6E2', '#FCFBF6', '#FBEFD6', '#F6EFE9'][i];
  return `<style>${fonts}</style><div style="width:1080px;height:1920px;background:${bg};position:relative;overflow:hidden;padding:110px 80px 0">
  <h1 style="font-size:84px;font-weight:800;color:#330A2A">${a}<br>${b}</h1>
  <div style="position:absolute;left:50%;top:470px;transform:translateX(-50%);width:760px;height:1645px;border-radius:96px;background:#1b0716;padding:22px;box-shadow:0 40px 90px rgba(51,10,42,.28)">
    <img src="${u(t.img + '/' + file + '.png')}" style="width:100%;height:auto;border-radius:76px;display:block">
  </div></div>`;
}

function featHtml(t) {
  return `<style>${fonts}</style><div style="width:1024px;height:500px;background:#FCFBF6;position:relative;overflow:hidden;padding:62px 0 0 64px">
  ${brand(64)}
  <h1 style="font-size:${t.featSize || 58}px;font-weight:800;color:#330A2A;margin-top:34px;max-width:640px">${t.feat[0]}<br>${t.feat[1]}</h1>
  <p style="font-size:24px;color:#5E3A55;margin:22px 0 0;max-width:600px">${t.featSub}</p>
  <div style="position:absolute;right:56px;top:46px;width:300px;height:650px;border-radius:44px;background:#1b0716;padding:10px;box-shadow:0 20px 50px rgba(51,10,42,.25)">
    <img src="${u(t.img + '/ecra-inicio.png')}" style="width:100%;border-radius:35px;display:block">
  </div></div>`;
}

(async () => {
  const b = await chromium.launch();
  const out = path.join(__dirname, 'out');
  fs.mkdirSync(out, { recursive: true });
  const shoot = async (html, w, h, file) => {
    const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    const tmp = path.join(out, '_tmp.html');
    fs.writeFileSync(tmp, `<!doctype html><meta charset="utf-8"><body style="margin:0">${html}</body>`);
    await p.goto('file://' + tmp, { waitUntil: 'load' });
    await p.evaluate(() => document.fonts.ready);
    await p.screenshot({ path: file, clip: { x: 0, y: 0, width: w, height: h } });
    await p.close();
  };
  await shoot(`<div style="width:512px;height:512px">${squareIcon}</div>`, 512, 512, path.join(out, 'icon-512.png'));
  for (const [k, t] of Object.entries(T)) {
    const d = path.join(out, t.dir); fs.mkdirSync(d, { recursive: true });
    await shoot(featHtml(t), 1024, 500, path.join(d, 'feature-graphic.png'));
    for (const [i, s] of t.shots.entries()) await shoot(shotHtml(t, s, i), 1080, 1920, path.join(d, `screenshot-${i + 1}.png`));
  }
  fs.unlinkSync(path.join(out, '_tmp.html'));
  await b.close();
  console.log('ok');
})();
