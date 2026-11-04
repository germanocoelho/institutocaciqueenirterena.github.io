/* Portaria de aprovação de obra pelo Conselho Editorial: texto padrão (modelo da Portaria nº 01/2025) e PDF A4
   gerado no navegador, pronto para assinatura no gov.br. Funciona também em Node (module.exports) para testes. */
(function (raiz) {
'use strict';
var LARG = {"Times-Roman": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 250, 333, 408, 500, 500, 833, 778, 180, 333, 333, 500, 564, 250, 333, 250, 278, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 278, 278, 564, 564, 564, 444, 921, 722, 667, 667, 722, 611, 556, 722, 722, 333, 389, 722, 611, 889, 722, 722, 556, 722, 667, 556, 611, 722, 722, 944, 722, 722, 611, 333, 278, 333, 469, 500, 333, 444, 500, 444, 500, 444, 333, 500, 500, 278, 278, 500, 278, 778, 500, 500, 500, 500, 333, 389, 278, 500, 500, 722, 500, 500, 444, 480, 200, 480, 541, 350, 500, 350, 333, 500, 444, 1000, 500, 500, 333, 1000, 556, 333, 889, 350, 611, 350, 350, 333, 333, 444, 444, 350, 500, 1000, 333, 980, 389, 333, 722, 350, 444, 722, 250, 333, 500, 500, 500, 500, 200, 500, 333, 760, 276, 500, 564, 333, 760, 333, 400, 564, 300, 300, 333, 500, 453, 250, 333, 300, 310, 500, 750, 750, 750, 444, 722, 722, 722, 722, 722, 722, 889, 667, 611, 611, 611, 611, 333, 333, 333, 333, 722, 722, 722, 722, 722, 722, 722, 564, 722, 722, 722, 722, 722, 722, 556, 500, 444, 444, 444, 444, 444, 444, 667, 444, 444, 444, 444, 444, 278, 278, 278, 278, 500, 500, 500, 500, 500, 500, 500, 564, 500, 500, 500, 500, 500, 500, 500, 500], "Times-Bold": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 250, 333, 555, 500, 500, 1000, 833, 278, 333, 333, 500, 570, 250, 333, 250, 278, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 333, 333, 570, 570, 570, 500, 930, 722, 667, 722, 722, 667, 611, 778, 778, 389, 500, 778, 667, 944, 722, 778, 611, 778, 722, 556, 667, 722, 722, 1000, 722, 722, 667, 333, 278, 333, 581, 500, 333, 500, 556, 444, 556, 444, 333, 500, 556, 278, 333, 556, 278, 833, 556, 500, 556, 556, 444, 389, 333, 556, 500, 722, 500, 500, 444, 394, 220, 394, 520, 350, 500, 350, 333, 500, 500, 1000, 500, 500, 333, 1000, 556, 333, 1000, 350, 667, 350, 350, 333, 333, 500, 500, 350, 500, 1000, 333, 1000, 389, 333, 722, 350, 444, 722, 250, 333, 500, 500, 500, 500, 220, 500, 333, 747, 300, 500, 570, 333, 747, 333, 400, 570, 300, 300, 333, 556, 540, 250, 333, 300, 330, 500, 750, 750, 750, 500, 722, 722, 722, 722, 722, 722, 1000, 722, 667, 667, 667, 667, 389, 389, 389, 389, 722, 722, 778, 778, 778, 778, 778, 570, 778, 722, 722, 722, 722, 722, 611, 556, 500, 500, 500, 500, 500, 500, 722, 444, 444, 444, 444, 444, 278, 278, 278, 278, 500, 556, 500, 500, 500, 500, 500, 570, 500, 556, 556, 556, 556, 500, 556, 500]};
var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
var PADRAO = {
  serie: 'Conselho Editorial da Editora Cacique Enir Terena',
  editora: 'Editora Cacique Enir Terena',
  mantenedora: 'Instituto Cacique Enir Terena – ICET',
  autoridade: 'O Presidente do Conselho Editorial da Editora Cacique Enir Terena',
  atribuicoes: 'Art. 2º, II da Portaria nº 01/2025',
  regimento: 'Art. 10, IV do Regimento Interno da Editora Cacique Enir Terena',
  resolucao: 'Resolução nº 01/2025',
  cidade: 'Campo Grande/MS',
  signatario: 'Germano Coelho Ramos Rocha da Silva',
  cargo: 'Presidente do Conselho Editorial da Editora Cacique Enir Terena'
};
function dataExtenso(iso) { var p = String(iso).slice(0, 10).split('-'); return (+p[2]) + ' de ' + MESES[+p[1] - 1] + ' de ' + p[0]; }
function listaNomes(l) { return l.length < 2 ? l.join('') : l.slice(0, -1).join(', ') + ' e ' + l[l.length - 1]; }
function fmtIsbn(s) { var d = String(s || '').replace(/[^0-9X]/gi, ''); return d.length === 13 ? d.slice(0, 3) + '-' + d.slice(3, 5) + '-' + d.slice(5, 10) + '-' + d.slice(10, 12) + '-' + d[12] : s; }

