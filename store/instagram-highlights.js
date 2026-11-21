// Capas dos destaques do Instagram (1080×1920; o ícone fica no círculo central)
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
const out = path.join(__dirname, 'out/instagram/destaques');
const P = '#330A2A', CREAM = '#FCFBF6', CORAL = '#FD726B', SUN = '#FBD270';
const s = (d) => `<svg viewBox="0 0 24 24" width="420" height="420" fill="none" stroke="${CREAM}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const covers = {
  'destaque-1-sobre': [P, s('<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><circle cx="12" cy="7.8" r=".6" fill="' + CREAM + '"/>')],
  'destaque-2-voz': [CORAL, s('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>')],
  'destaque-3-modo-mae': [P, s('<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" fill="' + CORAL + '" stroke="' + CORAL + '"/>')],
  'destaque-4-testar': [SUN, s('<rect x="7" y="2.5" width="10" height="19" rx="2.5" stroke="' + P + '"/><path d="M10 15.5l1.6 1.6 3-3.2" stroke="' + P + '"/>')],
};
(async () => {
  const b = await chromium.launch();
  for (const [n, [bg, icon]] of Object.entries(covers)) {
    const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
    await p.setContent(`<body style="margin:0;width:1080px;height:1920px;background:${bg};display:grid;place-items:center">${icon}</body>`);
    await p.screenshot({ path: path.join(out, n + '.png') }); await p.close();
  }
  await b.close(); console.log('ok');
})();
