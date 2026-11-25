/* Configuração partilhada do site Mamly.
 * No dia do lançamento basta pôr o link da Play Store em playUrl. */
window.MAMLY = {
  playUrl: '', // 'https://play.google.com/store/apps/details?id=pt.pedrobd.lembrame'
  goatcounter: 'mamly', // estatísticas sem cookies: https://mamly.goatcounter.com
  webApp: false, // true = mostra os links para usar a app no browser (mamly.app/app/)
};
(function () {
  var C = window.MAMLY;
  function apply() {
    var live = !!C.playUrl;
    document.querySelectorAll('[data-play]').forEach(function (a) {
      if (live) {
        a.href = C.playUrl; a.removeAttribute('aria-disabled');
        var s = a.querySelector('small'); if (s && s.dataset.live) s.textContent = s.dataset.live;
      } else {
        a.addEventListener('click', function (e) { e.preventDefault(); });
      }
    });
    document.querySelectorAll('[data-play-nav]').forEach(function (a) { if (live) a.href = C.playUrl; });
    document.querySelectorAll('[data-soon]').forEach(function (el) { el.hidden = live; });
    document.querySelectorAll('[data-live-only]').forEach(function (el) { el.hidden = !live; });
    document.querySelectorAll('[data-web]').forEach(function (el) { el.hidden = !C.webApp; });
    // memoriza a língua escolhida (PT/EN)
    document.querySelectorAll('[data-lang]').forEach(function (a) {
      a.addEventListener('click', function () { try { localStorage.setItem('mamly.site.lang', a.dataset.lang); } catch (e) {} });
    });
    // estatísticas (GoatCounter): visitas e cliques em [data-goatcounter-click]; sem cookies
    if (C.goatcounter && location.hostname === 'mamly.app') {
      var g = document.createElement('script');
      g.async = true; g.src = 'https://gc.zgo.at/count.js';
      g.dataset.goatcounter = 'https://' + C.goatcounter + '.goatcounter.com/count';
      document.body.appendChild(g);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply); else apply();
})();

// menu hambúrguer (telemóvel)
(function () {
  const nav = document.querySelector('.nav'), btn = nav && nav.querySelector('.nav-toggle');
  if (!btn) return;
  const set = (open) => { nav.classList.toggle('open', open); btn.setAttribute('aria-expanded', open); };
  btn.addEventListener('click', (e) => { e.stopPropagation(); set(!nav.classList.contains('open')); });
  nav.querySelectorAll('.nav-links a').forEach(a => a.addEventListener('click', () => set(false)));
  document.addEventListener('click', (e) => { if (!nav.contains(e.target)) set(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') set(false); });
})();