/* blocos de texto; trechos entre ** saem em negrito */
function texto(d) {
  var c = {}; for (var k in PADRAO) c[k] = d[k] || PADRAO[k];
  var autores = (d.autores || []).filter(Boolean), titulo = d.titulo + (d.subtitulo ? ': ' + d.subtitulo : '');
  var autoria = autores.length ? ', de autoria de **' + autores[0] + '**' + (autores.length > 1 ? ', com coautoria de **' + listaNomes(autores.slice(1)) + '**' : '') : '';
  var edicao = d.edicao && +d.edicao > 1 ? 'a ' + d.edicao + 'ª edição da obra' : 'a obra';
  var art2 = d.isbn ? 'Determinar que esta aprovação produza efeitos jurídicos e administrativos, autorizando a publicação da obra sob o ISBN ' + fmtIsbn(d.isbn) + ', atribuído pela Agência Brasileira do ISBN, e os registros nos demais órgãos competentes.'
    : 'Determinar que esta aprovação produza efeitos jurídicos e administrativos, autorizando o registro da obra junto à Agência Brasileira do ISBN e demais órgãos competentes.';
  return {
    cab: ['PORTARIA Nº ' + d.numero, c.serie],
    preambulo: c.autoridade + ', no uso das atribuições que lhe confere o **' + c.atribuicoes + '**, e em conformidade com o **' + c.regimento + '**,',
    artigos: [
      '**Art. 1º** – Aprovar para publicação ' + edicao + ' intitulada **“' + titulo + '”**' + autoria + ', sob responsabilidade editorial da ' + c.editora + '.',
      '**Art. 2º** – ' + art2,
      '**Art. 3º – Conformidade Estatutária:** A obra aprovada está em conformidade com os objetivos sociais do ' + c.mantenedora + ', conforme previsto no **Art. 2º da ' + c.resolucao + '**, garantindo alinhamento às finalidades culturais, científicas e educacionais da entidade.',
      '**Art. 4º – Respeito à Identidade Cultural:** A publicação respeita e valoriza a identidade cultural indígena' + (d.identidade ? ', ' + d.identidade : '') + ', em consonância com o **Art. 2º, inciso III da ' + c.resolucao + '**, assegurando a proteção da propriedade intelectual indígena e a difusão legítima dos saberes tradicionais.',
      '**Art. 5º – Responsabilidade Editorial:** A ' + c.editora + ' assume integral responsabilidade pela produção, publicação e difusão da obra, conforme estabelecido no **Art. 1º da ' + c.resolucao + '**, garantindo qualidade, legitimidade e protagonismo indígena no processo editorial.',
      '**Art. 6º** – Esta Portaria entra em vigor na data de sua assinatura.'
    ],
    local: c.cidade + ', ' + dataExtenso(d.data),
    signatario: c.signatario, cargo: c.cargo, controle: d.controle || ''
  };
}

