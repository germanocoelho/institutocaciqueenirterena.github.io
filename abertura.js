/* ICET | Abertura "O barro e o grafismo"
   Os raios coloridos da logomarca se abrem, um pote de cerâmica Terena se desenha,
   se enche de barro e recebe a pintura tradicional. A tela se abre em faixas
   trançadas, como o desfazer de um cesto. Aparece em toda entrada. */
(function(){
  var reduz = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var css = [
  '#ic-ab{position:fixed;inset:0;z-index:99999;display:grid;place-items:center;cursor:pointer;overflow:hidden}',
  '#ic-ab .faixas{position:absolute;inset:0;display:flex;flex-direction:column}',
  '#ic-ab .faixas i{flex:1;background:#0E1A2B;margin-bottom:-1px;transition:transform 1s cubic-bezier(.7,0,.2,1)}',
  '#ic-ab .faixas i:nth-child(odd){background:#0d1828}',
  '#ic-ab.sai .faixas i:nth-child(odd){transform:translateX(-102%)}',
  '#ic-ab.sai .faixas i:nth-child(even){transform:translateX(102%)}',
  '#ic-ab .palco{position:relative;display:grid;justify-items:center;gap:0;transition:opacity .45s,transform .9s cubic-bezier(.7,0,.2,1)}',
  '#ic-ab.sai .palco{opacity:0;transform:scale(1.3)}',
  '#ic-ab svg.pote{width:min(500px,86vw);overflow:visible}',
  '#ic-ab .raios{transform-origin:0 0;animation:icGira 22s linear infinite}',
  '#ic-ab .raio{transform-origin:0 0;transform:scale(0);animation:icRaio .9s cubic-bezier(.2,.9,.2,1) forwards;opacity:.9}',
  '@keyframes icRaio{to{transform:scale(1)}}@keyframes icGira{to{transform:rotate(360deg)}}',
  '#ic-ab .disco{fill:#0E1A2B}',
  '#ic-ab .contorno{fill:none;stroke:#FBF3E4;stroke-width:3;stroke-linejoin:round;stroke-dasharray:900;stroke-dashoffset:900;animation:icTraco 1.4s ease .6s forwards}',
  '#ic-ab .barro{transform-box:fill-box;transform-origin:50% 100%;transform:scaleY(0);animation:icSobe 1.1s cubic-bezier(.5,0,.2,1) 1.5s forwards}',
  '@keyframes icSobe{to{transform:scaleY(1)}}@keyframes icTraco{to{stroke-dashoffset:0}}@keyframes icOp{to{opacity:1}}',
  '#ic-ab .pint{fill:none;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:700;stroke-dashoffset:700;animation:icTraco 1s ease forwards}',
  '#ic-ab .ponto{opacity:0;animation:icOp .3s ease forwards}',
  '#ic-ab .petala{transform-box:fill-box;transform-origin:50% 100%;transform:scale(0);animation:icRaio .6s cubic-bezier(.3,1.5,.5,1) forwards}',
  '#ic-ab .brilho{opacity:0;animation:icOp 1.2s ease 2.6s forwards}',
  '#ic-ab .nome{text-align:center;font-family:Cinzel,Georgia,serif;opacity:0;transform:translateY(14px);animation:icNome .9s ease 3.1s forwards}',
  '@keyframes icNome{to{opacity:1;transform:none}}',
  '#ic-ab .nome span{display:block;font-size:clamp(.7rem,1.8vw,.86rem);letter-spacing:.62em;padding-left:.62em;color:rgba(251,243,228,.75)}',
  '#ic-ab .nome b{display:block;margin-top:6px;font-size:clamp(1.5rem,4.6vw,2.6rem);font-weight:700;letter-spacing:.08em;background:linear-gradient(90deg,#E2A93B,#fff1cf,#E2A93B);background-size:200% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:icBrilha 3s linear 3.4s infinite}',
  '@keyframes icBrilha{to{background-position:-200% 0}}',
  '#ic-ab .estrelas i{position:absolute;width:2px;height:2px;border-radius:50%;background:#FBF3E4;opacity:0;animation:icPisca 2.4s ease-in-out infinite}',
  '@keyframes icPisca{50%{opacity:.7}}',
  '#ic-ab.sai .estrelas{opacity:0;transition:opacity .3s}',
  '#ic-ab .pular{position:absolute;bottom:22px;right:24px;font:600 .62rem/1 Inter,system-ui,sans-serif;letter-spacing:.2em;text-transform:uppercase;color:rgba(251,243,228,.45);transition:opacity .3s}',
  '#ic-ab.sai .pular{opacity:0}',
  '@media (prefers-reduced-motion:reduce){#ic-ab *{animation-duration:.01s!important;animation-delay:0s!important}}'
  ].join('\n');
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  var cores = ['#EE3E8C','#2BB3A8','#F2C230','#7B4FA0','#E2A93B','#C2502E'], raios = '';
  for(var i = 0; i < 24; i++){
    var a = i * 15, w = i % 2 ? 7 : 12, L = i % 3 ? 190 : 215;
    raios += '<g transform="rotate(' + a + ')"><path class="raio" style="animation-delay:' + (0.05 + i * 0.03).toFixed(2) + 's" d="M-' + w + ' -110 L0 -' + L + ' L' + w + ' -110Z" fill="' + cores[i % cores.length] + '"/></g>';
  }
  var POTE = 'M-30 -96 C-30 -86 -24 -80 -24 -72 C-24 -62 -70 -52 -82 -18 C-94 18 -72 72 -36 92 L36 92 C72 72 94 18 82 -18 C70 -52 24 -62 24 -72 C24 -80 30 -86 30 -96 Z';
  var zig = 'M-90 -26', up = true; for(var x = -90; x <= 90; x += 12){ zig += ' L' + x + ' ' + (up ? -38 : -26); up = !up; }
  var los = '';
  for(var k = -3; k <= 3; k++){ var cx = k * 26; los += '<path class="pint" style="stroke:#1b120c;stroke-width:2.6;animation-delay:' + (2.55 + (k + 3) * 0.06).toFixed(2) + 's" d="M' + cx + ' 0 l11 12 -11 12 -11 -12Z"/>'; }
  var pontos = ''; for(var m = 0; m < 11; m++){ pontos += '<circle class="ponto" style="animation-delay:' + (2.8 + m * 0.04).toFixed(2) + 's" cx="' + (-60 + m * 12) + '" cy="44" r="3" fill="#FBF3E4"/>'; }
  var flor = ['#00A8E8','#F5AA19','#4FA862','#EE1A8C'].map(function(c, n){ return '<g transform="rotate(' + (n * 90) + ' 0 66)"><path class="petala" style="animation-delay:' + (3 + n * 0.08).toFixed(2) + 's" d="M0 66 C-7 59 -7 49 0 42 C7 49 7 59 0 66Z" fill="' + c + '"/></g>'; }).join('');
  var html = '<div id="ic-ab" aria-hidden="true"><div class="faixas">' + new Array(13).join('<i></i>') + '</div><div class="estrelas"></div>' +
    '<div class="palco"><svg class="pote" viewBox="-230 -230 460 460"><defs><clipPath id="icPote"><path d="' + POTE + '"/></clipPath>' +
    '<radialGradient id="icLuz"><stop offset="0" stop-color="#E2A93B" stop-opacity=".5"/><stop offset="1" stop-color="#E2A93B" stop-opacity="0"/></radialGradient>' +
    '<linearGradient id="icBarro" x1="0" x2="1"><stop offset="0" stop-color="#8f3a1f"/><stop offset=".45" stop-color="#C2502E"/><stop offset="1" stop-color="#7a301a"/></linearGradient></defs>' +
    '<g class="raios">' + raios + '</g><circle class="disco" r="118"/><circle class="brilho" r="150" fill="url(#icLuz)"/>' +
    '<g clip-path="url(#icPote)"><rect class="barro" x="-100" y="-100" width="200" height="195" fill="url(#icBarro)"/>' +
    '<path class="pint" style="stroke:#FBF3E4;stroke-width:3;animation-delay:2.35s" d="' + zig + '"/>' +
    '<path class="pint" style="stroke:#1b120c;stroke-width:4;animation-delay:2.4s" d="M-95 -12 L95 -12"/>' + los +
    '<path class="pint" style="stroke:#1b120c;stroke-width:4;animation-delay:2.7s" d="M-95 32 L95 32"/>' + pontos + flor +
    '</g><path class="contorno" d="' + POTE + '"/></svg>' +
    '<div class="nome"><span>INSTITUTO</span><b>CACIQUE ENIR TERENA</b></div></div>' +
    '<span class="pular">toque para entrar</span></div>';

  function abrir(){
    var velho = document.getElementById('ic-ab'); if(velho) velho.remove();
    var t = document.createElement('div'); t.innerHTML = html; var ab = t.firstElementChild;
    document.body.insertBefore(ab, document.body.firstChild);
    var es = ab.querySelector('.estrelas');
    for(var i = 0; i < 40; i++){ var s = document.createElement('i'); s.style.left = Math.random() * 100 + '%'; s.style.top = Math.random() * 100 + '%'; s.style.animationDelay = (Math.random() * 2.4) + 's'; es.appendChild(s); }
    ab.querySelectorAll('.faixas i').forEach(function(f, n){ f.style.transitionDelay = (n * 0.035) + 's'; });
    document.documentElement.style.overflow = 'hidden';
    var feito = false;
    function fim(){
      if(feito) return; feito = true; ab.classList.add('sai');
      document.documentElement.style.overflow = '';
      window.dispatchEvent(new Event('abertura-fim'));
      setTimeout(function(){ ab.remove(); }, 1500);
    }
    setTimeout(fim, reduz ? 600 : 4800);
    ab.addEventListener('click', fim);
  }
  abrir();
  addEventListener('pageshow', function(e){ if(e.persisted) abrir(); });
})();
