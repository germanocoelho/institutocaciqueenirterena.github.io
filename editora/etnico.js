/* Editora Cacique Enir Terena · camada étnica comum
   Botões com trama de losangos e flor Terena, cartões vivos, medalhões animados
   das logomarcas (CMDDI atual e histórica, FOCAMS) e selo com as marcas alternando. */
(function(){
'use strict';
var NS = 'http://www.w3.org/2000/svg';
var reduz = matchMedia('(prefers-reduced-motion: reduce)').matches;
var fino = matchMedia('(hover:hover) and (pointer:fine)').matches;
var CORES = ['#00A8E8','#F5AA19','#4FA862','#EE1A8C'];
var $$ = function(s, r){ return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

/* símbolos: flor de quatro pétalas e losango duplo */
if(!document.getElementById('etn-flor')){
  var d = document.createElement('div');
  d.innerHTML = '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>' +
    '<symbol id="etn-flor" viewBox="-50 -50 100 100"><g fill="currentColor"><path d="M0-6C-9-16-9-34 0-44 9-34 9-16 0-6z"/><path d="M0-6C-9-16-9-34 0-44 9-34 9-16 0-6z" transform="rotate(90)"/><path d="M0-6C-9-16-9-34 0-44 9-34 9-16 0-6z" transform="rotate(180)"/><path d="M0-6C-9-16-9-34 0-44 9-34 9-16 0-6z" transform="rotate(270)"/></g><circle r="7" style="fill:var(--miolo,#fff)"/><circle r="3.5" fill="currentColor"/></symbol>' +
    '<symbol id="etn-losango" viewBox="-50 -50 100 100"><g fill="none" stroke="currentColor" stroke-width="7"><path d="M0-42 42 0 0 42-42 0z"/><path d="M0-20 20 0 0 20-20 0z"/></g><circle r="6" fill="currentColor"/></symbol>' +
    '</defs></svg>';
  document.body.insertBefore(d.firstChild, document.body.firstChild);
}
function flor(cls, cor){ return '<svg class="' + cls + '" aria-hidden="true"' + (cor ? ' style="color:' + cor + '"' : '') + '><use href="#etn-flor"/></svg>'; }

/* botões: flor Terena que gira e explosão de pétalas ao clicar */
$$('.bt').forEach(function(b){
  if(b.querySelector('.bt-flor')) return;
  b.insertAdjacentHTML('beforeend', flor('bt-flor'));
  if(reduz) return;
  b.addEventListener('pointerdown', function(e){
    for(var i = 0; i < 10; i++){
      var p = document.createElement('div'), a = i / 10 * Math.PI * 2 + Math.random() * .4, dist = 40 + Math.random() * 40;
      p.className = 'etn-estouro';
      p.innerHTML = '<svg width="14" height="14" style="color:' + CORES[i % 4] + '"><use href="#etn-flor"/></svg>';
      p.style.setProperty('--x', e.clientX + 'px'); p.style.setProperty('--y', e.clientY + 'px');
      p.style.setProperty('--dx', Math.cos(a) * dist + 'px'); p.style.setProperty('--dy', Math.sin(a) * dist + 'px');
      p.style.setProperty('--r', (Math.random() * 400 - 200) + 'deg');
      document.body.appendChild(p); setTimeout(function(q){ return function(){ q.remove(); }; }(p), 950);
    }
  });
});

/* cartões vivos: trama que se espalha a partir do ponteiro, faixa de zigue-zague, flor no canto e inclinação 3D */
var CARTOES = '.un,.pg,.pr,.eixo,.parc .pc,.parceiros .parc,.cartao,.obra.breve';
$$(CARTOES).forEach(function(c, i){
  if(c.classList.contains('etn-card')) return;
  c.classList.add('etn-card');
  var cs = getComputedStyle(c), cor = (cs.getPropertyValue('--c') || cs.getPropertyValue('--sb') || '').trim();
  if(c.classList.contains('pr')) cor = '#111';
  if(c.classList.contains('cartao')) cor = '#F5AA19';
  if(!cor){ var irm = Array.prototype.indexOf.call(c.parentNode.children, c); cor = CORES[irm % 4]; }
  c.style.setProperty('--c', cor);
  c.insertAdjacentHTML('afterbegin', '<span class="etn-tex" aria-hidden="true"></span><span class="etn-faixa" aria-hidden="true"></span>');
  if(!c.matches('.pr,.parc .pc,.parceiros .parc')) c.insertAdjacentHTML('beforeend', flor('etn-orn' + (c.classList.contains('pg') ? ' baixo' : '')));
  /* entrada em cascata */
  var k = Array.prototype.indexOf.call(c.parentNode.children, c);
  if(c.classList.contains('rv') && !reduz){
    c.style.transitionDelay = (k * 0.09) + 's';
    setTimeout(function(){ c.style.transitionDelay = ''; }, 2600 + k * 90);
    var lib = new IntersectionObserver(function(es){ es.forEach(function(e){ if(e.isIntersecting){ setTimeout(function(){ c.style.transitionDelay = ''; }, 1400 + k * 90); lib.disconnect(); } }); });
    lib.observe(c);
  }
  c.addEventListener('pointermove', function(e){
    var r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    c.style.setProperty('--mx', (x * 100) + '%'); c.style.setProperty('--my', (y * 100) + '%');
    if(fino && !reduz) c.style.transform = 'perspective(900px) rotateY(' + ((x - .5) * 9) + 'deg) rotateX(' + ((.5 - y) * 7) + 'deg) translateY(-4px)';
  });
  c.addEventListener('pointerleave', function(){ c.style.transform = ''; });
});

/* medalhões das logomarcas, unidos pelo elo do convênio */
var ROT = {
  'logomarca atual': { en:'current logo', es:'logotipo actual', fr:'logo actuel' },
  'logomarca histórica': { en:'historic logo', es:'logotipo histórico', fr:'logo historique' },
  'Fórum dos Caciques de MS': { en:'Forum of Chiefs of MS', es:'Foro de Caciques de MS', fr:'Forum des caciques du MS' }
};
function rot(t){ var l = (document.documentElement.lang || 'pt').slice(0, 2); return (l !== 'pt' && ROT[t] && ROT[t][l]) || t; }
function anel(cor){
  var s = '<svg class="med-anel" viewBox="-60 -60 120 120" aria-hidden="true"><g class="med-giro">' +
    '<circle r="57" fill="none" stroke="' + cor + '" stroke-width="2.4" stroke-dasharray="1.5 5.5" stroke-linecap="round"/>';
  for(var i = 0; i < 8; i++){ var a = i * 45; s += '<g transform="rotate(' + a + ') translate(0 -57)"><path d="M0-5 5 0 0 5-5 0z" fill="' + (i % 2 ? '#111' : cor) + '"/></g>'; }
  return s + '</g><circle class="med-traco" r="50" transform="rotate(-90)"/></svg>';
}
var ELO = '<svg class="med-elo" viewBox="0 0 60 24" preserveAspectRatio="none" aria-hidden="true"><line x1="0" y1="12" x2="60" y2="12"/></svg>';
$$('.aut-logos').forEach(function(box){
  var imgs = $$('img', box); if(!imgs.length) return;
  var h = '', cores = ['#00A8E8','#F5AA19','#4FA862','#EE1A8C'];
  imgs.forEach(function(im, i){
    var alt = im.getAttribute('alt') || '', p = alt.split(','), sig = p[0].trim(), sub = (p[1] || '').trim();
    if(!sub && /FOCAMS/.test(sig)) sub = 'Fórum dos Caciques de MS';
    var escuro = /cmddi\.jpg$/.test(im.getAttribute('src'));
    if(i) h += ELO;
    h += '<figure class="med" style="margin:0"><div class="med-dsc">' + anel(cores[i % 4]) + '<div class="med-img' + (escuro ? ' escuro' : '') + '"><img src="' + im.getAttribute('src') + '" alt="' + alt.replace(/"/g, '&quot;') + '"></div></div>' +
      '<figcaption><b>' + sig + '</b>' + (sub ? '<small data-rot="' + sub + '">' + rot(sub) + '</small>' : '') + '</figcaption></figure>';
  });
  var m = document.createElement('div'); m.className = 'medalhas'; m.innerHTML = h;
  /* flor no meio de cada elo */
  $$('.med-elo', m).forEach(function(s){ s.insertAdjacentHTML('beforeend', '<g transform="translate(30 12)"><g class="elo-flor"><use href="#etn-flor" x="-9" y="-9" width="18" height="18" style="color:#EE1A8C"/></g></g>'); });
  box.replaceWith(m);
  if(reduz){ m.classList.add('etn-in'); return; }
  var o = new IntersectionObserver(function(es){ es.forEach(function(e){ if(e.isIntersecting){ m.classList.add('etn-in'); o.disconnect(); } }); }, { threshold: .3 });
  o.observe(m);
});
new MutationObserver(function(){ $$('.med small[data-rot]').forEach(function(s){ s.textContent = rot(s.getAttribute('data-rot')); }); })
  .observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });

/* selo: CMDDI atual, CMDDI histórica e FOCAMS se alternam no centro */
$$('.selo .n img, .selo .nucleo img').forEach(function(im){
  var base = im.getAttribute('src').replace(/[^\/]*$/, ''), pilha = document.createElement('div');
  pilha.className = 'etn-selo-pilha';
  pilha.innerHTML = '<img class="on" src="' + base + 'cmddi.jpg" alt="">' + '<img class="claro" src="' + base + 'cmddi-antiga.png" alt="">' + '<img class="claro" src="' + base + 'focams.jpg" alt="">';
  im.replaceWith(pilha);
  if(reduz) return;
  var k = 0, fs = $$('img', pilha);
  setInterval(function(){ fs[k].classList.remove('on'); k = (k + 1) % fs.length; fs[k].classList.add('on'); }, 2800);
});
})();