/* ── PDF ── */
var ESP = { 0x20AC: 0x80, 0x201A: 0x82, 0x0192: 0x83, 0x201E: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02C6: 0x88, 0x2030: 0x89, 0x0160: 0x8A, 0x2039: 0x8B, 0x0152: 0x8C, 0x017D: 0x8E, 0x2018: 0x91, 0x2019: 0x92, 0x201C: 0x93, 0x201D: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x02DC: 0x98, 0x2122: 0x99, 0x0161: 0x9A, 0x203A: 0x9B, 0x0153: 0x9C, 0x017E: 0x9E, 0x0178: 0x9F };
function win(s) { var o = []; for (var i = 0; i < s.length; i++) { var c = s.charCodeAt(i); o.push(c < 128 || (c >= 0xA0 && c < 256) ? c : (ESP[c] || 0x3F)); } return o; }
function largura(s, neg, tam) { return win(s).reduce(function (t, c) { return t + LARG[neg ? 'Times-Bold' : 'Times-Roman'][c]; }, 0) * tam / 1000; }
function pdfStr(s) { return '(' + win(s).map(function (c) { var ch = String.fromCharCode(c); return ch === '(' || ch === ')' || ch === '\\' ? '\\' + ch : c < 32 || c > 126 ? '\\' + ('00' + c.toString(8)).slice(-3) : ch; }).join('') + ')'; }
function palavras(t) { var r = [], neg = false; t.split('**').forEach(function (seg, i) { neg = i % 2 === 1; seg.split(/(\s+)/).forEach(function (w) { if (!w) return; if (/^\s+$/.test(w)) r.push({ esp: true }); else r.push({ t: w, neg: neg }); }); }); return r; }
function linhas(t, larg, tam) {
  var ws = palavras(t), L = [], cur = [], w = 0, sp = largura(' ', false, tam);
  ws.forEach(function (p) {
    if (p.esp) { if (cur.length) cur.pendente = true; return; }
    var pw = largura(p.t, p.neg, tam), junta = cur.length && !cur.pendente;
    if (cur.length && w + (junta ? 0 : sp) + pw > larg) { L.push(cur); cur = []; w = 0; junta = false; }
    if (junta) { var u = cur[cur.length - 1]; u.partes.push(p); u.w += pw; w += pw; }
    else { if (cur.length) w += sp; cur.push({ partes: [p], w: pw }); w += pw; }
    cur.pendente = false;
  });
  if (cur.length) L.push(cur);
  return L;
}
function gerarPdf(d) {
  // tenta caber numa página: reduz espaçamentos e, se preciso, o corpo da letra
  var tent = [[12, 15.5, 1], [12, 15, 0.7], [11.5, 14.5, 0.55], [11, 13.8, 0.45]];
  for (var i = 0; i < tent.length; i++) { var r = gerarPdf0(d, tent[i][0], tent[i][1], tent[i][2]); if (r.paginas === 1 || i === tent.length - 1) return r.bytes; }
}
function gerarPdf0(d, tam, ld, g) {
  var T = texto(d), A4w = 595.28, A4h = 841.89, ME = 85, MD = 57, paginas = [[]], ops = paginas[0], y = A4h - 80;
  function quebra(prec) { if (y - (prec || 0) < 45) { ops = []; paginas.push(ops); y = A4h - 80; } }
  function escrever(x, yy, p, t2) { ops.push('BT /' + (p.neg ? 'F2' : 'F1') + ' ' + (t2 || tam) + ' Tf ' + x.toFixed(2) + ' ' + yy.toFixed(2) + ' Td ' + pdfStr(p.t) + ' Tj ET'); }
  function paragrafo(t, x0, larg, just, centro) {
    var L = linhas(t, larg, tam);
    L.forEach(function (ln, i) {
      quebra();
      var tot = ln.reduce(function (s, g) { return s + g.w; }, 0), gaps = ln.length - 1, sp = largura(' ', false, tam);
      var gap = just && i < L.length - 1 && gaps ? (larg - tot) / gaps : sp, x = centro ? x0 + (larg - tot - gaps * sp) / 2 : x0;
      ln.forEach(function (g) { g.partes.forEach(function (p) { escrever(x, y, p); x += largura(p.t, p.neg, tam); }); x += gap; });
      y -= ld;
    });
  }
  var LW = A4w - ME - MD, logo = d.logo && d.logo.jpeg ? d.logo : null, lgW = 0, lgH = 0;
  if (logo) { lgW = 125 * (g < 1 ? 0.85 : 1); lgH = lgW * logo.h / logo.w; ops.push('q ' + lgW.toFixed(2) + ' 0 0 ' + lgH.toFixed(2) + ' ' + (ME + (LW - lgW) / 2).toFixed(2) + ' ' + (A4h - 42 - lgH).toFixed(2) + ' cm /Im1 Do Q'); y = A4h - 42 - lgH - (1 + 1.2 * g) * ld; }
  escrever(ME, y, { t: T.cab[0], neg: true }); escrever(ME + largura(T.cab[0], true, tam) + 24, y, { t: T.cab[1], neg: true }); y -= (1.5 + 2.5 * g) * ld;
  paragrafo(T.preambulo, ME + LW * 0.5, LW * 0.5, true); y -= (1 + 1.5 * g) * ld;
  paragrafo('**RESOLVE:**', ME, LW, false); y -= 0.5 * ld;
  T.artigos.forEach(function (a) { paragrafo(a, ME, LW, true); y -= 0.5 * ld; });
  y -= (0.6 + 0.9 * g) * ld; quebra(6 * ld); paragrafo(T.local, ME, LW, false, true); y -= (2.4 + 1.1 * g) * ld;
  paragrafo(T.signatario, ME, LW, false, true); y -= 0.3 * ld; paragrafo(T.cargo, ME, LW, false, true);
  if (T.controle) { var tc = 7.5, wc = largura(T.controle, false, tc); ops = paginas[paginas.length - 1]; ops.push('0.45 g'); escrever(ME + (LW - wc) / 2, 26, { t: T.controle, neg: false }, tc); ops.push('0 g'); }
  var np = paginas.length;
  // objetos: 1 catálogo, 2 páginas, 3 e 4 fontes, 5 info, depois pares página/conteúdo
  var kids = [], objs = ['<< /Type /Catalog /Pages 2 0 R /Lang (pt-BR) >>', null,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman /Encoding /WinAnsiEncoding >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Times-Bold /Encoding /WinAnsiEncoding >>',
    '<< /Title ' + pdfStr('Portaria nº ' + d.numero + ' – ' + T.cab[1]) + ' /Author ' + pdfStr(T.signatario) + ' /Producer (Acervo da Editora Cacique Enir Terena) >>'];
  paginas.forEach(function (pg) {
    var nPag = objs.length + 1, nCont = nPag + 1; kids.push(nPag + ' 0 R');
    objs.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + A4w + ' ' + A4h + '] /Resources << /Font << /F1 3 0 R /F2 4 0 R >>' + (logo ? ' /XObject << /Im1 IMG 0 R >>' : '') + ' >> /Contents ' + nCont + ' 0 R >>');
    objs.push({ stream: Uint8Array.from(win(pg.join('\n'))) });
  });
  objs[1] = '<< /Type /Pages /Kids [' + kids.join(' ') + '] /Count ' + np + ' >>';
  if (logo) { var nImg = objs.length + 1; objs.push({ stream: logo.jpeg, dict: '/Type /XObject /Subtype /Image /Width ' + logo.w + ' /Height ' + logo.h + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode' }); objs = objs.map(function (o) { return typeof o === 'string' ? o.replace(/IMG 0 R/g, nImg + ' 0 R') : o; }); }
  var partes = [], pos = 0, offs = [];
  function add(u) { partes.push(u); pos += u.length; }
  function addS(s) { add(Uint8Array.from(win(s))); }
  addS('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n');
  objs.forEach(function (o, i) {
    offs.push(pos);
    if (o.stream) { addS((i + 1) + ' 0 obj\n<< ' + (o.dict ? o.dict + ' ' : '') + '/Length ' + o.stream.length + ' >>\nstream\n'); add(o.stream); addS('\nendstream\nendobj\n'); }
    else addS((i + 1) + ' 0 obj\n' + o + '\nendobj\n');
  });
  var xref = pos;
  addS('xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n' + offs.map(function (o) { return ('0000000000' + o).slice(-10) + ' 00000 n \n'; }).join('') + 'trailer\n<< /Size ' + (objs.length + 1) + ' /Root 1 0 R /Info 5 0 R >>\nstartxref\n' + xref + '\n%%EOF\n');
  var out = new Uint8Array(pos), at = 0; partes.forEach(function (u) { out.set(u, at); at += u.length; });
  return { bytes: out, paginas: np };
}
/* verificação de assinatura digital embutida (PAdES / PKCS#7, gov.br) */
function assinaturaPdf(u8) {
  var s = ''; for (var i = 0; i < u8.length; i += 65536) s += String.fromCharCode.apply(null, u8.subarray(i, i + 65536));
  var tem = /\/ByteRange\s*\[/.test(s) && /\/SubFilter\s*\/(adbe\.pkcs7\.detached|ETSI\.CAdES\.detached|adbe\.pkcs7\.sha1)/.test(s);
  if (!tem) return null;
  var hx = s.match(/\/Contents\s*<([0-9A-Fa-f\s]{2000,})>/g) || [];
  hx.forEach(function (h) { var x = h.replace(/^[^<]*<|>$/g, '').replace(/\s+/g, ''); var t = ''; for (var i = 0; i + 1 < x.length; i += 2) t += String.fromCharCode(parseInt(x.substr(i, 2), 16)); s += '\n' + t; });
  var gov = /Governo Federal do Brasil/.test(s) || /AC Final do Governo Federal/.test(s);
  var m = /\/M\s*\(D:(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})/.exec(s);
  var nomes = []; var rx = /[A-ZÀ-Ý][A-ZÀ-Ý ]{8,60}[A-ZÀ-Ý]/g, x;
  // o nome do titular aparece em texto no certificado (CN); pega os candidatos que não são de autoridade certificadora
  while ((x = rx.exec(s))) { var n = x[0].trim(); if (n.split(' ').length >= 3 && !/^AC |GOVERNO|BRASIL|INTERMEDIARIA|AUTORIDADE|ICP|RAIZ/.test(n) && nomes.indexOf(n) < 0) nomes.push(n); }
  return { governo: gov, data: m ? m[1] + '-' + m[2] + '-' + m[3] + ' ' + m[4] + ':' + m[5] : '', titulares: nomes.slice(0, 3) };
}
var _logo = null;
function logoEditora(url) {
  if (_logo) return _logo;
  _logo = fetch(url, { cache: 'force-cache' }).then(function (r) { if (!r.ok) throw new Error('logo'); return r.blob(); }).then(function (b) { return createImageBitmap(b); }).then(function (im) {
    var cv = document.createElement('canvas'); cv.width = im.width; cv.height = im.height; var cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height); cx.drawImage(im, 0, 0);
    return new Promise(function (ok) { cv.toBlob(ok, 'image/jpeg', 0.92); }).then(function (bl) { return bl.arrayBuffer(); }).then(function (ab) { return { jpeg: new Uint8Array(ab), w: im.width, h: im.height }; });
  }).catch(function () { _logo = null; return null; });
  return _logo;
}
var API = { logoEditora: logoEditora, PADRAO: PADRAO, texto: texto, gerarPdf: gerarPdf, assinaturaPdf: assinaturaPdf, dataExtenso: dataExtenso };
if (typeof module !== 'undefined' && module.exports) module.exports = API; else raiz.PORTARIA_ICET = API;
})(this);
