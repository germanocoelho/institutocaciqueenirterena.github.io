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