/* ───────── cursor: maracá Terena estilizado ─────────
   Cabaça pintada com grafismo Terena, cabo de madeira amarrado nas cores da Editora e penas.
   Balança com a inércia do movimento, chacoalha sobre links e botões e, no clique,
   solta ondas sonoras e sementes. A ponta do cabo é o ponto de clique. */
(function(){
  var fino = matchMedia('(hover:hover) and (pointer:fine)').matches, reduz = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(!fino || reduz) return;
  var antigo = document.getElementById('cursor'); if(antigo) antigo.remove();
  var pena = function(r, cor){ return '<g transform="translate(51 51) rotate(' + r + ')"><path d="M0 0C5-3.6 13-3.8 19-.6 13.6 1.2 6 2.6 0 0Z" fill="' + cor + '" stroke="#111" stroke-width=".7"/><path d="M1 0H17" stroke="#111" stroke-width=".6" opacity=".7"/><circle cx="19" cy="-.6" r="1.4" fill="#F5AA19" stroke="#111" stroke-width=".5"/></g>'; };
  var SVG = '<svg viewBox="0 0 64 64" aria-hidden="true"><defs>' +
    '<radialGradient id="mrCab" cx="33%" cy="30%" r="80%"><stop offset="0" stop-color="#F0B266"/><stop offset=".45" stop-color="#BE6524"/><stop offset="1" stop-color="#5A260A"/></radialGradient>' +
    '<linearGradient id="mrCabo" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#A06A35"/><stop offset="1" stop-color="#4A2A10"/></linearGradient>' +
    '<radialGradient id="mrAuraG"><stop offset="0" stop-color="#F5AA19" stop-opacity=".6"/><stop offset="1" stop-color="#EE1A8C" stop-opacity="0"/></radialGradient>' +
    '<clipPath id="mrClip"><ellipse cx="40" cy="40" rx="17" ry="14.5" transform="rotate(45 40 40)"/></clipPath></defs>' +
    '<circle class="mr-aura" cx="40" cy="40" r="25" fill="url(#mrAuraG)"/>' +
    '<g class="mr-penas">' + pena(18, '#00A8E8') + pena(45, '#4FA862') + pena(72, '#EE1A8C') + '</g>' +
    '<path d="M3.5 3.5 27 27" stroke="#111" stroke-width="6.2" stroke-linecap="round"/>' +
    '<path d="M3.5 3.5 27 27" stroke="url(#mrCabo)" stroke-width="4.2" stroke-linecap="round"/>' +
    '<path d="M16 19.4 19.4 16M18.6 22 22 18.6" stroke="#F5AA19" stroke-width="2.1"/><path d="M21.2 24.6 24.6 21.2" stroke="#EE1A8C" stroke-width="2.1"/><path d="M13.4 16.8 16.8 13.4" stroke="#00A8E8" stroke-width="2.1"/>' +
    '<g class="mr-cab"><ellipse cx="40" cy="40" rx="17" ry="14.5" transform="rotate(45 40 40)" fill="url(#mrCab)" stroke="#111" stroke-width="1.6"/>' +
    '<g clip-path="url(#mrClip)"><g transform="rotate(45 40 40)" fill="none" stroke="#F6E6D0" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M20 34.5h40M20 45.5h40" stroke-width="1.3"/>' +
      '<path d="M21 31l2.5-2.5 2.5 2.5 2.5-2.5 2.5 2.5 2.5-2.5 2.5 2.5 2.5-2.5 2.5 2.5 2.5-2.5 2.5 2.5 2.5-2.5 2.5 2.5 2.5-2.5 2.5 2.5" stroke-width="1.1"/>' +
      '<g stroke="none"><use href="#etn-flor" x="26.5" y="37" width="6" height="6" style="color:#F5AA19;--miolo:#F6E6D0"/><use href="#etn-flor" x="34" y="37" width="6" height="6" style="color:#F6E6D0;--miolo:#BE6524"/><use href="#etn-flor" x="41.5" y="37" width="6" height="6" style="color:#EE1A8C;--miolo:#F6E6D0"/><use href="#etn-flor" x="49" y="37" width="6" height="6" style="color:#00A8E8;--miolo:#F6E6D0"/>' +
      '<path d="M30 48.5l1.6 1.6-1.6 1.6-1.6-1.6zM40 48.5l1.6 1.6-1.6 1.6-1.6-1.6zM50 48.5l1.6 1.6-1.6 1.6-1.6-1.6z" fill="#F6E6D0"/></g></g></g>' +
    '<ellipse cx="33.5" cy="33.5" rx="3.2" ry="6" transform="rotate(45 33.5 33.5)" fill="#fff" opacity=".35"/></g>' +
    '<circle cx="3.5" cy="3.5" r="2.6" fill="#111" stroke="#FBF8F2" stroke-width="1"/></svg>';
  var mr = document.createElement('div'); mr.id = 'maraca'; mr.innerHTML = SVG; document.body.appendChild(mr);
  document.documentElement.classList.add('com-maraca');
  var penas = mr.querySelector('.mr-penas'), CS = ['#00A8E8','#F5AA19','#4FA862','#EE1A8C'];
  var x = -200, y = -200, px = x, py = y, vx = 0, vy = 0, ang = 0, va = 0, pa = 0, vpa = 0, tremor = 0, ativo = false, ultSem = 0, k = 0, t = 0;
  var S = 70 / 64;
  function centro(){ var r = ang * Math.PI / 180, cx = 37 * S, cy = 37 * S; return [x + cx * Math.cos(r) - cy * Math.sin(r), y + cx * Math.sin(r) + cy * Math.cos(r)]; }
  function semente(c, forte){
    var e = document.createElement('i'), a = Math.random() * Math.PI * 2, d = forte ? 30 + Math.random() * 40 : 6 + Math.random() * 10;
    e.className = 'mr-semente';
    e.style.setProperty('--c', ['#F6E6D0','#3A1A08','#F5AA19'][Math.floor(Math.random() * 3)]);
    e.style.setProperty('--x', c[0] + 'px'); e.style.setProperty('--y', c[1] + 'px');
    e.style.setProperty('--dx', Math.cos(a) * d + 'px'); e.style.setProperty('--dy', (forte ? Math.sin(a) * d + 30 : 26 + Math.random() * 30) + 'px');
    e.style.setProperty('--r', (Math.random() * 540) + 'deg'); e.style.setProperty('--d', (forte ? .8 : 1.1) + 's');
    document.body.appendChild(e); setTimeout(function(){ e.remove(); }, 1200);
  }
  addEventListener('pointermove', function(e){
    if(e.pointerType && e.pointerType !== 'mouse') return;
    x = e.clientX; y = e.clientY;
    if(!mr.classList.contains('vis')){ px = x; py = y; mr.classList.add('vis'); }
    mr.classList.remove('oculto');
  }, { passive: true });
  document.addEventListener('mouseleave', function(){ mr.classList.add('oculto'); });
  document.documentElement.addEventListener('mouseleave', function(){ mr.classList.add('oculto'); });
  var ALVO = 'a,button,[role="button"],.obra,.pote,.med,.etn-card,label,summary,.cap,.lt-bt';
  document.addEventListener('pointerover', function(e){
    var el = e.target.closest ? e.target : e.target.parentElement;
    var campo = el && el.closest('input,textarea,select,[contenteditable]');
    mr.style.display = campo ? 'none' : '';
    ativo = !!(el && el.closest(ALVO)); mr.classList.toggle('ativo', ativo);
  });
  addEventListener('pointerdown', function(e){
    if(e.pointerType && e.pointerType !== 'mouse') return;
    tremor = 1.4; var c = centro();
    for(var i = 0; i < 3; i++){ (function(i){ setTimeout(function(){ var o = document.createElement('i'); o.className = 'mr-onda'; o.style.setProperty('--c', CS[(k + i) % 4]); o.style.setProperty('--x', c[0] + 'px'); o.style.setProperty('--y', c[1] + 'px'); document.body.appendChild(o); setTimeout(function(){ o.remove(); }, 800); }, i * 110); })(i); }
    k++;
    for(var j = 0; j < 9; j++) semente(c, true);
  });
  (function quadro(){
    t++;
    var dx = x - px, dy = y - py; px = x; py = y;
    vx = vx * .7 + dx * .3; vy = vy * .7 + dy * .3;
    var vel = Math.sqrt(dx * dx + dy * dy);
    /* o maracá balança ao contrário do movimento, como se a cabaça tivesse peso */
    var alvo = Math.max(-38, Math.min(38, -vx * 1.6 + vy * .5));
    va += (alvo - ang) * .16; va *= .74; ang += va;
    tremor = Math.max(tremor * .9, Math.min(.8, vel / 45), ativo ? .32 : 0);
    var chacoalho = Math.sin(t * 1.25) * tremor * 13;
    vpa += (ang - pa) * .07; vpa *= .82; pa += vpa;
    mr.style.transform = 'translate(' + x + 'px,' + y + 'px) rotate(' + (ang + chacoalho).toFixed(2) + 'deg)';
    penas.style.transform = 'rotate(' + ((pa - ang) * .9 - chacoalho * .8).toFixed(2) + 'deg)';
    var agora = performance.now();
    if(vel > 9 && agora - ultSem > 60){ ultSem = agora; semente(centro(), false); }
    requestAnimationFrame(quadro);
  })();
})();
