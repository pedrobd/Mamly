const { chromium } = require('playwright'); const fs=require('fs');
const svg=fs.readFileSync(__dirname+'/../web/icon.svg','utf8');
const out=__dirname+'/../store/out/instagram/';
const variants={
  'mamly-perfil-ameixa': s=>s.replace(/rx="265"/g,'rx="0"').replace('scale(0.93)','scale(0.80)'),
  'mamly-perfil-creme': s=>s.replace(/rx="265"/g,'rx="0"').replace('scale(0.93)','scale(0.80)').replace('fill="#330A2A"','fill="#FCFBF6"'),
};
(async()=>{const b=await chromium.launch();
for(const [n,f] of Object.entries(variants)){
  const p=await b.newPage({viewport:{width:1080,height:1080}});
  fs.writeFileSync(out+'_t.html',`<body style="margin:0">${f(svg).replace('width="512" height="512"','width="1080" height="1080"')}</body>`);
  await p.goto('file://'+out+'_t.html'); await p.screenshot({path:out+n+'.png'}); await p.close();}
fs.unlinkSync(out+'_t.html'); await b.close();})();
