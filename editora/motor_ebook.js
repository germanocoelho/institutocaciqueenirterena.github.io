/* ==========================================================================
   MOTOR EDITORIAL DIGITAL — Editora Cacique Enir Terena (ICET)
   Recebe o manuscrito (.docx, .odt, .md, .txt, .html) e produz, de forma
   automática, um livro digital EPUB 3 no padrão da Editora, com:
   - elementos pré-textuais, textuais e pós-textuais (ABNT NBR 6029);
   - sumário (NBR 6027), numeração progressiva (NBR 6024), citações e notas
     (NBR 10520), referências (NBR 6023) e índice remissivo (NBR 6034);
   - ficha catalográfica (CIP), ISBN, conselho editorial e logomarcas;
   - acessibilidade (Lei 13.146/2015, art. 68; EPUB Accessibility 1.1);
   - auditoria severa com relatório e correções automáticas registradas.
   Tudo roda no navegador do ADM; nada do manuscrito sai da máquina, exceto
   os trechos enviados ao Claude quando a revisão por IA está ligada.
   ========================================================================== */
(function () {
'use strict';
if (window.EBOOK_ICET) return;

var BASE = (function () {
  var s = document.currentScript && document.currentScript.src;
  return s ? s.replace(/[^\/?#]*([?#].*)?$/, '') : 'editora/';
})();
var VERSAO = '1.0';
var LS_OBRA = 'icet_ebook_obra', LS_CFG = 'icet_editora_cfg';
var XHTML_NS = 'http://www.w3.org/1999/xhtml';

/* ───────────────────────── utilidades ───────────────────────── */
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function semAcento(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, ''); }
function N(s) { return semAcento(s).toUpperCase().replace(/[\s ]+/g, ' ').replace(/[\s.:;,]+$/, '').trim(); }
function slug(s) { return semAcento(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'livro'; }
function txt(el) { return ((el && el.textContent) || '').replace(/[\s ]+/g, ' ').trim(); }
function clone(o) { return JSON.parse(JSON.stringify(o)); }
function pad(n, k) { n = String(n); while (n.length < (k || 2)) n = '0' + n; return n; }
function uuid() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) { var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); });
}
function mesclar(a, b) {
  if (!b || typeof b !== 'object') return a;
  Object.keys(b).forEach(function (k) {
    if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object' && !Array.isArray(a[k])) mesclar(a[k], b[k]);
    else a[k] = b[k];
  });
  return a;
}
function carregarScript(src) {
  return new Promise(function (ok, erro) {
    var s = document.createElement('script'); s.src = src; s.onload = ok;
    s.onerror = function () { erro(new Error('Falha ao carregar ' + src)); };
    document.head.appendChild(s);
  });
}
var _libs = null;
function libs() {
  if (!_libs) _libs = Promise.all([
    window.JSZip ? 0 : carregarScript(BASE + 'lib/jszip.min.js'),
    window.mammoth ? 0 : carregarScript(BASE + 'lib/mammoth.browser.min.js')
  ]).catch(function (e) { _libs = null; throw e; });
  return _libs;
}
function bufParaB64(buf) {
  var u = buf instanceof Uint8Array ? buf : new Uint8Array(buf), s = '', CH = 0x8000;
  for (var i = 0; i < u.length; i += CH) s += String.fromCharCode.apply(null, u.subarray(i, i + CH));
  return btoa(s);
}
function b64ParaBytes(b) { var s = atob(b), u = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; }
function dataUrlParaBytes(d) {
  var m = /^data:([^;,]+)?((?:;[^;,]+)*?)(;base64)?,([\s\S]*)$/.exec(d || '');
  if (!m) return null;
  var mime = (m[1] || 'application/octet-stream').toLowerCase();
  var bytes = m[3] ? b64ParaBytes(m[4].replace(/\s+/g, '')) : new TextEncoder().encode(decodeURIComponent(m[4]));
  return { mime: mime, bytes: bytes };
}
function bytesParaDataUrl(bytes, mime) { return 'data:' + mime + ';base64,' + bufParaB64(bytes); }
function hashBytes(u) { var h = 2166136261 >>> 0; for (var i = 0; i < u.length; i += Math.max(1, (u.length / 4096) | 0)) { h ^= u[i]; h = Math.imul(h, 16777619) >>> 0; } return h.toString(16) + '-' + u.length; }
var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
function romano(n) { var v = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1], r = ['M', 'CM', 'D', 'CD', 'C', 'XC', 'L', 'XL', 'X', 'IX', 'V', 'IV', 'I'], s = ''; for (var i = 0; i < v.length; i++) while (n >= v[i]) { s += r[i]; n -= v[i]; } return s; }
function deRomano(s) { var m = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 }, t = 0; s = String(s).toUpperCase(); for (var i = 0; i < s.length; i++) { var a = m[s[i]], b = m[s[i + 1]] || 0; if (!a) return NaN; t += a < b ? -a : a; } return t; }
function numeroDe(s) { return /^\d+$/.test(s) ? +s : deRomano(s); }
var LETRA = '[A-Za-zÀ-ÖØ-öø-ÿĀ-žẀ-ỿ]';

/* ───────────────────────── configuração da editora ───────────────────────── */
var CFG_PADRAO = {
  versao: 1,
  editora: {
    nome: 'Editora Cacique Enir Terena', mantenedora: 'Instituto Cacique Enir Terena (ICET)',
    cidade: 'Campo Grande', uf: 'MS', endereco: '', email: '', site: 'https://institutocaciqueenirterena.com.br',
    politica: 'Selo editorial de autoria indígena. Autores não indígenas só participam de uma publicação se ao menos um dos autores for indígena. O Instituto arca com os custos de registro de direitos autorais e de ISBN.'
  },
  regras: { exigeAutorIndigena: true },
  conselho: [],
  equipe: { editor: '', revisao: '', projetoGrafico: 'Editora Cacique Enir Terena', capa: '', diagramacao: 'Motor editorial digital da Editora Cacique Enir Terena', bibliotecario: '', crb: '' },
  logos: [
    { id: 'icet', sigla: 'ICET', nome: 'Instituto Cacique Enir Terena', papel: 'Realização', arquivo: 'logos/icet.jpg', fundo: '#ffffff', autorizado: true },
    { id: 'cmddi', sigla: 'CMDDI', nome: 'Conselho Municipal dos Direitos e Defesa dos Povos Indígenas de Campo Grande', papel: 'Apoio institucional', arquivo: 'logos/cmddi.jpg', fundo: '#000000', autorizado: false },
    { id: 'focams', sigla: 'FOCAMS', nome: 'Fórum dos Caciques de Mato Grosso do Sul', papel: 'Apoio institucional', arquivo: 'logos/focams.jpg', fundo: '#ffffff', autorizado: false },
    { id: 'ifms', sigla: 'IFMS', nome: 'Instituto Federal de Educação, Ciência e Tecnologia de Mato Grosso do Sul', papel: 'Parceria', arquivo: '', fundo: '#ffffff', autorizado: false },
    { id: 'mpms', sigla: 'MPMS', nome: 'Ministério Público do Estado de Mato Grosso do Sul', papel: 'Parceria', arquivo: '', fundo: '#ffffff', autorizado: false }
  ]
};
var cfg = clone(CFG_PADRAO);
var _logoCache = {};

function cfgCarregar() {
  return fetch(BASE + 'config.json?t=' + Date.now(), { cache: 'no-store' })
    .then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; })
    .then(function (rem) {
      cfg = mesclar(clone(CFG_PADRAO), rem || {});
      if (rem && Array.isArray(rem.logos)) cfg.logos = rem.logos;
      if (rem && Array.isArray(rem.conselho)) cfg.conselho = rem.conselho;
      try {
        var loc = JSON.parse(localStorage.getItem(LS_CFG) || 'null');
        if (loc && loc._t && (!rem || !rem._t || loc._t > rem._t)) { cfg = mesclar(cfg, loc); if (Array.isArray(loc.logos)) cfg.logos = loc.logos; if (Array.isArray(loc.conselho)) cfg.conselho = loc.conselho; }
      } catch (e) {}
      return cfg;
    });
}
function cfgGuardarLocal() {
  cfg._t = Date.now();
  var c = clone(cfg); (c.logos || []).forEach(function (l) { delete l._dataUrl; });
  try { localStorage.setItem(LS_CFG, JSON.stringify(c)); } catch (e) {}
}
function ghOk() { return !!(window.GH && window.GH.token && window.GH.repo); }
function ghPut(caminho, b64, msg) {
  var api = 'https://api.github.com/repos/' + window.GH.repo + '/contents/' + caminho;
  var h = { 'Authorization': 'token ' + window.GH.token, 'Content-Type': 'application/json', 'Accept': 'application/vnd.github+json' };
  return fetch(api + '?ref=main', { headers: h, cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : {}; })
    .then(function (at) { return fetch(api, { method: 'PUT', headers: h, body: JSON.stringify({ message: msg, content: b64, sha: at.sha || undefined }) }); })
    .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.message || ('HTTP ' + r.status)); return j; }); });
}
function cfgSalvarNuvem() {
  cfgGuardarLocal();
  var c = clone(cfg); (c.logos || []).forEach(function (l) { delete l._dataUrl; });
  if (!ghOk()) return Promise.reject(new Error('ADM sem acesso de gravação (entre com a senha do ADM).'));
  return ghPut('editora/config.json', btoa(unescape(encodeURIComponent(JSON.stringify(c, null, 2)))), 'Editora: configuração editorial atualizada');
}
function logoDados(l) {
  if (!l) return Promise.resolve(null);
  if (l._dataUrl) { var d = dataUrlParaBytes(l._dataUrl); return Promise.resolve(d ? { bytes: d.bytes, mime: d.mime, url: l._dataUrl } : null); }
  if (!l.arquivo) return Promise.resolve(null);
  var k = l.arquivo;
  if (_logoCache[k]) return Promise.resolve(_logoCache[k]);
  return fetch(BASE + l.arquivo + '?t=' + (cfg._t || 1)).then(function (r) { if (!r.ok) throw 0; return r.blob(); })
    .then(function (b) { return b.arrayBuffer().then(function (ab) { var u = new Uint8Array(ab), mime = b.type || (/\.png$/i.test(k) ? 'image/png' : 'image/jpeg'); var o = { bytes: u, mime: mime, url: bytesParaDataUrl(u, mime) }; _logoCache[k] = o; return o; }); })
    .catch(function () { return null; });
}

/* ───────────────────────── dados da obra ───────────────────────── */
var OBRA_PADRAO = {
  titulo: '', subtitulo: '', autores: '', organizadores: '', edicao: '1', ano: String(new Date().getFullYear()),
  local: '', isbn: '', isbnImpresso: '', cdd: '', cdu: '', cutter: '', assuntos: '', palavrasChave: '', serie: '',
  sinopse: '', licenca: 'todos', direitosTexto: '', capaGerada: false, termosIndice: '', ctDeclaracao: false, ctTexto: '', dedicatoria: '', epigrafe: '',
  numeracao: 'auto', revisaoIA: true, indice: true, listas: 'auto', capaPropria: ''
};
var obra = clone(OBRA_PADRAO);
var _origemIA = {};
function obraCarregar() { try { var o = JSON.parse(localStorage.getItem(LS_OBRA) || 'null'); if (o) obra = mesclar(clone(OBRA_PADRAO), o); } catch (e) {} }
function obraGuardar() { var o = clone(obra); if (o.capaPropria && o.capaPropria.length > 1500000) o.capaPropria = ''; try { localStorage.setItem(LS_OBRA, JSON.stringify(o)); } catch (e) {} }

function pessoas(s) {
  return String(s || '').split(/\n+/).map(function (l) { return l.trim(); }).filter(Boolean).map(function (l) {
    var p = l.split(/\s*;\s*/), povo = (p[1] || '').trim();
    return { nome: p[0].trim(), povo: povo, indigena: !!povo };
  });
}
var SUFIXOS = /^(J[UÚ]NIOR|JR\.?|FILHO|FILHA|NETO|NETA|SOBRINHO|SOBRINHA|SEGUNDO)$/i;
function partesNome(nome) {
  var w = String(nome || '').trim().split(/\s+/);
  if (w.length < 2) return { sobrenome: w[0] || '', prenomes: '' };
  var sob = w.pop();
  if (SUFIXOS.test(sob) && w.length >= 2) sob = w.pop() + ' ' + sob;
  return { sobrenome: sob, prenomes: w.join(' ') };
}
function nomeFicha(nome) { var p = partesNome(nome); return p.prenomes ? p.sobrenome + ', ' + p.prenomes : p.sobrenome; }
function isbnLimpo(s) { return String(s || '').replace(/[^0-9Xx]/g, '').toUpperCase(); }
function isbnValido(s) {
  var d = isbnLimpo(s), t = 0, i;
  if (d.length === 13) { if (!/^97[89]\d{10}$/.test(d)) return false; for (i = 0; i < 12; i++) t += (+d[i]) * (i % 2 ? 3 : 1); return ((10 - t % 10) % 10) === +d[12]; }
  if (d.length === 10) { for (i = 0; i < 9; i++) t += (+d[i]) * (10 - i); return (t + (d[9] === 'X' ? 10 : +d[9])) % 11 === 0; }
  return false;
}
function isbnFormatado(s) {
  // a hifenização depende das faixas de editora atribuídas pela agência; mantém a forma informada
  var t = String(s || '').trim().replace(/[.\s]+$/, '');
  return /-/.test(t) ? t : isbnLimpo(t);
}

/* ───────────────────────── auditoria ───────────────────────── */
function Auditoria() { this.itens = []; this.correcoes = {}; }
Auditoria.prototype.add = function (sev, cat, msg, o) { o = o || {}; this.itens.push({ sev: sev, cat: cat, msg: msg, onde: o.onde || '', norma: o.norma || '', sug: o.sug || '' }); };
Auditoria.prototype.corr = function (tipo, n) { if (n === undefined) n = 1; if (!n) return; this.correcoes[tipo] = (this.correcoes[tipo] || 0) + n; };
Auditoria.prototype.conta = function (sev) { return this.itens.filter(function (i) { return i.sev === sev; }).length; };
var PESO = { bloqueante: 25, grave: 8, aviso: 2, info: 0 };

/* ───────────────────────── 1. INGESTÃO ───────────────────────── */
var STYLE_MAP = [
  "p[style-name='Title'] => h1.titulo-doc:fresh", "p[style-name='Título'] => h1.titulo-doc:fresh",
  "p[style-name='Subtitle'] => p.subtitulo-doc:fresh", "p[style-name='Subtítulo'] => p.subtitulo-doc:fresh",
  "p[style-name='Título 1'] => h1:fresh", "p[style-name='Título 2'] => h2:fresh", "p[style-name='Título 3'] => h3:fresh",
  "p[style-name='Título 4'] => h4:fresh", "p[style-name='Título 5'] => h5:fresh", "p[style-name='Título 6'] => h6:fresh",
  "p[style-name='Quote'] => blockquote > p:fresh", "p[style-name='Intense Quote'] => blockquote > p:fresh",
  "p[style-name='Citação'] => blockquote > p:fresh", "p[style-name='Citação Intensa'] => blockquote > p:fresh",
  "p[style-name='Citação longa'] => blockquote > p:fresh", "p[style-name='Block Text'] => blockquote > p:fresh",
  "p[style-name='Caption'] => p.legenda:fresh", "p[style-name='Legenda'] => p.legenda:fresh",
  "p[style-name='Epigraph'] => p.epigrafe-p:fresh", "p[style-name='Epígrafe'] => p.epigrafe-p:fresh",
  "r[style-name='Strong'] => strong", "r[style-name='Emphasis'] => em", "r[style-name='Forte'] => strong", "r[style-name='Ênfase'] => em"
];

function lerDocx(buf) {
  return window.mammoth.convertToHtml({ arrayBuffer: buf }, { styleMap: STYLE_MAP }).then(function (r) {
    return window.JSZip.loadAsync(buf).then(function (z) { var f = z.file('docProps/core.xml'); return f ? f.async('string') : ''; })
      .catch(function () { return ''; })
      .then(function (core) {
        var meta = {};
        if (core) {
          var x = new DOMParser().parseFromString(core, 'application/xml'), DC = 'http://purl.org/dc/elements/1.1/';
          var t = x.getElementsByTagNameNS(DC, 'title')[0], c = x.getElementsByTagNameNS(DC, 'creator')[0];
          if (t && txt(t)) meta.titulo = txt(t);
          if (c && txt(c)) meta.autor = txt(c);
        }
        var avisos = (r.messages || []).filter(function (m) { return m.type === 'warning' || m.type === 'error'; }).map(function (m) { return m.message; });
        return { html: r.value, meta: meta, avisos: avisos };
      });
  });
}

function lerOdt(buf) {
  var NS = {
    text: 'urn:oasis:names:tc:opendocument:xmlns:text:1.0', style: 'urn:oasis:names:tc:opendocument:xmlns:style:1.0',
    fo: 'urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0', draw: 'urn:oasis:names:tc:opendocument:xmlns:drawing:1.0',
    xlink: 'http://www.w3.org/1999/xlink', table: 'urn:oasis:names:tc:opendocument:xmlns:table:1.0',
    office: 'urn:oasis:names:tc:opendocument:xmlns:office:1.0', svg: 'urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0'
  };
  return window.JSZip.loadAsync(buf).then(function (z) {
    if (!z.file('content.xml')) throw new Error('Arquivo ODT inválido (sem content.xml).');
    return Promise.all([z.file('content.xml').async('string'), z.file('styles.xml') ? z.file('styles.xml').async('string') : '', z.file('meta.xml') ? z.file('meta.xml').async('string') : ''])
      .then(function (a) {
        var x = new DOMParser().parseFromString(a[0], 'application/xml');
        var est = {};
        [x, a[1] ? new DOMParser().parseFromString(a[1], 'application/xml') : null].forEach(function (d) {
          if (!d) return;
          Array.prototype.forEach.call(d.getElementsByTagNameNS(NS.style, 'style'), function (s) {
            var tp = s.getElementsByTagNameNS(NS.style, 'text-properties')[0];
            est[s.getAttributeNS(NS.style, 'name')] = {
              pai: s.getAttributeNS(NS.style, 'parent-style-name'), exib: s.getAttributeNS(NS.style, 'display-name'),
              it: !!(tp && tp.getAttributeNS(NS.fo, 'font-style') === 'italic'), bd: !!(tp && tp.getAttributeNS(NS.fo, 'font-weight') === 'bold')
            };
          });
        });
        function nomeEstilo(n) { var v = est[n], guard = 0; var nomes = [n]; while (v && v.pai && guard++ < 5) { nomes.push(v.pai); v = est[v.pai]; } return nomes.map(function (k) { return N(((est[k] && est[k].exib) || k).replace(/_20_/g, ' ')); }).join('|'); }
        var notas = [], imgs = [];
        function inl(node) {
          var out = '';
          Array.prototype.forEach.call(node.childNodes, function (c) {
            if (c.nodeType === 3) { out += esc(c.nodeValue); return; }
            if (c.nodeType !== 1) return;
            var ln = c.localName;
            if (ln === 's') out += ' '.repeat(+(c.getAttributeNS(NS.text, 'c') || 1));
            else if (ln === 'tab') out += ' ';
            else if (ln === 'line-break') out += '<br/>';
            else if (ln === 'span') { var s = est[c.getAttributeNS(NS.text, 'style-name')] || {}; var h = inl(c); if (s.bd) h = '<strong>' + h + '</strong>'; if (s.it) h = '<em>' + h + '</em>'; out += h; }
            else if (ln === 'a') out += '<a href="' + esc(c.getAttributeNS(NS.xlink, 'href')) + '">' + inl(c) + '</a>';
            else if (ln === 'note') { var corpo = c.getElementsByTagNameNS(NS.text, 'note-body')[0]; notas.push(corpo ? blocos(corpo) : ''); var k = notas.length; out += '<sup><a href="#footnote-' + k + '" id="footnote-ref-' + k + '">[' + k + ']</a></sup>'; }
            else if (ln === 'frame') {
              var im = c.getElementsByTagNameNS(NS.draw, 'image')[0];
              if (im) { var href = im.getAttributeNS(NS.xlink, 'href'); var t = c.getElementsByTagNameNS(NS.svg, 'title')[0], d = c.getElementsByTagNameNS(NS.svg, 'desc')[0]; imgs.push(href); out += '<img data-odt="' + esc(href) + '" alt="' + esc(txt(d) || txt(t)) + '"/>'; }
              else out += inl(c);
            }
            else if (/^(bookmark|bookmark-start|bookmark-end|soft-page-break|annotation|annotation-end|reference-mark|sequence-decls)$/.test(ln)) { /* ignora */ }
            else out += inl(c);
          });
          return out;
        }
        function blocos(node) {
          var out = '';
          Array.prototype.forEach.call(node.childNodes, function (c) {
            if (c.nodeType !== 1) return;
            var ln = c.localName;
            if (ln === 'h') { var lv = Math.min(6, +(c.getAttributeNS(NS.text, 'outline-level') || 1)); out += '<h' + lv + '>' + inl(c) + '</h' + lv + '>'; }
            else if (ln === 'p') {
              var sn = nomeEstilo(c.getAttributeNS(NS.text, 'style-name') || ''), h = inl(c);
              if (/(^|\|)(TITLE|TITULO)(\||$)/.test(sn)) out += '<h1 class="titulo-doc">' + h + '</h1>';
              else if (/(^|\|)(SUBTITLE|SUBTITULO)(\||$)/.test(sn)) out += '<p class="subtitulo-doc">' + h + '</p>';
              else if (/QUOTATION|CITAC/.test(sn)) out += '<blockquote><p>' + h + '</p></blockquote>';
              else if (/CAPTION|LEGENDA/.test(sn)) out += '<p class="legenda">' + h + '</p>';
              else out += '<p>' + h + '</p>';
            }
            else if (ln === 'list') out += '<ul>' + Array.prototype.filter.call(c.childNodes, function (li) { return li.nodeType === 1 && /list-(item|header)/.test(li.localName); }).map(function (li) { return '<li>' + blocos(li) + '</li>'; }).join('') + '</ul>';
            else if (ln === 'table') out += '<table>' + Array.prototype.map.call(c.getElementsByTagNameNS(NS.table, 'table-row'), function (tr) { return '<tr>' + Array.prototype.filter.call(tr.childNodes, function (td) { return td.nodeType === 1 && td.localName === 'table-cell'; }).map(function (td) { return '<td>' + blocos(td) + '</td>'; }).join('') + '</tr>'; }).join('') + '</table>';
            else if (/^(section|list-item|list-header|table-header-rows)$/.test(ln)) out += blocos(c);
          });
          return out;
        }
        var corpoTexto = x.getElementsByTagNameNS(NS.office, 'text')[0];
        var html = corpoTexto ? blocos(corpoTexto) : '';
        if (notas.length) html += '<ol>' + notas.map(function (n, i) { return '<li id="footnote-' + (i + 1) + '">' + n + '</li>'; }).join('') + '</ol>';
        var meta = {};
        if (a[2]) { var m = new DOMParser().parseFromString(a[2], 'application/xml'); var t = m.getElementsByTagNameNS('http://purl.org/dc/elements/1.1/', 'title')[0]; var cr = m.getElementsByTagNameNS('http://purl.org/dc/elements/1.1/', 'creator')[0] || m.getElementsByTagNameNS('urn:oasis:names:tc:opendocument:xmlns:meta:1.0', 'initial-creator')[0]; if (t && txt(t)) meta.titulo = txt(t); if (cr && txt(cr)) meta.autor = txt(cr); }
        var unicas = imgs.filter(function (v, i) { return imgs.indexOf(v) === i; });
        return Promise.all(unicas.map(function (href) {
          var f = z.file(href.replace(/^\.\//, ''));
          if (!f) return null;
          return f.async('base64').then(function (b) { var ext = (href.split('.').pop() || '').toLowerCase(); var mime = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', svg: 'image/svg+xml', webp: 'image/webp', bmp: 'image/bmp', wmf: 'image/x-wmf', emf: 'image/x-emf', tif: 'image/tiff', tiff: 'image/tiff' }[ext] || 'application/octet-stream'; html = html.split('data-odt="' + esc(href) + '"').join('src="data:' + mime + ';base64,' + b + '"'); });
        })).then(function () { return { html: html, meta: meta, avisos: [] }; });
      });
  });
}

function mdInline(s, ctx) {
  s = esc(s);
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;[^&]*&quot;)?\)/g, function (m, alt, src) { return '<img src="' + src + '" alt="' + alt + '"/>'; });
  s = s.replace(/\[\^([^\]]+)\]/g, function (m, id) { var k = ctx.ordem.indexOf(id); if (k < 0) { ctx.ordem.push(id); k = ctx.ordem.length - 1; } k++; return '<sup><a href="#footnote-' + k + '" id="footnote-ref-' + k + '">[' + k + ']</a></sup>'; });
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');
  s = s.replace(/\*\*([^*]+)\*\*|__([^_]+)__/g, function (m, a, b) { return '<strong>' + (a || b) + '</strong>'; });
  s = s.replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?!\*)/g, '$1<em>$2</em>').replace(/(^|[^_\w])_([^_\s][^_]*?)_(?!\w)/g, '$1<em>$2</em>');
  return s;
}
function lerMd(texto) {
  var ctx = { ordem: [], defs: {} };
  var linhas = texto.replace(/\r\n?/g, '\n').split('\n'), out = [], i = 0, meta = {};
  if (/^---\s*$/.test(linhas[0] || '')) {
    var j = 1; while (j < linhas.length && !/^---\s*$/.test(linhas[j])) { var mm = /^(\w+)\s*:\s*(.+)$/.exec(linhas[j]); if (mm) meta[mm[1].toLowerCase()] = mm[2].replace(/^["']|["']$/g, ''); j++; }
    i = j + 1;
  }
  var resto = [];
  for (; i < linhas.length; i++) { var d = /^\[\^([^\]]+)\]:\s*(.*)$/.exec(linhas[i]); if (d) { var corpo = d[2]; while (i + 1 < linhas.length && /^\s{2,}\S/.test(linhas[i + 1])) corpo += ' ' + linhas[++i].trim(); ctx.defs[d[1]] = corpo; } else resto.push(linhas[i]); }
  linhas = resto; i = 0;
  while (i < linhas.length) {
    var l = linhas[i];
    if (!l.trim()) { i++; continue; }
    var h = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(l);
    if (h) { out.push('<h' + h[1].length + '>' + mdInline(h[2], ctx) + '</h' + h[1].length + '>'); i++; continue; }
    if (/^\s*([*\-_])(\s*\1){2,}\s*$/.test(l)) { out.push('<hr/>'); i++; continue; }
    if (/^>\s?/.test(l)) { var q = []; while (i < linhas.length && /^>\s?/.test(linhas[i])) { q.push(linhas[i].replace(/^>\s?/, '')); i++; } out.push('<blockquote>' + q.join('\n').split(/\n\s*\n/).map(function (p) { return '<p>' + mdInline(p.replace(/\n/g, ' '), ctx) + '</p>'; }).join('') + '</blockquote>'); continue; }
    if (/^\s*([-*+]|\d+[.)])\s+/.test(l)) {
      var ord = /^\s*\d/.test(l), it = [];
      while (i < linhas.length && /^\s*([-*+]|\d+[.)])\s+/.test(linhas[i])) { var item = linhas[i].replace(/^\s*([-*+]|\d+[.)])\s+/, ''); i++; while (i < linhas.length && /^\s{2,}\S/.test(linhas[i])) item += ' ' + linhas[i++].trim(); it.push('<li>' + mdInline(item, ctx) + '</li>'); }
      out.push((ord ? '<ol>' : '<ul>') + it.join('') + (ord ? '</ol>' : '</ul>')); continue;
    }
    if (/^\s*\|.*\|\s*$/.test(l) && /^\s*\|?\s*:?-{3,}/.test(linhas[i + 1] || '')) {
      var cel = function (r) { return r.trim().replace(/^\||\|$/g, '').split('|').map(function (c) { return c.trim(); }); };
      var cab = cel(l); i += 2; var rows = [];
      while (i < linhas.length && /^\s*\|.*\|\s*$/.test(linhas[i])) rows.push(cel(linhas[i++]));
      out.push('<table><thead><tr>' + cab.map(function (c) { return '<th>' + mdInline(c, ctx) + '</th>'; }).join('') + '</tr></thead><tbody>' + rows.map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + mdInline(c, ctx) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>');
      continue;
    }
    var par = [l]; i++;
    while (i < linhas.length && linhas[i].trim() && !/^(#{1,6}\s|>|\s*([-*+]|\d+[.)])\s+|\s*\|)/.test(linhas[i])) par.push(linhas[i++]);
    out.push('<p>' + mdInline(par.join(' ').trim(), ctx) + '</p>');
  }
  if (ctx.ordem.length) out.push('<ol>' + ctx.ordem.map(function (id, k) { return '<li id="footnote-' + (k + 1) + '"><p>' + mdInline(ctx.defs[id] || '', { ordem: [], defs: {} }) + '</p></li>'; }).join('') + '</ol>');
  return { html: out.join('\n'), meta: { titulo: meta.titulo || meta.title || '', autor: meta.autor || meta.author || '', subtitulo: meta.subtitulo || meta.subtitle || '' }, avisos: [] };
}
function lerTxt(texto) {
  texto = texto.replace(/\r\n?/g, '\n');
  var blocos = /\n\s*\n/.test(texto) ? texto.split(/\n\s*\n+/) : texto.split('\n');
  return { html: blocos.map(function (b) { b = b.replace(/\s*\n\s*/g, ' ').trim(); return b ? '<p>' + esc(b) + '</p>' : ''; }).join('\n'), meta: {}, avisos: [] };
}
function lerHtml(texto) {
  var d = new DOMParser().parseFromString(texto, 'text/html');
  var t = d.querySelector('title');
  return { html: d.body ? d.body.innerHTML : texto, meta: { titulo: t ? txt(t) : '' }, avisos: [] };
}
function decodificarTexto(buf) {
  var u = new Uint8Array(buf);
  try { return new TextDecoder('utf-8', { fatal: true }).decode(u); } catch (e) { return new TextDecoder('windows-1252').decode(u); }
}
function lerArquivo(file) {
  var ext = (file.name.split('.').pop() || '').toLowerCase();
  return file.arrayBuffer().then(function (buf) {
    if (ext === 'docx') return lerDocx(buf);
    if (ext === 'odt') return lerOdt(buf);
    if (ext === 'doc' || ext === 'rtf' || ext === 'pdf' || ext === 'pages') throw new Error('Formato .' + ext + ' não é aceito como manuscrito. Salve o arquivo como .docx (Word) ou .odt (LibreOffice) e envie de novo.');
    var t = decodificarTexto(buf);
    if (ext === 'md' || ext === 'markdown') return lerMd(t);
    if (ext === 'html' || ext === 'htm' || ext === 'xhtml') return lerHtml(t);
    return lerTxt(t);
  });
}

/* ───────────────────────── 2. LIMPEZA E ESTRUTURA ───────────────────────── */
var PERMITIDOS = { P: 1, H1: 1, H2: 1, H3: 1, H4: 1, H5: 1, H6: 1, BLOCKQUOTE: 1, UL: 1, OL: 1, LI: 1, EM: 1, STRONG: 1, SUP: 1, SUB: 1, A: 1, IMG: 1, TABLE: 1, THEAD: 1, TBODY: 1, TFOOT: 1, TR: 1, TH: 1, TD: 1, CAPTION: 1, BR: 1, HR: 1, CODE: 1, PRE: 1, SPAN: 1, SMALL: 1, DL: 1, DT: 1, DD: 1, U: 1, S: 1 };
function desembrulhar(el) { var p = el.parentNode; if (!p) return; while (el.firstChild) p.insertBefore(el.firstChild, el); p.removeChild(el); }
function sanitizar(body) {
  var doc = body.ownerDocument;
  body.querySelectorAll('script,style,iframe,object,embed,noscript,template,form,input,button,select,textarea,link,meta,svg,math,video,audio,canvas,head,title').forEach(function (e) { e.remove(); });
  Array.prototype.slice.call(body.querySelectorAll('*')).reverse().forEach(function (el) {
    var tn = el.tagName;
    if (tn === 'B' || tn === 'I') { var n = doc.createElement(tn === 'B' ? 'strong' : 'em'); while (el.firstChild) n.appendChild(el.firstChild); el.parentNode.replaceChild(n, el); el = n; tn = n.tagName; }
    if (tn === 'DIV' || tn === 'SECTION' || tn === 'ARTICLE' || tn === 'MAIN' || tn === 'HEADER' || tn === 'FOOTER' || tn === 'ASIDE' || tn === 'NAV' || tn === 'FIGURE') { desembrulhar(el); return; }
    if (tn === 'FIGCAPTION') { var p = doc.createElement('p'); p.className = 'legenda'; while (el.firstChild) p.appendChild(el.firstChild); el.parentNode.replaceChild(p, el); return; }
    if (!PERMITIDOS[tn]) { desembrulhar(el); return; }
    Array.prototype.slice.call(el.attributes).forEach(function (a) {
      var n = a.name, ok = (n === 'href' && tn === 'A') || (n === 'id' && (tn === 'A' || tn === 'LI')) ||
        ((n === 'src' || n === 'alt') && tn === 'IMG') || ((n === 'colspan' || n === 'rowspan') && (tn === 'TD' || tn === 'TH')) ||
        (n === 'class' && /^(titulo-doc|subtitulo-doc|legenda|epigrafe-p)$/.test(a.value)) || n === 'lang';
      if (!ok) el.removeAttribute(n);
    });
    if (tn === 'A' && !el.getAttribute('href')) { desembrulhar(el); return; }
    if (tn === 'A' && /^#_?(Toc|Ref|GoBack|bookmark)/i.test(el.getAttribute('href') || '')) { desembrulhar(el); return; }
    if (tn === 'SPAN' && !el.attributes.length) desembrulhar(el);
  });
  // textos soltos no corpo viram parágrafos; parágrafos vazios saem
  Array.prototype.slice.call(body.childNodes).forEach(function (n) {
    if (n.nodeType === 3) { if (n.nodeValue.trim()) { var p = doc.createElement('p'); p.textContent = n.nodeValue.trim(); body.replaceChild(p, n); } else body.removeChild(n); }
    else if (n.nodeType === 8) body.removeChild(n);
  });
  body.querySelectorAll('p,h1,h2,h3,h4,h5,h6,li').forEach(function (p) {
    while (p.lastChild && p.lastChild.nodeName === 'BR') p.removeChild(p.lastChild);
    if (!txt(p) && !p.querySelector('img')) p.remove();
  });
}
function extrairNotas(body) {
  var notas = {};
  body.querySelectorAll('li[id^="footnote-"],li[id^="endnote-"]').forEach(function (li) {
    li.querySelectorAll('a[href^="#footnote-ref-"],a[href^="#endnote-ref-"]').forEach(function (a) { a.remove(); });
    notas[li.id] = li.innerHTML.trim();
    var ol = li.parentNode; li.remove();
    if (ol && (ol.tagName === 'OL' || ol.tagName === 'UL') && !ol.children.length) ol.remove();
  });
  return notas;
}

var ESPECIAIS = [
  [/^(DEDICATORIA|DEDICACAO|DEDICATORIAS)$/, 'dedicatoria'], [/^AGRADECIMENTOS?$/, 'agradecimentos'], [/^EPIGRAFE$/, 'epigrafe'],
  [/^ERRATA$/, 'errata'], [/^PREFACIO$/, 'prefacio'], [/^APRESENTACAO$/, 'apresentacao'],
  [/^NOTA (DO|DA|DOS|DAS) (AUTOR|AUTORA|AUTORES|AUTORAS|EDITOR|EDITORA|EDITORES|ORGANIZADOR|ORGANIZADORA|ORGANIZADORES|ORGANIZADORAS)$/, 'prefacio'],
  [/^(SUMARIO|INDICE GERAL|CONTEUDO)$/, 'sumario-orig'], [/^LISTA DE /, 'lista-orig'],
  [/^POSFACIO$/, 'posfacio'], [/^(REFERENCIAS|REFERENCIAS BIBLIOGRAFICAS|BIBLIOGRAFIA|OBRAS CITADAS|BIBLIOGRAFIA CONSULTADA)$/, 'referencias'],
  [/^GLOSSARIO\b/, 'glossario'], [/^APENDICES?\b/, 'apendice'], [/^ANEXOS?\b/, 'anexo'],
  [/^INDICE( REMISSIVO| ONOMASTICO| DE ASSUNTOS)?$/, 'indice-orig'],
  [/^(NOTA |NOTAS )?SOBRE (O|A|OS|AS) (AUTOR|AUTORA|AUTORES|AUTORAS|ORGANIZADOR|ORGANIZADORA|ORGANIZADORES|ORGANIZADORAS|COLABORADORES|COLABORADORAS)$|^(OS )?AUTORES$|^QUEM ESCREVE$/, 'sobre']
];
var RX_NUM = /^\s*(\d+(?:\.\d+)*)\s*\.?\s*(?:[-–—:.]\s*)?(?=\S)/;
var RX_NUM_SEC = /^\s*(\d+(?:\.\d+)*)(-[A-Z])?\s*\.?\s+(?=\S)/;
var RX_CAP = /^\s*cap[ií]tulo\s+(\d+|[ivxlc]+)\b\s*(?:[-–—:.]\s*)?/i;
var RX_PARTE = /^\s*parte\s+(\d+|[ivxlc]+|primeira|segunda|terceira|quarta|quinta|sexta|s[eé]tima|oitava|nona|d[eé]cima|[úu]nica)\b\s*(?:[-–—:.]\s*)?/i;
function classificar(titulo) {
  var t = titulo.replace(RX_NUM, ''), n = N(t);
  for (var i = 0; i < ESPECIAIS.length; i++) if (ESPECIAIS[i][0].test(n)) return ESPECIAIS[i][1];
  if (RX_PARTE.test(titulo)) return 'parte';
  return 'capitulo';
}
var TITULO_CANONICO = { dedicatoria: 'Dedicatória', agradecimentos: 'Agradecimentos', epigrafe: 'Epígrafe', errata: 'Errata', prefacio: 'Prefácio', apresentacao: 'Apresentação', posfacio: 'Posfácio', referencias: 'Referências', glossario: 'Glossário', indice: 'Índice remissivo', sobre: 'Sobre a autoria' };

function detectarTitulos(body, A) {
  if (body.querySelector('h1,h2,h3,h4')) return;
  var n = 0;
  body.querySelectorAll(':scope > p').forEach(function (p) {
    var t = txt(p);
    if (!t || t.length > 110 || /[.;,:]$/.test(t) || p.querySelector('img')) return;
    var letras = t.replace(new RegExp('[^' + LETRA.slice(1, -1) + ']', 'g'), '');
    var caixaAlta = letras.length >= 3 && letras === letras.toUpperCase();
    var num = /^(\d+(?:\.\d+)*)\.?\s+\S/.exec(t);
    var especial = classificar(t) !== 'capitulo';
    if (!(caixaAlta || num || RX_CAP.test(t) || RX_PARTE.test(t) || especial)) return;
    var lv = num ? Math.min(4, num[1].split('.').length) : 1;
    var h = body.ownerDocument.createElement('h' + lv);
    while (p.firstChild) h.appendChild(p.firstChild);
    p.parentNode.replaceChild(h, p); n++;
  });
  if (n) A.add('info', 'Estrutura', n + ' título(s) identificados por heurística, pois o manuscrito não usa estilos de título. Confira o sumário gerado.', { norma: 'NBR 6024', sug: 'No Word, aplique os estilos "Título 1", "Título 2"… aos títulos para um resultado exato.' });
}
function ajustarNiveis(body, A) {
  var hs = body.querySelectorAll('h1,h2,h3,h4,h5,h6');
  if (!hs.length) return;
  var min = 6; hs.forEach(function (h) { min = Math.min(min, +h.tagName[1]); });
  if (min > 1) {
    hs.forEach(function (h) { var nv = body.ownerDocument.createElement('h' + (+h.tagName[1] - min + 1)); while (h.firstChild) nv.appendChild(h.firstChild); h.parentNode.replaceChild(nv, h); });
    A.corr('Hierarquia de títulos promovida (o manuscrito não tinha título de nível 1)');
  }
}

function segmentar(body, A) {
  var secs = [], cur = null, pre = [];
  Array.prototype.slice.call(body.children).forEach(function (n) {
    if (n.tagName === 'H1' || (!secs.some(function (x) { return x.hOrig && x.hOrig.tagName === 'H1'; }) && /^H[2-4]$/.test(n.tagName) && !/^(capitulo|parte)$/.test(classificar(txt(n))))) { cur = { tituloOrig: txt(n), hOrig: n, nos: [] }; secs.push(cur); return; }
    (cur ? cur.nos : pre).push(n);
  });
  var temConteudo = pre.some(function (n) { return txt(n) || (n.querySelector && n.querySelector('img')) || n.tagName === 'IMG'; });
  if (temConteudo) secs.unshift({ tituloOrig: '', nos: pre, tipo: 'abertura' });
  secs.forEach(function (s) { if (!s.tipo) s.tipo = classificar(s.tituloOrig); });
  return secs;
}


/* Elementos que o manuscrito traz antes do primeiro título: capa, folha de rosto,
   ficha catalográfica, direitos e epígrafe. Viram metadados; o motor recompõe tudo no padrão da Editora. */
function extrairPreliminares(sec, livro, A, doc) {
  var nos = sec.nos, meta = livro.meta, i = 0, usados = [];
  var plano = [];
  nos.forEach(function (n) { if (n.tagName === 'BLOCKQUOTE') Array.prototype.slice.call(n.children).forEach(function (c) { plano.push(c); }); else plano.push(n); });
  nos.length = 0; plano.forEach(function (n) { nos.push(n); });
  function t(n) { return n ? txt(n) : ''; }
  function caixaAlta(x) { var l = x.replace(/[^A-Za-zÀ-ÿ]/g, ''); return l.length >= 4 && l === l.toUpperCase(); }
  // capa
  while (i < nos.length && nos[i].tagName === 'P' && !t(nos[i]) && nos[i].querySelectorAll('img').length === 1) {
    if (!meta.capa) { meta.capa = nos[i].querySelector('img').getAttribute('src'); A.add('info', 'Estrutura', 'A imagem no início do manuscrito foi usada como capa do e-book.', { sug: 'Para usar a capa gerada no padrão da Editora, clique em “Usar capa gerada” na aba Dados da obra.' }); }
    usados.push(nos[i]); i++;
  }
  // folha de rosto do manuscrito
  var linhas = [];
  while (i < nos.length && nos[i].tagName === 'P') {
    var x = t(nos[i]), nx = N(x);
    if (!x) { usados.push(nos[i]); i++; continue; }
    if (x.length > 220 || /^(FICHA CATALOGRAFICA|DADOS INTERNACIONAIS)/.test(nx) || /^©/.test(x) || /^[“"«]/.test(x)) break;
    linhas.push({ el: nos[i], t: x }); i++;
  }
  if (linhas.length) {
    var run = 0; while (run < linhas.length && caixaAlta(linhas[run].t)) run++;
    if (run >= 1) {
      var tituloL = linhas[run - 1].t, autoresL = linhas.slice(0, run - 1).map(function (l) { return l.t; }).filter(function (x) { return !/\d/.test(x) && x.split(/\s+/).length >= 2 && x.split(/\s+/).length <= 8; });
      if (!meta.titulo) meta.titulo = tituloCaso(tituloL);
      if (autoresL.length && !meta.autores) meta.autores = autoresL.map(tituloCaso);
      var subs = [];
      linhas.slice(run).forEach(function (l) {
        if (/^\d{4}$/.test(l.t)) { meta.ano = l.t; return; }
        if (/^[A-ZÀ-Ý][^,]{2,40},\s*[A-ZÀ-Ý][^,]{1,30}$/.test(l.t) && l.t.length < 60) { meta.local = l.t; return; }
        if (/^(Obra|Livro|Pesquisa|Trabalho|Texto|Edi[cç][aã]o)\b/i.test(l.t)) { meta.nota = l.t; return; }
        subs.push(l.t.replace(/[.\s]+$/, ''));
      });
      if (subs.length && !meta.subtitulo) meta.subtitulo = subs.join('. ');
      linhas.forEach(function (l) { usados.push(l.el); });
      A.add('info', 'Estrutura', 'Folha de rosto do manuscrito lida e recomposta no padrão da Editora (título, autoria' + (subs.length ? ', subtítulo' : '') + (meta.local ? ', local' : '') + (meta.ano ? ', ano' : '') + ').', { norma: 'NBR 6029' });
    } else i -= linhas.length;
  }
  // ficha catalográfica do manuscrito
  if (i < nos.length && /^(FICHA CATALOGRAFICA|DADOS INTERNACIONAIS)/.test(N(t(nos[i])))) {
    var bloco = [];
    usados.push(nos[i]); i++;
    while (i < nos.length && nos[i].tagName === 'P' && !/^©/.test(t(nos[i])) && !/^[“"«]/.test(t(nos[i]))) { bloco.push(t(nos[i])); usados.push(nos[i]); i++; }
    var f = bloco.join('\n'), m, ficha = {};
    if ((m = /ISBN[:\s]*((?:97[89][\s\-]?)?[\d][\d\-\s]{8,16}[\dXx])/i.exec(f))) ficha.isbn = m[1].replace(/\s+/g, '');
    if ((m = /CDD[:\s]*([0-9][0-9.\/\-]*[0-9])/i.exec(f))) ficha.cdd = m[1];
    if ((m = /CDU[:\s]*([^\n]+?)(?=\s+CDD\b|\n|$)/i.exec(f))) ficha.cdu = m[1].trim();
    if ((m = /(?:^|\s)1\.\s+([\s\S]+?)(?=\s+I\.\s|\n|$)/.exec(f))) ficha.assuntos = ('1. ' + m[1]).split(/\s*\d+\.\s+/).map(function (x) { return x.replace(/\.$/, '').trim(); }).filter(Boolean);
    var linha1 = bloco[0] || '';
    if ((m = /^([A-Z]\d{2,3}[a-z]?)\s/.exec(linha1))) ficha.cutter = m[1];
    meta.ficha = ficha;
    A.add('info', 'Ficha', 'Dados da ficha catalográfica do manuscrito aproveitados (' + Object.keys(ficha).join(', ') + '). A ficha foi recomposta no padrão da Editora.', { norma: 'AACR2 / Lei 10.753/2003' });
  }
  // direitos autorais
  if (i < nos.length && /^©/.test(t(nos[i]))) { meta.direitos = t(nos[i]); usados.push(nos[i]); i++; }
  // epígrafe
  var epis = [];
  while (i < nos.length && nos[i].tagName === 'P' && /^[“"«]/.test(t(nos[i]))) { epis.push(nos[i]); usados.push(nos[i]); i++; if (i < nos.length && nos[i].tagName === 'P' && t(nos[i]).length < 120 && !/^[“"«]/.test(t(nos[i]))) { epis.push(nos[i]); usados.push(nos[i]); i++; } }
  usados.forEach(function (n) { var k = nos.indexOf(n); if (k >= 0) nos.splice(k, 1); });
  var resto = nos.some(function (n) { return t(n) || (n.querySelector && n.querySelector('img')); });
  if (resto) A.add('aviso', 'Estrutura', 'Há texto antes do primeiro título do manuscrito que não é folha de rosto, ficha nem epígrafe; ele foi mantido como seção de abertura, sem título.', { onde: 'Início do manuscrito', norma: 'NBR 6029', sug: 'Se for dedicatória ou apresentação, inicie o trecho com o título correspondente.' });
  var novas = [];
  if (epis.length) {
    var se = { tituloOrig: 'Epígrafe', nos: [], tipo: 'epigrafe' };
    epis.forEach(function (p) {
      var tx = p.textContent, fim = Math.max(tx.lastIndexOf('”'), tx.lastIndexOf('"'), tx.lastIndexOf('»'));
      var cauda = fim > 0 ? tx.slice(fim + 1).trim() : '';
      if (cauda && cauda.length < 160) { se.nos.push(el(doc, 'p', null, [tx.slice(0, fim + 1).trim()])); se.nos.push(el(doc, 'p', null, ['— ' + cauda.replace(/^[—–\-·]\s*/, '')])); }
      else se.nos.push(p);
    });
    novas.push(se);
  }
  return { resto: resto, novas: novas };
}

/* ───────────────────────── 3. TIPOGRAFIA ───────────────────────── */
var RX_ABRE = /[\s(\[{—–\/‘“ -]/;
function blocoDe(n, raiz) { var e = n.parentNode; while (e && e !== raiz && !/^(P|LI|H[1-6]|TD|TH|BLOCKQUOTE|CAPTION|DT|DD|FIGCAPTION)$/.test(e.tagName)) e = e.parentNode; return e; }
function tipografia(raiz, A) {
  var c = { aspas: 0, apostrofo: 0, retic: 0, trav: 0, inter: 0, esp: 0, ord: 0, pont: 0, tab: 0 };
  var w = raiz.ownerDocument.createTreeWalker(raiz, NodeFilter.SHOW_TEXT, null), n, blocoAnt = null, prev = '';
  var nos = []; while ((n = w.nextNode())) nos.push(n);
  nos.forEach(function (n) {
    if (n.parentNode.closest && n.parentNode.closest('code,pre')) return;
    var b = blocoDe(n, raiz);
    if (b !== blocoAnt) { prev = ''; blocoAnt = b; }
    var s = n.nodeValue, o = s;
    s = s.replace(/([a-zà-ÿA-ZÀ-Ý])\t([a-zà-ÿ])/g, function (m, a, b2) { c.tab++; return a + b2; }).replace(/\t/g, function () { c.tab++; return ' '; });
    s = s.replace(/[ \t ]{2,}/g, function (m) { c.esp++; return m.indexOf(' ') >= 0 ? ' ' : ' '; });
    if (prev === '' && /^\s+/.test(s)) s = s.replace(/^\s+/, '');
    s = s.replace(/(\S)\s+([,;:!?](?=\s|$)|\.(?=\s|$)(?!\.))/g, function (m, a, p) { if (/[.…]/.test(a)) return m; c.pont++; return a + p; });
    s = s.replace(/\.{3}(?!\.)/g, function () { c.retic++; return '…'; });
    if (prev === '') s = s.replace(/^-{1,2}\s+/, function () { c.trav++; return '— '; });
    s = s.replace(/(\S)\s+-{1,2}\s+(?=\S)/g, function (m, a, i, str) { var dep = str.charAt(i + m.length); if (/\d/.test(a) && /\d/.test(dep)) return m; c.trav++; return a + ' — '; });
    s = s.replace(/([A-Za-zÀ-ÿ])--([A-Za-zÀ-ÿ])/g, function (m, a, b2) { c.trav++; return a + '—' + b2; });
    s = s.replace(/\b(pp?\.)\s?(\d+)\s?-\s?(\d+)\b/g, function (m, p, a, b2) { c.inter++; return p + ' ' + a + '–' + b2; });
    s = s.replace(/\b((?:1[5-9]|20)\d{2})-((?:1[5-9]|20)\d{2})\b(?!-)/g, function (m, a, b2) { c.inter++; return a + '–' + b2; });
    s = s.replace(/\b(pp?\.) (\d)/g, '$1 $2');
    s = s.replace(/\b([nN])°(?=\s?\d)/g, function (m, a) { c.ord++; return a + 'º'; });
    var r = '';
    for (var i = 0; i < s.length; i++) {
      var ch = s[i], ant = i ? s[i - 1] : prev, dep = s[i + 1] || '';
      if (ch === '"') { c.aspas++; r += (!ant || RX_ABRE.test(ant)) ? '“' : '”'; }
      else if (ch === "'") {
        if (ant && /[A-Za-zÀ-ÿ0-9]/.test(ant) && /[A-Za-zÀ-ÿ]/.test(dep)) { c.apostrofo++; r += '’'; }
        else { c.aspas++; r += (!ant || RX_ABRE.test(ant)) ? '‘' : '’'; }
      } else r += ch;
    }
    s = r;
    if (s !== o) n.nodeValue = s;
    if (s) prev = s[s.length - 1];
  });
  A.corr('Aspas retas convertidas em aspas tipográficas', c.aspas);
  A.corr('Apóstrofos tipográficos', c.apostrofo);
  A.corr('Reticências normalizadas (…)', c.retic);
  A.corr('Hífens convertidos em travessão (—) em incisos e diálogos', c.trav);
  A.corr('Intervalos numéricos com meia-risca (–)', c.inter);
  A.corr('Espaços duplos removidos', c.esp);
  A.corr('Tabulações e quebras espúrias removidas do texto', c.tab);
  A.corr('Espaço indevido antes de pontuação removido', c.pont);
  A.corr('Símbolo de grau trocado por ordinal (nº)', c.ord);
}

/* ───────────────────────── 4. CITAÇÕES E REFERÊNCIAS ───────────────────────── */
var RX_ANO = /\b(1[5-9]\d{2}|20\d{2})([a-z])?\b/g;
function chaveAutor(s) {
  s = String(s || '').replace(/\bet al\.?/i, '').split(/;|\s+e\s+|\s+&\s+/)[0];
  return N(s).replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}
function extrairCitacoes(texto) {
  var cit = [], m;
  var rp = /\(([^()]{2,400}?\b(?:1[5-9]\d{2}|20\d{2})[a-z]?[^()]*)\)/g;
  while ((m = rp.exec(texto))) {
    var pend = [];
    m[1].split(/;/).forEach(function (pedaco) {
      var p = /^\s*([^,\d][^,\d:]{0,120}?),\s*((?:1[5-9]\d{2}|20\d{2})[a-z]?)\b/.exec(pedaco);
      if (p) {
        var autor = (pend.length ? pend[0] : p[1]).trim().replace(/^(ver|vide|cf\.?|apud|conforme|segundo|in)\s+/i, ''); pend = [];
        if (!/^(p|pp|v|n|art|cf|apud)\.?$/i.test(autor) && /^[A-ZÀ-Ý]/.test(autor) && !/[:;]/.test(autor) && autor.split(/\s+/).length <= 8) cit.push({ autor: autor, chave: chaveAutor(autor), ano: p[2], tipo: 'parentetica', caixa: /[a-zà-ÿ]/.test(autor.replace(/et al\.?/i, '')) ? 'mista' : 'alta' });
      } else if (pedaco.trim() && !/\d/.test(pedaco)) pend.push(pedaco);
    });
  }
  var rn = new RegExp("(?:^|[^A-Za-zÀ-ÿ])([A-ZÀ-Ý][A-Za-zÀ-ÿ'’\\-]+(?:\\s+(?:et al\\.|e\\s+[A-ZÀ-Ý][A-Za-zÀ-ÿ'’\\-]+))?)\\s+\\(((?:1[5-9]\\d{2}|20\\d{2})[a-z]?)(?:,\\s*p\\.?\\s*[\\d\\-–]+)?\\)", 'g');
  while ((m = rn.exec(texto))) {
    var antes = texto.slice(Math.max(0, m.index - 40), m.index + (m[0].length - m[0].replace(/^[^A-ZÀ-Ý]*/, '').length)).trim().split(/\s+/);
    var ant = antes[antes.length - 1] || '', ant2 = antes[antes.length - 2] || '';
    if (/^[A-ZÀ-Ý]/.test(ant) || (/^(de|da|do|das|dos|e|sobre)$/.test(ant) && /^[A-ZÀ-Ý]/.test(ant2)) || /[’”']$/.test(m[1]) || /[a-zà-ÿ][A-Z]/.test(m[1])) continue;
    cit.push({ autor: m[1], chave: chaveAutor(m[1]), ano: m[2], tipo: 'narrativa' });
  }
  return cit;
}
function sigla(s) { return N(s).split(' ').filter(function (w) { return w && !/^(DE|DA|DO|DAS|DOS|E|PARA|EM|A|O|AS|OS)$/.test(w); }).map(function (w) { return w[0]; }).join(''); }
function chaveRef(texto, anterior) {
  var t = texto.trim();
  if (/^_{3,}/.test(t)) return anterior || '';
  var m = /^([^,.]{1,160}?)[,.]/.exec(t);
  return m ? chaveAutor(m[1]) : chaveAutor(t.split(' ')[0]);
}
function anosRef(texto) {
  var antes = texto.split(/Dispon[ií]vel em|Acesso em/i)[0], anos = [], m;
  RX_ANO.lastIndex = 0;
  while ((m = RX_ANO.exec(antes))) anos.push(m[1] + (m[2] || ''));
  return anos;
}
function casaCitacao(c, refs) {
  return refs.some(function (r) {
    var k = r.chave, ok = (r.palavras && c.chave.indexOf(' ') < 0 && r.palavras.indexOf(c.chave) >= 0) || k === c.chave || k.split(' ')[0] === c.chave.split(' ')[0] || sigla(k) === c.chave.replace(/ /g, '') || k.indexOf(c.chave) === 0 || k.split(' ').indexOf(c.chave) >= 0;
    if (!ok) return false;
    return r.anos.some(function (a) { return a === c.ano || a.replace(/[a-z]$/, '') === c.ano; });
  });
}
function processarRefs(nos, A, onde, doc) {
  // nós = elementos contíguos da seção de referências
  var itens = [], grupoAtual = [], grupos = [grupoAtual], anteriorChave = '';
  nos.forEach(function (n) {
    if (/^H[2-6]$/.test(n.tagName)) { grupoAtual = []; grupos.push(grupoAtual); grupoAtual.cab = n; return; }
    var lista = (n.tagName === 'UL' || n.tagName === 'OL') ? Array.prototype.slice.call(n.children) : [n];
    lista.forEach(function (el) {
      if (!txt(el)) return;
      var p = el;
      if (el.tagName !== 'P') { p = doc.createElement('p'); while (el.firstChild) p.appendChild(el.firstChild); }
      p.className = 'ref';
      grupoAtual.push(p);
    });
  });
  var foraOrdem = 0, caixaFix = 0, semAno = 0, semAcesso = 0, semDestaque = 0, sd = 0, destaques = {};
  grupos.forEach(function (g) {
    g.forEach(function (p) {
      var t = txt(p);
      // sobrenome em caixa alta (NBR 6023)
      var primeiro = p.firstChild;
      if (primeiro && primeiro.nodeType === 3) {
        var m = /^(\s*)([A-Za-zÀ-ÿ][A-Za-zà-ÿ'’\-]+(?:\s+(?:[A-Za-zÀ-ÿ][a-zà-ÿ'’\-]+|J[uú]nior|Filho|Neto|Sobrinho))?)(,\s)/.exec(primeiro.nodeValue);
        if (m && !/\d/.test(m[2]) && m[2] !== m[2].toUpperCase() && !/^(de|da|do|in|apud)$/i.test(m[2])) { primeiro.nodeValue = m[1] + m[2].toUpperCase() + m[3] + primeiro.nodeValue.slice(m[0].length); caixaFix++; t = txt(p); }
      }
      var chave = chaveRef(t, anteriorChave); anteriorChave = chave;
      var anos = anosRef(t);
      if (!anos.length) { semAno++; if (/\[s\.\s?d\.\]/i.test(t)) sd++; A.add('grave', 'Referências', 'Referência sem ano de publicação: “' + t.slice(0, 90) + (t.length > 90 ? '…' : '') + '”.', { onde: onde, norma: 'NBR 6023', sug: 'Indique o ano; se desconhecido, use data provável entre colchetes, por exemplo [1990?] ou [199-].' }); }
      if (/(https?:\/\/|www\.)/i.test(t) && !(/Dispon[ií]vel em\s*:/i.test(t) && /Acesso em\s*:/i.test(t))) { semAcesso++; A.add('grave', 'Referências', 'Documento on-line sem “Disponível em:” e “Acesso em:”: “' + t.slice(0, 90) + '…”.', { onde: onde, norma: 'NBR 6023', sug: 'Acrescente: Disponível em: <endereço>. Acesso em: dia mês abreviado ano.' }); }
      var d = p.querySelector('strong,b') ? 'negrito' : p.querySelector('em,i') ? 'italico' : '';
      if (d) destaques[d] = (destaques[d] || 0) + 1; else if (!/^_{3,}/.test(t) && t.length > 40) semDestaque++;
      itens.push({ el: p, chave: chave, anos: anos, texto: t, palavras: N(t.split(/Dispon[ií]vel em/i)[0]).replace(/[^A-Z0-9 ]/g, ' ').split(/\s+/) });
      p._ordem = N(/^_{3,}/.test(t) ? (chave + ' ' + t.replace(/^_+\.?/, '')) : t);
    });
    var ord = g.slice().sort(function (a, b) { return a._ordem.localeCompare(b._ordem, 'pt'); });
    for (var i = 0; i < g.length; i++) if (g[i] !== ord[i]) foraOrdem++;
    g.ordenado = ord;
  });
  if (caixaFix) A.corr('Sobrenomes de entrada das referências passados para MAIÚSCULAS (NBR 6023)', caixaFix);
  if (foraOrdem) A.corr('Referências reordenadas alfabeticamente (NBR 6023, sistema alfabético)', foraOrdem);
  if (semDestaque) A.add('aviso', 'Referências', semDestaque + ' referência(s) sem destaque tipográfico no título (negrito ou itálico).', { onde: onde, norma: 'NBR 6023', sug: 'Destaque o título principal de cada obra, sempre com o mesmo recurso.' });
  if (destaques.negrito && destaques.italico) A.add('aviso', 'Referências', 'Destaque misturado nas referências: ' + destaques.negrito + ' em negrito e ' + destaques.italico + ' em itálico.', { onde: onde, norma: 'NBR 6023', sug: 'Use um único recurso de destaque em todas as referências.' });
  if (sd) A.add('aviso', 'Referências', 'Uso de “[s.d.]” em ' + sd + ' referência(s). A norma pede data, ainda que aproximada.', { onde: onde, norma: 'NBR 6023' });
  return { itens: itens, grupos: grupos };
}

/* ───────────────────────── 5. MONTAGEM DO LIVRO ───────────────────────── */
var TIPOS = {
  abertura: { et: 'chapter', role: 'doc-chapter', parte: 'body', sum: true },
  errata: { et: 'errata', role: 'doc-errata', parte: 'front' },
  dedicatoria: { et: 'dedication', role: 'doc-dedication', parte: 'front', semTitulo: true },
  agradecimentos: { et: 'acknowledgments', role: 'doc-acknowledgments', parte: 'front' },
  epigrafe: { et: 'epigraph', role: '', parte: 'front', semTitulo: true },
  apresentacao: { et: 'foreword', role: 'doc-foreword', parte: 'front', sum: true },
  prefacio: { et: 'preface', role: 'doc-preface', parte: 'front', sum: true },
  parte: { et: 'part', role: 'doc-part', parte: 'body', sum: true },
  capitulo: { et: 'chapter', role: 'doc-chapter', parte: 'body', sum: true },
  posfacio: { et: 'afterword', role: 'doc-afterword', parte: 'back', sum: true },
  referencias: { et: 'bibliography', role: 'doc-bibliography', parte: 'back', sum: true },
  glossario: { et: 'glossary', role: 'doc-glossary', parte: 'back', sum: true },
  apendice: { et: 'appendix', role: 'doc-appendix', parte: 'back', sum: true },
  anexo: { et: 'appendix', role: 'doc-appendix', parte: 'back', sum: true },
  sobre: { et: 'contributors', role: '', parte: 'back', sum: true }
};
var ORDEM_PRE = ['errata', 'dedicatoria', 'agradecimentos', 'epigrafe'];
var ORDEM_POS = ['posfacio', 'referencias', 'glossario', 'apendice', 'anexo'];

function novoDoc() { return document.implementation.createHTMLDocument('livro'); }
function el(doc, tag, attrs, filhos) {
  var e = doc.createElement(tag);
  if (attrs) Object.keys(attrs).forEach(function (k) { if (attrs[k] != null && attrs[k] !== false) e.setAttribute(k, attrs[k]); });
  (filhos || []).forEach(function (f) { if (f == null) return; e.appendChild(typeof f === 'string' ? doc.createTextNode(f) : f); });
  return e;
}

async function processar(entrada, opcoes, progresso) {
  var A = new Auditoria(), t0 = performance.now();
  var etapa = progresso || function () {};
  var doc = novoDoc(), body = doc.body;
  body.innerHTML = entrada.html;
  (entrada.avisos || []).slice(0, 12).forEach(function (m) {
    if (/Unrecognised (paragraph|run) style/i.test(m)) return;
    A.add('info', 'Ingestão', 'Conversor: ' + m, { norma: '' });
  });
  var naoReconhecidos = (entrada.avisos || []).filter(function (m) { return /Unrecognised (paragraph|run) style/i.test(m); });
  if (naoReconhecidos.length) A.add('info', 'Ingestão', naoReconhecidos.length + ' estilo(s) do Word sem correspondência editorial foram tratados como texto comum.', { sug: naoReconhecidos.slice(0, 4).map(function (m) { var x = /'([^']+)'/.exec(m); return x ? x[1] : m; }).join(', ') });

  /* notas, limpeza, metadados do próprio manuscrito */
  var notas = extrairNotas(body);
  var tocRem = 0;
  body.querySelectorAll('p').forEach(function (p) {
    var as = p.querySelectorAll('a[href]');
    if (as.length && Array.prototype.every.call(as, function (a) { return /^#_?Toc/i.test(a.getAttribute('href')); })) {
      var ant = p.previousElementSibling;
      if (!tocRem && ant && /^(SUMARIO|INDICE|CONTEUDO|TABLE OF CONTENTS|CONTENTS)$/.test(N(txt(ant)))) ant.remove();
      p.remove(); tocRem++;
    }
  });
  var RX_ITEM_SUM = /(,\s*p\.\s*\d+|\.{4,}\s*\d+|\t\s*\d+)\s*$/;
  body.querySelectorAll('p,h1,h2,h3,h4').forEach(function (p) {
    if (!p.parentNode || !/^(SUMARIO|INDICE|CONTEUDO)$/.test(N(txt(p)))) return;
    var itens = [], n = p.nextElementSibling, falhas = 0;
    while (n && n.tagName === 'P' && falhas < 2) { if (RX_ITEM_SUM.test(n.textContent)) { itens.push(n); falhas = 0; } else if (txt(n).length < 160 && itens.length) { itens.push(n); falhas++; } else break; n = n.nextElementSibling; }
    while (itens.length && !RX_ITEM_SUM.test(itens[itens.length - 1].textContent)) itens.pop();
    if (itens.length >= 3) { itens.forEach(function (x) { x.remove(); }); p.remove(); tocRem += itens.length; }
  });
  if (tocRem) A.corr('Sumário do manuscrito removido (' + tocRem + ' linhas, com números de página) e regerado conforme NBR 6027');
  sanitizar(body);
  var meta = clone(entrada.meta || {});
  var td = body.querySelector('.titulo-doc');
  if (td) { meta.titulo = txt(td) || meta.titulo; td.remove(); }
  body.querySelectorAll('.titulo-doc').forEach(function (h) { h.removeAttribute('class'); });
  var sd = body.querySelector('.subtitulo-doc');
  if (sd) { meta.subtitulo = txt(sd); sd.remove(); }
  detectarTitulos(body, A);
  ajustarNiveis(body, A);
  var h0 = body.firstElementChild, h0b = h0 && h0.nextElementSibling;
  if (!meta.titulo && h0 && h0.tagName === 'H1' && h0b && h0b.tagName === 'H1' && classificar(txt(h0)) === 'capitulo' && !RX_CAP.test(txt(h0)) && !/^\s*\d/.test(txt(h0))) {
    meta.titulo = txt(h0); h0.remove();
    A.add('info', 'Estrutura', 'O primeiro título do manuscrito (“' + meta.titulo + '”) foi tratado como título da obra.', { sug: 'Confira o título na aba “Dados da obra”.' });
  }
  etapa('estrutura', 'ok');

  /* tipografia */
  tipografia(body, A);
  etapa('tipografia', 'ok');

  /* segmentação em seções */
  var secs = segmentar(body, A);
  if (!secs.length) throw new Error('O manuscrito está vazio.');
  var livro = { secoes: [], notas: notas, meta: meta, A: A, imagens: [], ilustracoes: [], tabelas: [], siglas: [], termosIndice: [], refsGlobais: null, opcoes: opcoes };
  var idc = 0; function nid(p) { return p + '-' + (++idc); }
  var ab = secs[0] && secs[0].tipo === 'abertura' ? secs[0] : null;
  if (ab) {
    var pr = extrairPreliminares(ab, livro, A, doc);
    if (!pr.resto) secs.shift();
    var pos = pr.resto ? 1 : 0;
    pr.novas.forEach(function (n) { if (!secs.some(function (x) { return x.tipo === n.tipo; })) secs.splice(pos++, 0, n); });
  }

  // seções descartadas (o motor gera as suas)
  secs = secs.filter(function (s) {
    if (s.tipo === 'sumario-orig') { A.corr('Sumário do manuscrito descartado e regerado conforme NBR 6027'); return false; }
    if (s.tipo === 'lista-orig') {
      if (/ABREVIATURA|SIGLA/.test(N(s.tituloOrig))) {
        var sg = [];
        s.nos.forEach(function (n) { (n.tagName === 'UL' || n.tagName === 'OL' || n.tagName === 'TABLE' ? Array.prototype.slice.call(n.querySelectorAll('li,tr')) : [n]).forEach(function (x) { var m = /^([A-ZÀ-Ý][A-Za-zÀ-Ý0-9\/\-.&]{1,15})\s*[–—:\-]?\s+(.{3,})$/.exec(txt(x)); if (m && /[A-Z]{2}/.test(m[1])) sg.push({ sigla: m[1], nome: m[2].trim() }); }); });
        if (sg.length) { livro.siglasAutor = sg; A.corr('Lista de abreviaturas e siglas do manuscrito recomposta em ordem alfabética', sg.length); return false; }
      }
      A.corr('Lista do manuscrito descartada e regerada automaticamente'); return false;
    }
    if (s.tipo === 'indice-orig') {
      var termos = [];
      s.nos.forEach(function (n) { (n.tagName === 'UL' || n.tagName === 'OL' ? Array.prototype.slice.call(n.children) : [n]).forEach(function (li) { var m = /^(.+?)[\s.,…]+\d/.exec(txt(li)); if (m && m[1].length < 60) termos.push(m[1].trim()); }); });
      livro.termosIndice = termos;
      A.add('aviso', 'Índice', 'O índice do manuscrito usava números de página, que não existem no livro digital. Foi substituído por índice com links (' + termos.length + ' termos aproveitados).', { norma: 'NBR 6034' });
      return false;
    }
    return true;
  });

  /* modo de numeração dos capítulos (NBR 6024) */
  var caps = secs.filter(function (s) { return s.tipo === 'capitulo'; });
  var nNum = caps.filter(function (s) { return RX_NUM.test(s.tituloOrig) && /^\s*\d/.test(s.tituloOrig); }).length;
  var nCap = caps.filter(function (s) { return RX_CAP.test(s.tituloOrig); }).length;
  var modo = opcoes.numeracao === 'abnt' ? 'abnt' : opcoes.numeracao === 'nenhuma' ? 'livre' : opcoes.numeracao === 'capitulo' ? 'capitulo' :
    (caps.length && nNum >= caps.length / 2 ? 'abnt' : caps.length && nCap >= caps.length / 2 ? 'capitulo' : 'livre');
  livro.modo = modo;
  if (modo === 'capitulo') {
    var hsCap = [], hsNum = 0;
    secs.filter(function (s) { return s.tipo === 'capitulo' && RX_CAP.test(s.tituloOrig); }).forEach(function (s) { s.nos.forEach(function (n) { if (n.tagName === 'H2') { hsCap.push(n); if (RX_NUM_SEC.test(txt(n))) hsNum++; } }); });
    livro.renumerarSecoes = hsCap.length > 0 && hsNum >= hsCap.length / 2;
  }

  var nCapitulo = 0, nParte = 0, numAjust = 0, sepAjust = 0, apLetra = { apendice: 0, anexo: 0 };
  secs.forEach(function (s, iS) {
    var tipo = s.tipo, def = TIPOS[tipo] || TIPOS.capitulo;
    var sec = { tipo: tipo, def: def, id: nid(tipo === 'capitulo' ? 'cap' : tipo), titulo: '', tituloOrig: s.tituloOrig, rotulo: '', numero: '', autoria: '', cont: el(doc, 'div'), subtitulos: [] };
    var titulo = s.tituloOrig;
    if (tipo === 'capitulo' || tipo === 'abertura') {
      if (modo === 'abnt' && tipo === 'capitulo') {
        var mN = /^\s*(\d+)/.exec(titulo);
        nCapitulo++;
        if (mN && +mN[1] !== nCapitulo) numAjust++;
        if (/^\s*\d+\s*[.\-–—:]/.test(titulo)) sepAjust++;
        titulo = titulo.replace(RX_CAP, '').replace(RX_NUM, '').trim();
        sec.numero = String(nCapitulo); sec.nCap = nCapitulo;
      } else if (modo === 'capitulo' && tipo === 'capitulo') {
        var mC = RX_CAP.exec(titulo);
        if (mC || !caps.some(function (c) { return RX_CAP.test(c.tituloOrig); })) {
          nCapitulo++;
          if (mC) { if (numeroDe(mC[1]) !== nCapitulo) numAjust++; titulo = titulo.replace(RX_CAP, '').trim(); }
          sec.rotulo = 'Capítulo ' + nCapitulo; sec.nCap = nCapitulo;
          if (!titulo) { titulo = sec.rotulo; sec.rotulo = ''; }
        } else if (caixaAltaTit(titulo)) titulo = tituloCaso(titulo);
      }
    } else if (tipo === 'parte') {
      nParte++;
      var mP = RX_PARTE.exec(titulo);
      titulo = titulo.replace(RX_PARTE, '').trim();
      sec.rotulo = 'Parte ' + romano(nParte);
      if (!titulo) { titulo = sec.rotulo; sec.rotulo = ''; }
    } else if (tipo === 'apendice' || tipo === 'anexo') {
      var t2 = titulo.replace(RX_NUM, '');
      var mA = /^\s*(ap[eê]ndices?|anexos?)\s*([A-Z])?\s*(?:[-–—:.]\s*)?(.*)$/i.exec(t2);
      apLetra[tipo]++;
      var letra = (mA && mA[2]) ? mA[2].toUpperCase() : String.fromCharCode(64 + apLetra[tipo]);
      var resto = mA ? mA[3].trim() : '';
      titulo = (tipo === 'apendice' ? 'APÊNDICE ' : 'ANEXO ') + letra + (resto ? ' – ' + resto : '');
      sec.letra = letra;
      if (N(titulo) !== N(t2)) A.corr('Títulos de apêndices e anexos padronizados (letra maiúscula + travessão)');
    } else if (tipo === 'sobre') {
      titulo = titulo.replace(RX_NUM, '').trim();
    } else if (tipo === 'glossario' && N(titulo) !== 'GLOSSARIO') {
      titulo = tituloCaso(titulo.replace(RX_NUM, '').trim());
    } else if (TITULO_CANONICO[tipo]) {
      if (N(titulo.replace(RX_NUM, '')) !== N(TITULO_CANONICO[tipo]) && tipo === 'referencias') A.corr('Título “' + titulo + '” substituído por “Referências” (NBR 6023)');
      titulo = TITULO_CANONICO[tipo];
      if (RX_NUM.test(s.tituloOrig) && /^\s*\d/.test(s.tituloOrig)) A.corr('Indicativo numérico removido de título pré/pós-textual (NBR 6024)');
    }
    sec.titulo = titulo || (tipo === 'abertura' ? 'Abertura' : 'Sem título');
    s.nos.forEach(function (n) { sec.cont.appendChild(n); });

    // autoria do capítulo (coletâneas): "Autoria: Nome; Nome"
    var pa = sec.cont.firstElementChild;
    if (pa && pa.tagName === 'P' && /^(autoria|autor(a|es|as)?)\s*:/i.test(txt(pa))) { sec.autoria = txt(pa).replace(/^[^:]+:\s*/, ''); pa.remove(); }

    // subtítulos internos: hierarquia e numeração progressiva
    var cont = [0, 0, 0, 0, 0, 0, 0], ant = 1, ultInd = [];
    var renumCap = modo === 'capitulo' && sec.nCap && livro.renumerarSecoes;
    sec.cont.querySelectorAll('h2,h3,h4,h5,h6').forEach(function (h) {
      var lv = +h.tagName[1];
      if (lv > ant + 1) { lv = ant + 1; A.corr('Níveis de título corrigidos (salto de hierarquia)'); }
      ant = lv;
      var t = txt(h);
      if (/^(REFERENCIAS|REFERENCIAS BIBLIOGRAFICAS|BIBLIOGRAFIA)( D[OA] CAPITULO.*| D[OA]S? (AUTOR|AUTORA|AUTORES))?$/.test(N(t.replace(RX_NUM, '')))) { lv = 2; h.setAttribute('data-ref', '1'); }
      var nh = doc.createElement('h' + lv); nh.id = nid('h');
      var mSuf = renumCap ? RX_NUM_SEC.exec(t) : null;
      if (renumCap && mSuf && !h.hasAttribute('data-ref')) {
        var ind2;
        if (mSuf[2]) ind2 = (ultInd[lv] || [sec.nCap].concat(cont.slice(2, lv + 1)).join('.')) + mSuf[2];
        else { cont[lv]++; for (var k2 = lv + 1; k2 < 7; k2++) cont[k2] = 0; ind2 = [sec.nCap].concat(cont.slice(2, lv + 1)).join('.'); ultInd[lv] = ind2; }
        if (mSuf[1] + (mSuf[2] || '') !== ind2) numAjust++;
        while (h.firstChild) nh.appendChild(h.firstChild);
        var tw2 = doc.createTreeWalker(nh, NodeFilter.SHOW_TEXT, null), tn2 = tw2.nextNode();
        if (tn2) tn2.nodeValue = tn2.nodeValue.replace(RX_NUM_SEC, '');
        nh.insertBefore(el(doc, 'span', { 'class': 'indicativo' }, [ind2]), nh.firstChild);
        nh.setAttribute('data-ind', ind2);
      } else if (modo === 'abnt' && tipo === 'capitulo' && !h.hasAttribute('data-ref')) {
        cont[lv]++; for (var k = lv + 1; k < 7; k++) cont[k] = 0;
        var ind = [sec.numero].concat(cont.slice(2, lv + 1)).join('.');
        var mm = /^\s*(\d+(?:\.\d+)*)/.exec(t);
        if (mm && mm[1] !== ind) numAjust++;
        while (h.firstChild) nh.appendChild(h.firstChild);
        // remove o indicativo antigo do primeiro nó de texto
        var tw = doc.createTreeWalker(nh, NodeFilter.SHOW_TEXT, null), tn = tw.nextNode();
        if (tn) tn.nodeValue = tn.nodeValue.replace(RX_NUM, '');
        nh.insertBefore(el(doc, 'span', { 'class': 'indicativo' }, [ind]), nh.firstChild);
        nh.setAttribute('data-ind', ind);
      } else {
        while (h.firstChild) nh.appendChild(h.firstChild);
        if (h.hasAttribute('data-ref')) { nh.setAttribute('data-ref', '1'); if (/^(REFERENCIAS|REFERENCIAS BIBLIOGRAFICAS|BIBLIOGRAFIA)$/.test(N(txt(nh)))) nh.textContent = 'Referências'; }
      }
      h.parentNode.replaceChild(nh, h);
      if (lv <= 3) sec.subtitulos.push({ id: nh.id, nivel: lv, ind: nh.getAttribute('data-ind') || '', texto: txt(nh).replace(/^\d+(\.\d+)*\s*/, '') });
      nh.removeAttribute('data-ind');
    });
    livro.secoes.push(sec);
  });
  if (numAjust) A.corr('Indicativos numéricos renumerados em sequência (NBR 6024)', numAjust);
  if (sepAjust) A.corr('Ponto/hífen após o indicativo numérico removido (NBR 6024)', sepAjust);
  if (modo === 'abnt') A.add('info', 'Estrutura', 'Numeração progressiva aplicada (NBR 6024): capítulos e seções numerados em algarismos arábicos.', { norma: 'NBR 6024' });

  /* dedicatória e epígrafe informadas no formulário */
  if (opcoes.dedicatoria && !livro.secoes.some(function (s) { return s.tipo === 'dedicatoria'; })) {
    var sdd = { tipo: 'dedicatoria', def: TIPOS.dedicatoria, id: nid('dedicatoria'), titulo: 'Dedicatória', cont: el(doc, 'div'), subtitulos: [] };
    opcoes.dedicatoria.split(/\n+/).forEach(function (l) { if (l.trim()) sdd.cont.appendChild(el(doc, 'p', null, [l.trim()])); });
    livro.secoes.unshift(sdd);
  }
  if (opcoes.epigrafe && !livro.secoes.some(function (s) { return s.tipo === 'epigrafe'; })) {
    var se = { tipo: 'epigrafe', def: TIPOS.epigrafe, id: nid('epigrafe'), titulo: 'Epígrafe', cont: el(doc, 'div'), subtitulos: [] };
    opcoes.epigrafe.split(/\n+/).forEach(function (l) { if (l.trim()) se.cont.appendChild(el(doc, 'p', null, [l.trim()])); });
    livro.secoes.unshift(se);
  }

  /* epígrafe: última linha iniciada por travessão é a autoria */
  livro.secoes.filter(function (s) { return s.tipo === 'epigrafe'; }).forEach(function (s) {
    var ps = s.cont.querySelectorAll('p'), u = ps[ps.length - 1];
    if (u && /^[—–-]/.test(txt(u)) || u && /^\(?[A-ZÀ-Ý][A-ZÀ-Ý ]+,\s*\d{4}/.test(txt(u))) u.className = 'autor-epigrafe';
  });

  /* ordena: pré-textuais na ordem da NBR 6029, textuais, pós-textuais */
  function peso(s) {
    var i = ORDEM_PRE.indexOf(s.tipo); if (i >= 0) return 100 + i;
    if (s.tipo === 'apresentacao') return 200; if (s.tipo === 'prefacio') return 210;
    i = ORDEM_POS.indexOf(s.tipo); if (i >= 0) return 900 + i * 10;
    if (s.tipo === 'sobre') return 990;
    return 500;
  }
  livro.secoes.forEach(function (s, i) { s._i = i; });
  var antes = livro.secoes.map(function (s) { return s.id; }).join();
  livro.secoes.sort(function (a, b) { return peso(a) - peso(b) || a._i - b._i; });
  if (livro.secoes.map(function (s) { return s.id; }).join() !== antes) A.corr('Seções reordenadas na sequência pré-textual, textual e pós-textual (NBR 6029)');
  etapa('abnt', 'ok');

  /* citações longas (NBR 10520) */
  var cl = 0, aspasRet = 0, longasNaoTratadas = 0;
  livro.secoes.forEach(function (s) {
    if (s.tipo === 'referencias' || s.tipo === 'epigrafe') return;
    s.cont.querySelectorAll('blockquote').forEach(function (b) {
      b.className = 'citacao-longa';
      var ps = b.querySelectorAll('p'); if (!ps.length) return;
      var f = ps[0], l = ps[ps.length - 1];
      if (f.firstChild && f.firstChild.nodeType === 3 && /^\s*[“"«]/.test(f.firstChild.nodeValue)) {
        var tw = doc.createTreeWalker(l, NodeFilter.SHOW_TEXT, null), ult = null, x; while ((x = tw.nextNode())) ult = x;
        if (ult && /[”"»]\s*(\([^()]*\))?\s*\.?\s*$/.test(ult.nodeValue)) {
          f.firstChild.nodeValue = f.firstChild.nodeValue.replace(/^\s*[“"«]/, '');
          ult.nodeValue = ult.nodeValue.replace(/[”"»](\s*(\([^()]*\))?\s*\.?\s*)$/, '$1');
          aspasRet++;
        }
      }
    });
    s.cont.querySelectorAll(':scope > p').forEach(function (p) {
      var t = p.textContent;
      if (!/^\s*“/.test(t)) return;
      var fim = t.lastIndexOf('”');
      if (fim < 0) return;
      var citacao = t.slice(t.indexOf('“') + 1, fim), cauda = t.slice(fim + 1);
      if (citacao.length < 300) return;
      if (!/^\s*(\([^()]*\d{4}[^()]*\))?\s*\.?\s*$/.test(cauda)) return;
      if (p.children.length) { longasNaoTratadas++; return; }
      var bq = el(doc, 'blockquote', { 'class': 'citacao-longa' }, [el(doc, 'p', null, [citacao.trim() + (cauda.trim() ? ' ' + cauda.trim().replace(/^\.\s*/, '') : '')])]);
      if (!/[.!?…]$/.test(txt(bq))) bq.firstChild.appendChild(doc.createTextNode('.'));
      p.parentNode.replaceChild(bq, p); cl++;
    });
  });
  A.corr('Citações diretas com mais de três linhas recuadas, sem aspas e em fonte menor (NBR 10520)', cl);
  A.corr('Aspas removidas de citações longas (NBR 10520)', aspasRet);
  if (longasNaoTratadas) A.add('aviso', 'Citações', longasNaoTratadas + ' citação(ões) direta(s) longa(s) entre aspas no corpo do parágrafo, com formatação interna que impediu o recuo automático.', { norma: 'NBR 10520', sug: 'Aplique o estilo “Citação” a esses trechos no Word.' });

  /* notas de rodapé (NBR 10520): numeração consecutiva por capítulo */
  var notasUsadas = {}, notasFaltando = 0;
  livro.secoes.forEach(function (s) {
    var k = 0, asides = [];
    s.cont.querySelectorAll('a[href^="#footnote-"],a[href^="#endnote-"]').forEach(function (a) {
      var nidr = a.getAttribute('href').slice(1);
      if (/-ref-/.test(nidr)) return;
      k++;
      var idRef = s.id + '-nr' + k, idNota = s.id + '-n' + k;
      var sup = a.parentNode && a.parentNode.tagName === 'SUP' && a.parentNode.childNodes.length === 1 ? a.parentNode : null;
      var na = el(doc, 'a', { 'class': 'noteref', href: '#' + idNota, id: idRef, 'epub:type': 'noteref', role: 'doc-noteref' }, [String(k)]);
      (sup || a).parentNode.replaceChild(na, sup || a);
      var conteudo = livro.notas[nidr];
      notasUsadas[nidr] = 1;
      if (conteudo == null) { notasFaltando++; conteudo = '<p>[nota não encontrada no manuscrito]</p>'; }
      var aside = el(doc, 'aside', { 'class': 'nota', id: idNota, 'epub:type': 'footnote', role: 'doc-footnote' });
      var tmp = doc.createElement('div'); tmp.innerHTML = conteudo; sanitizar(tmp);
      tmp.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach(function (h) { var p = doc.createElement('p'); while (h.firstChild) p.appendChild(h.firstChild); h.parentNode.replaceChild(p, h); });
      tipografia(tmp, new Auditoria());
      if (!tmp.firstElementChild || tmp.firstElementChild.tagName !== 'P') { var p0 = doc.createElement('p'); while (tmp.firstChild) p0.appendChild(tmp.firstChild); tmp.appendChild(p0); }
      var volta = el(doc, 'a', { 'class': 'volta', href: '#' + idRef }, [String(k)]);
      tmp.firstElementChild.insertBefore(doc.createTextNode(' '), tmp.firstElementChild.firstChild);
      tmp.firstElementChild.insertBefore(volta, tmp.firstElementChild.firstChild);
      while (tmp.firstChild) aside.appendChild(tmp.firstChild);
      asides.push(aside);
    });
    if (asides.length) { s.cont.appendChild(el(doc, 'hr', { 'class': 'notas-sep' })); asides.forEach(function (x) { s.cont.appendChild(x); }); }
    s.nNotas = k;
  });
  var totNotas = Object.keys(livro.notas).length, naoUsadas = Object.keys(livro.notas).filter(function (k) { return !notasUsadas[k]; }).length;
  if (notasFaltando) A.add('grave', 'Notas', notasFaltando + ' chamada(s) de nota sem texto correspondente.', { norma: 'NBR 10520' });
  if (naoUsadas) A.add('aviso', 'Notas', naoUsadas + ' nota(s) sem chamada no texto foram descartadas.', { norma: 'NBR 10520' });
  if (totNotas) A.corr('Notas de rodapé convertidas em notas interativas do EPUB, numeradas por capítulo', totNotas - naoUsadas);

  /* referências: seção própria e blocos “Referências” dentro de capítulos */
  var todasRefs = [];
  livro.secoes.forEach(function (s) {
    if (s.tipo === 'referencias') {
      s.cont.className = 'referencias';
      var notasRef = Array.prototype.slice.call(s.cont.querySelectorAll(':scope > hr.notas-sep, :scope > aside.nota'));
      notasRef.forEach(function (x) { x.remove(); });
      var nos = Array.prototype.slice.call(s.cont.children);
      var r = processarRefs(nos, A, 'Referências', doc);
      s.cont.innerHTML = '';
      r.grupos.forEach(function (g) { if (g.cab) { var gp = el(doc, 'h2', { id: nid('h') }, [txt(g.cab)]); s.cont.appendChild(gp); } (g.ordenado || g).forEach(function (p) { s.cont.appendChild(p); }); });
      notasRef.forEach(function (x) { s.cont.appendChild(x); });
      s.refs = r.itens; todasRefs = todasRefs.concat(r.itens);
    } else {
      s.cont.querySelectorAll('h2[data-ref]').forEach(function (h) {
        var nos = [], n = h.nextElementSibling;
        while (n && !/^H[1-2]$/.test(n.tagName) && !n.classList.contains('notas-sep') && n.tagName !== 'ASIDE') { nos.push(n); n = n.nextElementSibling; }
        var r = processarRefs(nos, A, s.titulo + ' › Referências', doc);
        var marcador = doc.createComment('refs');
        h.parentNode.insertBefore(marcador, nos[0] || h.nextSibling);
        nos.forEach(function (x) { if (x.parentNode) x.parentNode.removeChild(x); });
        var bloco = el(doc, 'div', { 'class': 'referencias' });
        r.grupos.forEach(function (g) { if (g.cab) bloco.appendChild(g.cab); (g.ordenado || g).forEach(function (p) { bloco.appendChild(p); }); });
        marcador.parentNode.replaceChild(bloco, marcador);
        h.removeAttribute('data-ref');
        s.refs = (s.refs || []).concat(r.itens); s.refsProprias = true;
      });
    }
  });
  livro.refsGlobais = todasRefs;

  /* conferência citação × referência */
  var semRef = {}, estilos = { alta: 0, mista: 0 }, citadas = [];
  livro.secoes.forEach(function (s) {
    if (/^(referencias|epigrafe|dedicatoria|sobre)$/.test(s.tipo)) return;
    var clone_ = s.cont.cloneNode(true); clone_.querySelectorAll('aside,.referencias,.fonte,figcaption,caption,p.legenda').forEach(function (x) { x.remove(); }); clone_.querySelectorAll('p').forEach(function (p) { if (RX_FONTE.test(txt(p)) || RX_LEG.test(txt(p)) || RX_LEG_T.test(txt(p))) p.remove(); });
    var cits = extrairCitacoes(clone_.textContent);
    var base = s.refsProprias ? s.refs : todasRefs;
    cits.forEach(function (c) {
      if (c.caixa) estilos[c.caixa]++;
      if (!base.length) return;
      if (casaCitacao(c, base)) { citadas.push(c); return; }
      var chave = c.autor + ', ' + c.ano;
      if (!semRef[chave]) semRef[chave] = { c: c, onde: s.titulo, n: 0 };
      semRef[chave].n++;
    });
  });
  Object.keys(semRef).forEach(function (k) {
    var x = semRef[k];
    A.add(x.c.tipo === 'parentetica' ? 'grave' : 'aviso', 'Citações', 'Citação sem referência correspondente: ' + (x.c.tipo === 'parentetica' ? '(' + k + ')' : x.c.autor + ' (' + x.c.ano + ')') + (x.n > 1 ? ' — ' + x.n + ' ocorrências' : '') + '.', { onde: x.onde, norma: 'NBR 10520 / NBR 6023', sug: 'Inclua a obra nas referências ou corrija autor/ano da citação.' });
  });
  if (todasRefs.length) {
    var naoCit = todasRefs.filter(function (r) { return !citadas.some(function (c) { return casaCitacao(c, [r]); }); });
    if (naoCit.length) A.add('info', 'Referências', naoCit.length + ' referência(s) não citada(s) no texto (aceitável em bibliografia de livro, mas confira).', { norma: 'NBR 6023', sug: naoCit.slice(0, 5).map(function (r) { return r.texto.slice(0, 60) + '…'; }).join(' | ') });
  }
  if (estilos.alta && estilos.mista) A.add('aviso', 'Citações', 'Autoria nas citações entre parênteses aparece ora em MAIÚSCULAS (' + estilos.alta + '), ora em maiúsculas e minúsculas (' + estilos.mista + ').', { norma: 'NBR 10520', sug: 'Padronize a grafia da autoria em todas as citações, conforme a versão vigente da NBR 10520 adotada pela Editora.' });
  if (!todasRefs.length && livro.secoes.some(function (s) { return extrairCitacoes(s.cont.textContent).length > 2; })) A.add('grave', 'Referências', 'O texto tem citações no sistema autor-data, mas o manuscrito não tem seção de Referências.', { norma: 'NBR 6023', sug: 'Inclua a seção REFERÊNCIAS ao final.' });

  /* glossário: termo em negrito e ordem alfabética */
  livro.secoes.filter(function (s) { return s.tipo === 'glossario'; }).forEach(function (s) {
    s.cont.className = 'glossario';
    var ps = Array.prototype.slice.call(s.cont.querySelectorAll(':scope > p'));
    ps.forEach(function (p) {
      var f = p.firstChild;
      if (f && f.nodeType === 3 && !p.querySelector('strong')) {
        var m = /^([^:–—]{1,60}?)\s*([:–—])\s+/.exec(f.nodeValue);
        if (m) { f.nodeValue = f.nodeValue.slice(m[0].length); p.insertBefore(doc.createTextNode(': '), f); p.insertBefore(el(doc, 'strong', null, [m[1]]), p.firstChild); }
      }
      p._k = N(txt(p));
    });
    var ord = ps.slice().sort(function (a, b) { return a._k.localeCompare(b._k, 'pt'); });
    if (ord.some(function (p, i) { return p !== ps[i]; })) { ord.forEach(function (p) { s.cont.appendChild(p); }); A.corr('Glossário colocado em ordem alfabética'); }
  });

  /* siglas para a lista de abreviaturas */
  var siglas = {};
  var rxSig = new RegExp('((?:' + LETRA + "[\\wÀ-ÿ'’\\-]*)(?:\\s+(?:de|da|do|das|dos|e|para|em|a|o|" + LETRA + "[\\wÀ-ÿ'’\\-]*)){1,12})\\s+\\(([A-ZÀ-Ý][A-ZÀ-Ý0-9\\-\\/]{1,11})\\)", 'g');
  livro.secoes.forEach(function (s) {
    if (s.def.parte !== 'body' && !/^(apresentacao|prefacio|posfacio|apendice|anexo)$/.test(s.tipo)) return;
    var t = s.cont.textContent, m;
    while ((m = rxSig.exec(t))) {
      var sg = m[2]; if (siglas[sg] || /^(\d+|[IVXLC]+)$/.test(sg) || sg.length < 2) continue;
      var ws = m[1].split(/\s+/), alvo = sg.replace(/[^A-ZÀ-Ý]/g, '').length, sel = [], maiusc = 0;
      for (var i = ws.length - 1; i >= 0 && maiusc < alvo + 1; i--) { sel.unshift(ws[i]); if (/^[A-ZÀ-Ý]/.test(ws[i])) maiusc++; if (maiusc >= alvo && N(ws[i])[0] === N(sg)[0]) break; }
      while (sel.length && !/^[A-ZÀ-Ý]/.test(sel[0])) sel.shift();
      if (sel.length >= 2 && N(sel[0])[0] === N(sg)[0]) siglas[sg] = sel.join(' ');
    }
  });
  if (livro.siglasAutor) { livro.siglas = livro.siglasAutor.slice().sort(function (a, b) { return a.sigla.localeCompare(b.sigla, 'pt'); }); } else
  livro.siglas = Object.keys(siglas).sort(function (a, b) { return a.localeCompare(b, 'pt'); }).map(function (k) { return { sigla: k, nome: siglas[k] }; });

  /* parágrafos em caixa alta (provável título sem estilo) */
  var caixa = 0;
  livro.secoes.forEach(function (s) { s.cont.querySelectorAll(':scope > p').forEach(function (p) { var t = txt(p); if (t.length > 50 && t === t.toUpperCase() && /[A-Z]/.test(t)) caixa++; }); });
  if (caixa) A.add('aviso', 'Estrutura', caixa + ' parágrafo(s) longo(s) inteiramente em MAIÚSCULAS. Podem ser títulos sem estilo ou ênfase inadequada.', { norma: 'NBR 6024' });
  livro.secoes.forEach(function (s) { if (!txt(s.cont) && !s.cont.querySelector('img') && s.tipo !== 'parte') A.add('aviso', 'Estrutura', 'Seção sem conteúdo: “' + s.titulo + '”.', { onde: s.titulo }); });

  /* separadores de cena (*** ou hr) viram vinheta */
  livro.secoes.forEach(function (s) {
    s.cont.querySelectorAll('p').forEach(function (p) { if (/^([*#~]\s*){1,5}$|^\*\s?\*\s?\*$/.test(txt(p))) { p.parentNode.replaceChild(el(doc, 'hr', { 'class': 'vinheta-secao' }), p); } });
    s.cont.querySelectorAll('hr:not(.notas-sep)').forEach(function (h) { h.className = 'vinheta-secao'; });
  });

  livro.doc = doc;
  livro.ms = Math.round(performance.now() - t0);
  return livro;
}

/* ───────────────────────── 6. ILUSTRAÇÕES E TABELAS ───────────────────────── */
var RX_LEG = /^(Figura|Fotografia|Foto|Imagem|Mapa|Gr[aá]fico|Quadro|Desenho|Ilustra[cç][aã]o|Esquema|Fluxograma|Organograma|Infogr[aá]fico|Prancha|Retrato)\s*(\d+)?\s*[–—:.\-]\s*([\s\S]+)$/i;
var RX_LEG_T = /^(Tabela)\s*(\d+)?\s*[–—:.\-]\s*([\s\S]+)$/i;
var TIPOS_ROT = 'Figura|Fotografia|Foto|Imagem|Mapa|Gr[aá]fico|Quadro|Desenho|Ilustra[cç][aã]o|Esquema|Fluxograma|Organograma|Infogr[aá]fico|Prancha|Retrato|Tabela';
var RX_ROT = new RegExp('^(' + TIPOS_ROT + ')\\s*(\\d+(?:\\.\\d+)*)?\\s*((?:\\.\\s*)?[–—:.,;\\-])?\\s+([\\s\\S]+)$', 'i');
var RX_ROT_INI = new RegExp('^\\s*(' + TIPOS_ROT + ')\\s*(\\d+(?:\\.\\d+)*)?\\s*((?:\\.\\s*)?[–—:.,;\\-])?\\s+', 'i');
var RX_FONTE = /^(Fontes?\s*:|Elabora[cç][aã]o\s+pr[oó]pria\b)/i;
function tipoCap(s) { s = semAcento(s).toLowerCase(); return s.charAt(0).toUpperCase() + s.slice(1); }
var NOME_TIPO = { Figura: 'Figura', Fotografia: 'Fotografia', Foto: 'Fotografia', Imagem: 'Imagem', Mapa: 'Mapa', Grafico: 'Gráfico', Quadro: 'Quadro', Desenho: 'Desenho', Ilustracao: 'Ilustração', Esquema: 'Esquema', Fluxograma: 'Fluxograma', Organograma: 'Organograma', Infografico: 'Infográfico', Prancha: 'Prancha', Retrato: 'Retrato', Tabela: 'Tabela' };

function decodificarImagem(bytes, mime) {
  var blob = new Blob([bytes], { type: mime });
  if (window.createImageBitmap) return createImageBitmap(blob);
  return new Promise(function (ok, erro) { var u = URL.createObjectURL(blob), im = new Image(); im.onload = function () { ok(im); }; im.onerror = erro; im.src = u; });
}
function canvasPara(img, maxLado, mime, q) {
  var w = img.width, h = img.height, k = Math.min(1, maxLado / Math.max(w, h));
  var c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
  var g = c.getContext('2d');
  if (mime === 'image/jpeg') { g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); }
  g.drawImage(img, 0, 0, c.width, c.height);
  return new Promise(function (ok) { c.toBlob(function (b) { b.arrayBuffer().then(function (ab) { ok({ bytes: new Uint8Array(ab), mime: mime, w: c.width, h: c.height }); }); }, mime, q || 0.88); });
}
/* apara margens brancas (capas exportadas com moldura de página) */
async function aparar(bmp) {
  var k = Math.min(1, 600 / Math.max(bmp.width, bmp.height)), w = Math.round(bmp.width * k), h = Math.round(bmp.height * k);
  var c = document.createElement('canvas'); c.width = w; c.height = h; var g = c.getContext('2d'); g.drawImage(bmp, 0, 0, w, h);
  var d = g.getImageData(0, 0, w, h).data, x0 = w, y0 = h, x1 = 0, y1 = 0;
  for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) { var i = (y * w + x) * 4; if (d[i] < 200 || d[i + 1] < 200 || d[i + 2] < 200) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
  if (x1 <= x0 || y1 <= y0 || (x0 < 3 && y0 < 3 && w - x1 < 4 && h - y1 < 4)) return bmp;
  var X0 = Math.floor(x0 / k), Y0 = Math.floor(y0 / k), W = Math.ceil((x1 - x0 + 1) / k), H = Math.ceil((y1 - y0 + 1) / k);
  var c2 = document.createElement('canvas'); c2.width = W; c2.height = H; c2.getContext('2d').drawImage(bmp, X0, Y0, W, H, 0, 0, W, H);
  return c2;
}
async function normalizarImagem(bytes, mime) {
  var EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/svg+xml': 'svg' };
  if (mime === 'image/svg+xml') return { bytes: bytes, mime: mime, ext: 'svg', corrigida: false };
  var bmp;
  try { bmp = await decodificarImagem(bytes, mime); } catch (e) { return null; }
  var grande = Math.max(bmp.width, bmp.height) > 2400 || bytes.length > 1600000;
  if (EXT[mime] && !grande) return { bytes: bytes, mime: mime, ext: EXT[mime], w: bmp.width, h: bmp.height, corrigida: false };
  var alvo = mime === 'image/png' || mime === 'image/gif' ? 'image/png' : 'image/jpeg';
  var r = await canvasPara(bmp, 2000, alvo, 0.86);
  if (alvo === 'image/png' && r.bytes.length > 1600000) r = await canvasPara(bmp, 2000, 'image/jpeg', 0.86);
  return { bytes: r.bytes, mime: r.mime, ext: EXT[r.mime], w: r.w, h: r.h, corrigida: true };
}

function legendaDe(el_) {
  if (!el_ || el_.tagName !== 'P') return null;
  var t = txt(el_);
  if (t.length > 900 || RX_FONTE.test(t)) return null;
  var m = RX_ROT.exec(t);
  if (m && (m[2] || m[3]) && (t.length <= 320 || m[2])) {
    var tit = m[4].trim(), nota = '';
    var corte = /^(.{20,}?[^A-Z.]\.)\s+([A-ZÀ-Ý].{20,})$/.exec(tit);
    if (tit.length > 160 && corte && !/\b(n|v|p|art|vs|Dr|Sr|Ed|ed|cap|séc|Séc|c)\.$/.test(corte[1])) { tit = corte[1].replace(/\.$/, ''); nota = corte[2]; }
    return { tipo: NOME_TIPO[tipoCap(m[1])] || 'Figura', num: m[2] || '', titulo: tit.replace(/\.$/, ''), nota: nota };
  }
  if (el_.classList.contains('legenda')) return { tipo: '', num: '', titulo: t };
  return null;
}
function ehFonte(el_) { return !!(el_ && el_.tagName === 'P' && RX_FONTE.test(txt(el_))); }
function escolherLegenda(bloco, conv) {
  var ant = bloco.previousElementSibling, prox = bloco.nextElementSibling;
  var la = legendaDe(ant), lp = legendaDe(prox);
  var ordem = conv === 'depois' ? [['p', lp, prox], ['a', la, ant]] : [['a', la, ant], ['p', lp, prox]];
  for (var i = 0; i < 2; i++) if (ordem[i][1]) return { lado: ordem[i][0], leg: ordem[i][1], el: ordem[i][2] };
  return null;
}
async function processarIlustracoes(livro) {
  var A = livro.A, doc = livro.doc, mapa = {}, nImg = 0, convertidas = 0, altDeriv = 0, semAlt = 0, semLeg = 0, semFonte = 0, legendas = [];
  // convenção do manuscrito: legenda acima ou abaixo?
  var acima = 0, abaixo = 0;
  livro.secoes.forEach(function (s) {
    s.cont.querySelectorAll('table, p > img').forEach(function (x) {
      var b = x.tagName === 'TABLE' ? x : x.parentNode;
      if (legendaDe(b.previousElementSibling)) acima++;
      if (legendaDe(b.nextElementSibling)) abaixo++;
    });
  });
  var conv = abaixo > acima ? 'depois' : 'antes';
  if (abaixo > acima) A.corr('Legendas de tabelas e ilustrações movidas para cima do elemento (NBR 6029; IBGE)', abaixo);

  for (var s of livro.secoes) {
    var imgs = Array.prototype.slice.call(s.cont.querySelectorAll('img'));
    for (var img of imgs) {
      var src = img.getAttribute('src') || '', dados = null;
      if (/^data:/i.test(src)) dados = dataUrlParaBytes(src);
      else if (/^https?:/i.test(src)) {
        try { var r = await fetch(src); if (r.ok) { var b = await r.blob(); dados = { bytes: new Uint8Array(await b.arrayBuffer()), mime: b.type }; } } catch (e) {}
      }
      if (!dados) { A.add('bloqueante', 'Técnico', 'Imagem não incorporável (arquivo ausente ou externo): ' + src.slice(0, 80), { onde: s.titulo, sug: 'Insira a imagem no próprio documento.' }); img.remove(); continue; }
      var h = hashBytes(dados.bytes), reg = mapa[h];
      if (!reg) {
        var nz = await normalizarImagem(dados.bytes, dados.mime);
        if (!nz) { A.add('bloqueante', 'Técnico', 'Imagem em formato não suportado em livros digitais (' + (dados.mime || 'desconhecido') + ').', { onde: s.titulo, sug: 'Exporte a imagem como PNG ou JPEG e substitua no manuscrito (formatos EMF/WMF/TIFF do Word não são aceitos em EPUB).' }); img.remove(); continue; }
        if (nz.corrigida) convertidas++;
        nImg++;
        reg = mapa[h] = { arquivo: 'img/fig-' + pad(nImg, 3) + '.' + nz.ext, bytes: nz.bytes, mime: nz.mime, id: 'fig' + pad(nImg, 3), w: nz.w, h: nz.h };
        livro.imagens.push(reg);
      }
      img.setAttribute('src', '../' + reg.arquivo);
      var alt = (img.getAttribute('alt') || '').trim();
      var p = img.parentNode, bloco = (p && p !== s.cont && p.tagName === 'P' && !txt(p) && p.querySelectorAll('img').length === 1) ? p : (p === s.cont ? img : null);
      if (!bloco) { if (!alt) { semAlt++; img.setAttribute('alt', ''); } continue; }
      var esc_ = escolherLegenda(bloco, conv), cap = esc_ ? esc_.el : null, leg = esc_ ? esc_.leg : null;
      var aposFonte = (esc_ && esc_.lado === 'p') ? cap.nextElementSibling : bloco.nextElementSibling;
      var fonte = ehFonte(aposFonte) ? aposFonte : null;
      var fig = el(doc, 'figure', { 'class': 'ilustracao', id: 'il-' + pad(livro.ilustracoes.length + livro.tabelas.length + 1, 3) });
      var tipo = (leg && leg.tipo) || 'Figura', titulo = leg ? leg.titulo : '';
      var item = { id: fig.id, secao: s, rotulo: tipo, titulo: titulo || alt || '(sem título)' };
      if (cap || alt) {
        var fc = el(doc, 'figcaption'), pref = doc.createTextNode(tipo + ' – ');
        fc.appendChild(pref);
        if (cap) {
          var tmp = cap.cloneNode(true), tw = doc.createTreeWalker(tmp, NodeFilter.SHOW_TEXT, null), tn = tw.nextNode();
          if (tn && leg.tipo) { var mm = RX_ROT_INI.exec(tn.nodeValue); if (mm) tn.nodeValue = tn.nodeValue.slice(mm[0].length); }
          while (tmp.firstChild) fc.appendChild(tmp.firstChild);
        } else { fc.appendChild(doc.createTextNode(alt)); titulo = alt; }
        fig.appendChild(fc);
        legendas.push({ tipo: tipo, numOrig: leg ? leg.num : '', prefixo: pref, secao: s, reg: item });
      }
      if (!cap) semLeg++;
      if (!alt && titulo) { img.setAttribute('alt', titulo); altDeriv++; }
      else if (!alt) { img.setAttribute('alt', ''); semAlt++; }
      bloco.parentNode.insertBefore(fig, bloco);
      fig.appendChild(img);
      if (bloco !== img) bloco.remove();
      if (cap) cap.remove();
      if (fonte) { fonte.className = 'fonte'; fig.appendChild(fonte); } else semFonte++;
      livro.ilustracoes.push(item);
    }

    // tabelas (e quadros/figuras feitos como tabela)
    Array.prototype.slice.call(s.cont.querySelectorAll('table')).forEach(function (tb) {
      if (tb.parentNode && tb.parentNode.closest && tb.parentNode.closest('table')) return;
      var esc_ = escolherLegenda(tb, conv), cap = esc_ ? esc_.el : null, leg = esc_ ? esc_.leg : null;
      var aposFonte = (esc_ && esc_.lado === 'p') ? cap.nextElementSibling : tb.nextElementSibling;
      var fonte = ehFonte(aposFonte) ? aposFonte : null;
      var tipo = (leg && leg.tipo) || 'Tabela', titulo = leg ? leg.titulo : '', notaTab = null;
      var wrap = el(doc, 'div', { 'class': 'tabela', id: 'tb-' + pad(livro.tabelas.length + livro.ilustracoes.length + 1, 3) });
      tb.parentNode.insertBefore(wrap, tb);
      var item = { id: wrap.id, secao: s, rotulo: tipo, titulo: titulo || '(sem título)' };
      if (cap) {
        var pref = doc.createTextNode(tipo + ' – ');
        tb.insertBefore(el(doc, 'caption', null, [pref, titulo]), tb.firstChild); cap.remove();
        if (leg.nota) { notaTab = el(doc, 'p', { 'class': 'fonte' }, ['Nota: ' + leg.nota]); A.corr('Texto explicativo das legendas transferido para “Nota” abaixo da tabela (IBGE)'); }
        legendas.push({ tipo: tipo, numOrig: leg.num, prefixo: pref, secao: s, reg: item });
      } else A.add('grave', 'Ilustrações', 'Tabela sem título (identificação acima da tabela).', { onde: s.titulo, norma: 'IBGE — Normas de apresentação tabular / NBR 6029', sug: 'Escreva acima da tabela: “Tabela N – Título”.' });
      wrap.appendChild(tb);
      if (notaTab) wrap.appendChild(notaTab);
      if (fonte) { fonte.className = 'fonte'; wrap.appendChild(fonte); } else A.add('aviso', 'Ilustrações', 'Tabela sem indicação de fonte' + (titulo ? ': “' + titulo.slice(0, 70) + '”' : '') + '.', { onde: s.titulo, norma: 'IBGE — Normas de apresentação tabular', sug: 'Abaixo da tabela, informe “Fonte: …”, mesmo que seja elaboração própria.' });
      if (!tb.querySelector('th')) {
        var r1 = tb.querySelector('tr');
        var cab = r1 && tb.querySelectorAll('tr').length > 1 && (Array.prototype.every.call(r1.children, function (td) { return td.querySelector('strong') && txt(td.querySelector('strong')) === txt(td); }) || Array.prototype.every.call(r1.children, function (td) { var t = txt(td); return t && t.length < 60 && !/^\d/.test(t); }));
        if (cab) {
          Array.prototype.slice.call(r1.children).forEach(function (td) { var th = el(doc, 'th', { scope: 'col' }); while (td.firstChild) th.appendChild(td.firstChild); th.querySelectorAll('strong').forEach(desembrulhar); r1.replaceChild(th, td); });
          var th_ = el(doc, 'thead'); tb.insertBefore(th_, r1.parentNode.tagName === 'TBODY' ? r1.parentNode : r1); th_.appendChild(r1);
          A.corr('Linha de cabeçalho de tabela marcada para leitores de tela');
        } else A.add('aviso', 'Acessibilidade', 'Tabela sem linha de cabeçalho marcada.', { onde: s.titulo, norma: 'EPUB Accessibility 1.1 / WCAG 2.1 (1.3.1)', sug: 'No Word, marque a primeira linha como “Repetir como linha de cabeçalho”.' });
      }
      tb.querySelectorAll('th').forEach(function (th) { if (!th.getAttribute('scope')) th.setAttribute('scope', 'col'); });
      livro.tabelas.push(item);
    });
  }

  /* numeração (NBR 6029): por capítulo ou sequencial, conforme o padrão do manuscrito; remissões atualizadas */
  var comNum = legendas.filter(function (i) { return i.numOrig; });
  var porCapitulo = comNum.length > 0 && comNum.filter(function (i) { return /\./.test(i.numOrig); }).length >= comNum.length / 2;
  var seq = {}, mapaSec = {}, mapaGlob = {}, dup = {}, mudou = 0;
  legendas.forEach(function (i) {
    var pre = '', chave = i.tipo;
    if (porCapitulo) { var c = i.secao.nCap || i.secao.letra; if (c) { pre = c + '.'; chave = i.tipo + '@' + i.secao.id; } }
    seq[chave] = (seq[chave] || 0) + 1;
    var novo = porCapitulo && !pre ? (i.numOrig || String(seq[chave])) : pre + seq[chave];
    if (i.numOrig) {
      var k = i.tipo + ' ' + i.numOrig;
      (mapaSec[i.secao.id] = mapaSec[i.secao.id] || {})[k] = i.tipo + ' ' + novo;
      if (!(k in mapaGlob)) mapaGlob[k] = i.tipo + ' ' + novo; else { mapaGlob[k] = null; dup[k] = 1; }
      if (i.numOrig !== novo) mudou++;
    } else mudou++;
    i.prefixo.nodeValue = i.tipo + ' ' + novo + ' – ';
    i.reg.rotulo = i.tipo + ' ' + novo;
  });
  if (mudou) A.corr('Ilustrações e tabelas numeradas ' + (porCapitulo ? 'por capítulo' : 'em sequência') + ' (NBR 6029)', mudou);
  Object.keys(dup).forEach(function (k) { A.add('aviso', 'Ilustrações', 'Numeração repetida no manuscrito: “' + k + '” aparece mais de uma vez (corrigida na edição).', { norma: 'NBR 6029' }); });
  if (mudou) {
    var rem = 0, rx = /\b(Tabela|Quadro|Figura|Gr[aá]fico|Mapa|Fotografia|Ilustra[cç][aã]o)\s+(\d+(?:\.\d+)*)\b/g;
    livro.secoes.forEach(function (s) {
      var w = doc.createTreeWalker(s.cont, NodeFilter.SHOW_TEXT, null), n, nos = [];
      while ((n = w.nextNode())) nos.push(n);
      nos.forEach(function (n) {
        if (n.parentNode.closest('figcaption,caption')) return;
        var v = n.nodeValue.replace(rx, function (m, t, num) {
          var k = (NOME_TIPO[tipoCap(t)] || t) + ' ' + num, novo = (mapaSec[s.id] && mapaSec[s.id][k]) || mapaGlob[k];
          if (novo && novo !== k) { rem++; return t + ' ' + novo.split(' ').pop(); }
          return m;
        });
        if (v !== n.nodeValue) n.nodeValue = v;
      });
    });
    A.corr('Remissões a tabelas e ilustrações atualizadas no texto', rem);
  }
  if (convertidas) A.corr('Imagens convertidas/otimizadas para o padrão EPUB (≤ 2000 px)', convertidas);
  if (altDeriv) A.add('aviso', 'Acessibilidade', altDeriv + ' imagem(ns) sem texto alternativo receberam o título da ilustração como descrição.', { norma: 'Lei 13.146/2015 (LBI), art. 68; EPUB Accessibility 1.1', sug: 'Revise e escreva descrições que expliquem o conteúdo da imagem (no Word: botão direito › Editar texto alternativo).' });
  if (semAlt) A.add('grave', 'Acessibilidade', semAlt + ' imagem(ns) sem texto alternativo e sem legenda.', { norma: 'Lei 13.146/2015 (LBI), art. 68; WCAG 2.1 (1.1.1)', sug: 'Descreva cada imagem no texto alternativo do Word.' });
  if (semLeg) A.add('grave', 'Ilustrações', semLeg + ' ilustração(ões) sem identificação (título).', { norma: 'NBR 6029', sug: 'Acima da imagem: “Figura N – Título”.' });
  if (semFonte) A.add('aviso', 'Ilustrações', semFonte + ' ilustração(ões) sem indicação de fonte.', { norma: 'NBR 6029', sug: 'Abaixo da imagem: “Fonte: …” (inclusive “Fonte: acervo do autor”).' });
}

/* ───────────────────────── 7. ÍNDICE REMISSIVO (NBR 6034) ───────────────────────── */
function gerarIndice(livro, termos) {
  var doc = livro.doc, A = livro.A, entradas = [];
  termos = termos.map(function (t) { return t.trim(); }).filter(function (t, i, a) { return t.length > 1 && a.indexOf(t) === i; });
  termos.forEach(function (termo, k) {
    var rx = new RegExp('(^|[^\\p{L}\\p{N}])(' + termo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')(?=$|[^\\p{L}\\p{N}])', 'iu');
    var locais = [];
    livro.secoes.forEach(function (s) {
      if (!/^(capitulo|abertura|apresentacao|prefacio|posfacio|apendice|anexo|parte)$/.test(s.tipo)) return;
      if (locais.length >= 12) return;
      var w = doc.createTreeWalker(s.cont, NodeFilter.SHOW_TEXT, null), n, achou = 0, nos = [];
      while ((n = w.nextNode())) nos.push(n);
      for (var i = 0; i < nos.length && achou < 3; i++) {
        n = nos[i];
        if (n.parentNode.closest('h1,h2,h3,h4,h5,h6,aside,figcaption,caption,a,.referencias')) continue;
        var m = rx.exec(n.nodeValue); if (!m) continue;
        var ini = m.index + m[1].length, depois = n.splitText(ini); depois.splitText(m[2].length);
        var id = 'ix' + (k + 1) + '-' + (locais.length + 1);
        var sp = el(doc, 'span', { id: id }); depois.parentNode.replaceChild(sp, depois); sp.appendChild(depois);
        locais.push({ secao: s, id: id }); achou++;
      }
    });
    if (locais.length) entradas.push({ termo: termo, locais: locais });
  });
  var sem = termos.length - entradas.length;
  if (sem) A.add('info', 'Índice', sem + ' termo(s) do índice não encontrados no texto e omitidos.', { norma: 'NBR 6034' });
  return entradas.sort(function (a, b) { return N(a.termo).localeCompare(N(b.termo), 'pt'); });
}

/* ───────────────────────── 8. IA (Claude) ───────────────────────── */
function chaveClaude() {
  try { if (window.TRAD_AUTO && window.TRAD_AUTO.chaveClaude) { var k = window.TRAD_AUTO.chaveClaude(); if (k) return k; } } catch (e) {}
  try {
    var d = localStorage.getItem('trad_claude_key'); if (d) return d.trim();
    var c = JSON.parse(localStorage.getItem('icet_si_cfg') || '{}'); if (c.claude) return String(c.claude).trim();
  } catch (e) {}
  return '';
}
function claude(sistema, conteudo, schema, maxTokens) {
  var chave = chaveClaude();
  if (!chave) return Promise.reject(new Error('sem chave'));
  return fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': chave, 'anthropic-version': '2023-06-01', 'anthropic-beta': 'server-side-fallback-2026-07-01', 'anthropic-dangerous-direct-browser-access': 'true' },
    body: JSON.stringify({
      model: 'claude-opus-5-5', max_tokens: maxTokens || 16000, fallbacks: 'default',
      output_config: { effort: 'low', format: { type: 'json_schema', schema: schema } },
      system: sistema, messages: [{ role: 'user', content: conteudo }]
    })
  }).then(function (r) {
    return r.json().then(function (j) {
      if (!r.ok) throw new Error((j && j.error && j.error.message) || ('HTTP ' + r.status));
      if (j.stop_reason === 'refusal') throw new Error('pedido recusado pelo modelo');
      if (j.stop_reason === 'max_tokens') throw new Error('resposta truncada');
      var b = (j.content || []).filter(function (x) { return x.type === 'text'; })[0];
      if (!b) throw new Error('resposta vazia');
      return JSON.parse(b.text);
    });
  });
}
function iaMetadados(entrada, texto) {
  var schema = {
    type: 'object', additionalProperties: false,
    required: ['titulo', 'subtitulo', 'autores', 'sinopse', 'palavrasChave', 'termosIndice', 'cddSugerida'],
    properties: {
      titulo: { type: 'string' }, subtitulo: { type: 'string' },
      autores: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['nome', 'povo'], properties: { nome: { type: 'string' }, povo: { type: 'string' } } } },
      sinopse: { type: 'string' }, palavrasChave: { type: 'array', items: { type: 'string' } },
      termosIndice: { type: 'array', items: { type: 'string' } }, cddSugerida: { type: 'string' }
    }
  };
  var sis = 'Você é editor-chefe da Editora Cacique Enir Terena, selo de autoria indígena do Instituto Cacique Enir Terena (Campo Grande, MS). ' +
    'Leia o início do manuscrito e extraia metadados editoriais. Regras: use apenas o que está no texto; deixe vazio ("" ou []) o que não estiver claro; ' +
    'em "autores", "povo" é o povo indígena do autor somente se o texto o declarar (ex.: Terena, Guarani-Kaiowá), senão "". ' +
    'A sinopse deve ter 600 a 900 caracteres, em português do Brasil, tom de quarta capa, sem adjetivação exagerada. ' +
    'Palavras-chave: 5 a 8. Termos de índice remissivo: 15 a 40 nomes próprios, povos, lugares e conceitos centrais exatamente como grafados no texto. ' +
    'cddSugerida: classe CDD provável com 3 dígitos e breve rótulo, apenas como sugestão para o bibliotecário.';
  return claude(sis, 'Metadados do arquivo: ' + JSON.stringify(entrada.meta || {}) + '\n\nManuscrito (trecho inicial):\n' + texto.slice(0, 24000), schema, 6000);
}
function iaRevisao(secoes, aoAvancar) {
  var schema = {
    type: 'object', additionalProperties: false, required: ['problemas'],
    properties: { problemas: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['trecho', 'correcao', 'tipo', 'explicacao'], properties: { trecho: { type: 'string' }, correcao: { type: 'string' }, tipo: { type: 'string', enum: ['ortografia', 'acentuação', 'crase', 'concordância', 'regência', 'pontuação', 'digitação', 'padronização'] }, explicacao: { type: 'string' } } } } }
  };
  var sis = 'Você é revisor de texto sênior de uma editora brasileira de autoria indígena. Revise conforme a norma-padrão do português do Brasil e o Acordo Ortográfico de 1990. ' +
    'Aponte somente erros objetivos (ortografia, acentuação, crase, concordância, regência, pontuação, digitação e padronização de grafias), no máximo 25 por trecho, do mais grave ao menos grave. ' +
    'Nunca corrija palavras de línguas indígenas, nomes de povos, pessoas, aldeias e lugares, nem marcas de oralidade intencionais em falas transcritas, e não proponha mudanças de estilo. ' +
    '"trecho" deve ser cópia literal curta (até 120 caracteres) do texto; "correcao" é o mesmo trecho corrigido; "explicacao" tem até 140 caracteres.';
  var pedacos = [];
  secoes.forEach(function (s) {
    if (/^(referencias|sobre)$/.test(s.tipo)) return;
    var c = s.cont.cloneNode(true); c.querySelectorAll('.referencias,table').forEach(function (x) { x.remove(); });
    var t = Array.prototype.map.call(c.querySelectorAll('p,li,h2,h3,h4,blockquote,aside'), function (p) { return txt(p); }).filter(Boolean).join('\n\n');
    for (var i = 0; i < t.length; i += 14000) pedacos.push({ secao: s.titulo, texto: t.slice(i, i + 14000) });
  });
  var res = [], feito = 0, idx = 0;
  function proximo() {
    if (idx >= pedacos.length) return Promise.resolve();
    var p = pedacos[idx++];
    return claude(sis, 'Trecho de “' + p.secao + '”:\n\n' + p.texto, schema, 8000)
      .then(function (r) { (r.problemas || []).forEach(function (x) { x.secao = p.secao; res.push(x); }); }, function (e) { res.push({ erro: e.message, secao: p.secao }); })
      .then(function () { feito++; if (aoAvancar) aoAvancar(feito, pedacos.length); return proximo(); });
  }
  return Promise.all([proximo(), proximo(), proximo()]).then(function () { return res; });
}

/* ───────────────────────── 9. ELEMENTOS EDITORIAIS ───────────────────────── */
var FONTES_EPUB = ['literata-regular.woff', 'literata-italic.woff', 'literata-bold.woff', 'literata-bolditalic.woff', 'cinzel-regular.woff', 'cinzel-bold.woff'];
var _fontesCanvas = null;
function fontesCanvas() {
  if (_fontesCanvas) return _fontesCanvas;
  var defs = [['EB Cinzel', 'cinzel-bold.woff', '700', 'normal'], ['EB Cinzel', 'cinzel-regular.woff', '400', 'normal'], ['EB Literata', 'literata-italic.woff', '400', 'italic'], ['EB Literata', 'literata-regular.woff', '400', 'normal']];
  _fontesCanvas = Promise.all(defs.map(function (d) { var f = new FontFace(d[0], 'url(' + BASE + 'fontes/' + d[1] + ')', { weight: d[2], style: d[3] }); return f.load().then(function (x) { document.fonts.add(x); }).catch(function () {}); }));
  return _fontesCanvas;
}
function quebrarLinhas(g, texto, largura) {
  var palavras = String(texto).split(/\s+/), linhas = [], l = '';
  palavras.forEach(function (w) { var t = l ? l + ' ' + w : w; if (g.measureText(t).width > largura && l) { linhas.push(l); l = w; } else l = t; });
  if (l) linhas.push(l);
  return linhas;
}
function faixaGrafismo(g, y, alt, W) {
  var n = 20, w = W / n;
  for (var i = 0; i < n; i++) {
    g.fillStyle = i % 2 ? '#8B3A0F' : '#B8862B';
    g.beginPath(); g.moveTo(i * w, y + alt); g.lineTo(i * w + w / 2, y); g.lineTo(i * w + w, y + alt); g.closePath(); g.fill();
    g.fillStyle = '#F2C45A'; var cx = i * w + w / 2, cy = y + alt * 0.62, r = alt * 0.16;
    g.beginPath(); g.moveTo(cx, cy - r); g.lineTo(cx + r, cy); g.lineTo(cx, cy + r); g.lineTo(cx - r, cy); g.closePath(); g.fill();
  }
}
function losangos(g, cx, y) {
  g.strokeStyle = '#B8862B'; g.lineWidth = 3; g.beginPath(); g.moveTo(cx - 330, y); g.lineTo(cx - 60, y); g.moveTo(cx + 60, y); g.lineTo(cx + 330, y); g.stroke();
  [[-38, 13, '#B8862B'], [38, 13, '#B8862B'], [0, 26, '#8B3A0F'], [0, 10, '#F2C45A']].forEach(function (d) { g.fillStyle = d[2]; g.beginPath(); g.moveTo(cx + d[0], y - d[1]); g.lineTo(cx + d[0] + d[1], y); g.lineTo(cx + d[0], y + d[1]); g.lineTo(cx + d[0] - d[1], y); g.closePath(); g.fill(); });
}
function retArred(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
async function gerarCapa(o, logos) {
  o = Object.assign({}, o, { titulo: (o.titulo || '').trim() || 'Sem título' });
  await fontesCanvas();
  var W = 1600, H = 2560, c = document.createElement('canvas'); c.width = W; c.height = H;
  var g = c.getContext('2d');
  var gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#2a1405'); gr.addColorStop(0.55, '#150A01'); gr.addColorStop(1, '#0A0603');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  g.globalAlpha = 0.06; g.fillStyle = '#F2C45A';
  for (var yy = 260; yy < 1980; yy += 120) for (var xx = (yy / 120) % 2 ? 60 : 0; xx < W; xx += 120) { g.beginPath(); g.moveTo(xx, yy - 30); g.lineTo(xx + 30, yy); g.lineTo(xx, yy + 30); g.lineTo(xx - 30, yy); g.closePath(); g.fill(); }
  g.globalAlpha = 1;
  faixaGrafismo(g, 70, 90, W);
  g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.fillStyle = '#E8A853'; g.font = '400 44px "EB Cinzel", serif';
  try { g.letterSpacing = '10px'; } catch (e) {}
  g.fillText(cfg.editora.nome.toUpperCase(), W / 2, 300);
  try { g.letterSpacing = '0px'; } catch (e) {}
  var tam = 150, linhas;
  do { g.font = '700 ' + tam + 'px "EB Cinzel", serif'; linhas = quebrarLinhas(g, o.titulo || 'Sem título', 1340); tam -= 6; } while ((linhas.length > 5 || linhas.some(function (l) { return g.measureText(l).width > 1400; })) && tam > 60);
  tam += 6;
  var lh = tam * 1.12, y = 820 - (linhas.length - 1) * lh / 2;
  g.fillStyle = '#F7F2E8';
  linhas.forEach(function (l, i) { g.fillText(l, W / 2, y + i * lh); });
  y += (linhas.length - 1) * lh + 110;
  losangos(g, W / 2, y);
  y += 110;
  if (o.subtitulo) {
    g.font = 'italic 400 60px "EB Literata", serif'; g.fillStyle = '#EDE4C8';
    quebrarLinhas(g, o.subtitulo, 1240).slice(0, 4).forEach(function (l, i) { g.fillText(l, W / 2, y + i * 78); });
  }
  var nomes = pessoas(o.autores).map(function (p) { return p.nome; });
  var orgs = pessoas(o.organizadores).map(function (p) { return p.nome; });
  var linhaAut = nomes.length ? nomes : orgs.length ? orgs : [];
  g.font = '400 58px "EB Cinzel", serif'; g.fillStyle = '#E8A853';
  var yA = 1820 - Math.max(0, linhaAut.length - 3) * 68;
  if (linhaAut.length > 6) linhaAut = linhaAut.slice(0, 5).concat(['e outros']);
  linhaAut.forEach(function (n, i) { g.fillText(n, W / 2, yA + i * 76); });
  if (!nomes.length && orgs.length) { g.font = 'italic 400 40px "EB Literata", serif'; g.fillText(orgs.length > 1 ? '(organizadores)' : '(organização)', W / 2, yA + linhaAut.length * 76); }
  // régua de logomarcas
  g.fillStyle = '#F7F2E8'; g.fillRect(0, 2090, W, 360);
  var tiles = logos.slice(0, 6), tw = 230, gap = 26, x0 = (W - (tiles.length * tw + (tiles.length - 1) * gap)) / 2;
  for (var i = 0; i < tiles.length; i++) {
    var L = tiles[i], x = x0 + i * (tw + gap), ty = 2155;
    g.fillStyle = L.fundo || '#ffffff'; retArred(g, x, ty, tw, tw, 18); g.fill();
    g.strokeStyle = 'rgba(61,29,8,.18)'; g.lineWidth = 2; g.stroke();
    if (L.dados) {
      try {
        var bmp = await decodificarImagem(L.dados.bytes, L.dados.mime), pd = 16, k = Math.min((tw - 2 * pd) / bmp.width, (tw - 2 * pd) / bmp.height);
        g.drawImage(bmp, x + (tw - bmp.width * k) / 2, ty + (tw - bmp.height * k) / 2, bmp.width * k, bmp.height * k);
      } catch (e) {}
    } else { g.fillStyle = '#3d1d08'; g.font = '700 46px "EB Cinzel", serif'; g.fillText(L.sigla, x + tw / 2, ty + tw / 2 + 16); }
  }
  faixaGrafismo(g, 2470, 90, W);
  return new Promise(function (ok) { c.toBlob(function (b) { b.arrayBuffer().then(function (ab) { ok(new Uint8Array(ab)); }); }, 'image/jpeg', 0.9); });
}

function caixaAltaTit(x) { var l = String(x).replace(/[^A-Za-zÀ-ÿ]/g, ''); return l.length >= 4 && l === l.toUpperCase(); }
function tituloCaso(t) {
  var PART = /^(de|da|do|das|dos|e|em|a|o|as|os|para|com|na|no|nas|nos|por|sobre|à|ao|aos|às|y|del|la|el)$/i;
  return String(t).toLowerCase().split(/(\s+)/).map(function (w, i) {
    if (/^\s+$/.test(w) || (i && PART.test(w))) return w;
    return w.split(/([\-‑])/).map(function (x) { return x.charAt(0).toUpperCase() + x.slice(1); }).join('');
  }).join('').replace(/\b(Ii|Iii|Iv|Vi|Vii|Viii|Ix|Xi|Xii)\b/g, function (r) { return r.toUpperCase(); });
}
function frase(lista) { return lista.length <= 1 ? (lista[0] || '') : lista.slice(0, -1).join(', ') + ' e ' + lista[lista.length - 1]; }
function fichaCatalografica(o, livro) {
  var aut = pessoas(o.autores), org = pessoas(o.organizadores);
  var entradaTitulo = !aut.length || aut.length > 3;
  var principal = entradaTitulo ? '' : nomeFicha(aut[0].nome);
  var resp = aut.length ? frase(aut.map(function (p) { return p.nome; })) : '';
  if (org.length) resp += (resp ? ' ; ' : '') + (org.length > 1 ? 'organizadores ' : 'organização ') + frase(org.map(function (p) { return p.nome; }));
  var titulo = o.titulo + ' [recurso eletrônico]' + (o.subtitulo ? ' : ' + o.subtitulo : '') + (resp ? ' / ' + resp : '') + '.';
  var ed = (o.edicao || '1').replace(/\D/g, '') || '1';
  var local = o.local || (cfg.editora.cidade + ', ' + cfg.editora.uf);
  var imprenta = ed + '. ed. – ' + local + ' : ' + cfg.editora.nome + ', ' + o.ano + '.';
  var desc = '1 recurso online (EPUB)' + (livro.ilustracoes.length ? ' : il.' : '') + (o.serie ? ' – (' + o.serie + ')' : '');
  var assuntos = String(o.assuntos || '').split(/\n|;/).map(function (x) { return x.trim(); }).filter(Boolean);
  var secund = [];
  aut.slice(entradaTitulo ? 0 : 1).forEach(function (p) { secund.push(nomeFicha(p.nome)); });
  org.forEach(function (p) { secund.push(nomeFicha(p.nome) + ', org.'); });
  if (!entradaTitulo) secund.push('Título');
  if (o.serie) secund.push('Série');
  var pistas = assuntos.map(function (a, i) { return (i + 1) + '. ' + a.replace(/\.$/, '') + '.'; }).join(' ') + (secund.length ? ' ' + secund.map(function (s, i) { return romano(i + 1) + '. ' + s.replace(/\.$/, '') + '.'; }).join(' ') : '');
  return { principal: principal, titulo: titulo, imprenta: imprenta, desc: desc, isbn: o.isbn ? 'ISBN ' + isbnFormatado(o.isbn) : '', pistas: pistas.trim(), cdd: o.cdd, cdu: o.cdu, cutter: o.cutter };
}

function regua(doc, logos) {
  var div = el(doc, 'div', { 'class': 'regua' });
  var papeis = [];
  logos.forEach(function (l) { if (papeis.indexOf(l.papel) < 0) papeis.push(l.papel); });
  papeis.forEach(function (p) {
    div.appendChild(el(doc, 'p', { 'class': 'papel' }, [p]));
    var linha = el(doc, 'div', { 'class': 'logos' });
    logos.filter(function (l) { return l.papel === p; }).forEach(function (l) {
      var bg = /^#[0-9a-f]{3,8}$/i.test(l.fundo || '') ? l.fundo : '#ffffff';
      if (l.arquivoEpub) linha.appendChild(el(doc, 'span', { 'class': 'logo-tile', style: 'background-color:' + bg }, [el(doc, 'img', { src: '../' + l.arquivoEpub, alt: 'Logomarca: ' + l.nome + ' (' + l.sigla + ')' })]));
      else linha.appendChild(el(doc, 'span', { 'class': 'logo-tile texto', style: 'background-color:#f7f2e8;color:#3d1d08' }, [l.sigla]));
    });
    div.appendChild(linha);
  });
  return div;
}

async function montarEditoriais(livro, o, logos) {
  var doc = livro.doc, A = livro.A, extras = [];
  o = Object.assign({}, o, { titulo: (o.titulo || '').trim() || 'Sem título' });
  var aut = pessoas(o.autores), org = pessoas(o.organizadores);
  var nomesAut = aut.map(function (p) { return p.nome; }), nomesOrg = org.map(function (p) { return p.nome; });
  function sec(tipo, et, role, titulo, cls) { return { tipo: tipo, def: { et: et, role: role, parte: 'front' }, id: tipo, titulo: titulo, cont: el(doc, 'div', cls ? { 'class': cls } : null), subtitulos: [], gerada: true }; }

  // capa
  var capa = sec('capa', 'cover', '', 'Capa', 'capa');
  capa.cont.appendChild(el(doc, 'img', { src: '../img/capa.jpg', alt: 'Capa do livro “' + o.titulo + (o.subtitulo ? ': ' + o.subtitulo : '') + '”' + (nomesAut.length ? ', de ' + frase(nomesAut) : nomesOrg.length ? ', organização de ' + frase(nomesOrg) : '') + '. ' + cfg.editora.nome + '.', role: 'doc-cover' }));
  extras.push(capa);

  // falsa folha de rosto
  var falsa = sec('falsa-rosto', 'halftitlepage', '', 'Falsa folha de rosto', 'falsa-rosto');
  falsa.cont.appendChild(el(doc, 'p', null, [o.titulo]));
  extras.push(falsa);

  // folha de rosto
  var rosto = sec('rosto', 'titlepage', '', 'Folha de rosto', 'rosto');
  if (nomesAut.length) rosto.cont.appendChild(el(doc, 'p', { 'class': 'r-autores' }, [nomesAut.join(' · ')]));
  else if (nomesOrg.length) rosto.cont.appendChild(el(doc, 'p', { 'class': 'r-autores' }, [nomesOrg.join(' · '), el(doc, 'br'), (nomesOrg.length > 1 ? '(organizadores)' : '(organização)')]));
  rosto.cont.appendChild(el(doc, 'h1', { 'class': 'r-titulo' }, [o.titulo]));
  if (o.subtitulo) rosto.cont.appendChild(el(doc, 'p', { 'class': 'r-subtitulo' }, [o.subtitulo]));
  if (nomesAut.length && nomesOrg.length) rosto.cont.appendChild(el(doc, 'p', null, ['Organização: ' + frase(nomesOrg)]));
  rosto.cont.appendChild(el(doc, 'p', { 'class': 'r-edicao' }, [((o.edicao || '1').replace(/\D/g, '') || '1') + 'ª edição']));
  var selo = logos.find(function (l) { return l.id === 'icet' && l.arquivoEpub; });
  if (selo) rosto.cont.appendChild(el(doc, 'img', { 'class': 'r-selo', src: '../' + selo.arquivoEpub, alt: 'Selo: ' + cfg.editora.nome }));
  rosto.cont.appendChild(el(doc, 'p', { 'class': 'r-local' }, [cfg.editora.nome]));
  rosto.cont.appendChild(el(doc, 'p', null, [(o.local || (cfg.editora.cidade + ', ' + cfg.editora.uf)) + ' · ' + o.ano]));
  rosto.cont.appendChild(regua(doc, logos));
  extras.push(rosto);

  // verso da folha de rosto: créditos, conselho, ficha catalográfica
  var cred = sec('creditos', 'copyright-page', '', 'Créditos e ficha catalográfica', 'creditos');
  var autoresTodos = nomesAut.length ? nomesAut : nomesOrg;
  var LIC = {
    'todos': 'Todos os direitos reservados. Nenhuma parte desta obra pode ser reproduzida, armazenada ou transmitida, por qualquer meio, sem autorização prévia e por escrito dos autores e da editora (Lei nº 9.610/1998).',
    'cc-by': 'Esta obra está licenciada sob a licença Creative Commons Atribuição 4.0 Internacional (CC BY 4.0).',
    'cc-by-sa': 'Esta obra está licenciada sob a licença Creative Commons Atribuição-CompartilhaIgual 4.0 Internacional (CC BY-SA 4.0).',
    'cc-by-nc': 'Esta obra está licenciada sob a licença Creative Commons Atribuição-NãoComercial 4.0 Internacional (CC BY-NC 4.0).',
    'cc-by-nc-sa': 'Esta obra está licenciada sob a licença Creative Commons Atribuição-NãoComercial-CompartilhaIgual 4.0 Internacional (CC BY-NC-SA 4.0).',
    'cc-by-nc-nd': 'Esta obra está licenciada sob a licença Creative Commons Atribuição-NãoComercial-SemDerivações 4.0 Internacional (CC BY-NC-ND 4.0).'
  };
  var licTxt = (o.direitosTexto || '').trim() ? o.direitosTexto.trim().replace(/^©\s*\d{4}\s*[^.]*\.\s*/, '') : (LIC[o.licenca] || LIC.todos);
  livro.direitos = '© ' + o.ano + ' ' + frase(autoresTodos) + '. ' + licTxt;
  cred.cont.appendChild(el(doc, 'p', { 'class': 'direitos' }, ['© ' + o.ano + ' ' + frase(autoresTodos), el(doc, 'br'), licTxt]));
  var indig = aut.concat(org).filter(function (p) { return p.indigena; });
  cred.cont.appendChild(el(doc, 'p', { 'class': 'selo-politica' }, [cfg.editora.nome + ' — selo editorial de autoria indígena do ' + cfg.editora.mantenedora + '.' + (indig.length ? ' Autoria indígena: ' + frase(indig.map(function (p) { return p.nome + ' (' + p.povo + ')'; })) + '.' : '')]));
  if (o.ctDeclaracao && o.ctTexto) cred.cont.appendChild(el(doc, 'p', null, [o.ctTexto]));
  if (cfg.conselho.length) {
    cred.cont.appendChild(el(doc, 'h2', null, ['Conselho Editorial']));
    var ul = el(doc, 'ul');
    cfg.conselho.forEach(function (m) { ul.appendChild(el(doc, 'li', null, [m.nome + (m.vinculo ? ' — ' + m.vinculo : '')])); });
    cred.cont.appendChild(ul);
  }
  var eq = cfg.equipe, linhasEq = [['Edição', eq.editor], ['Revisão', eq.revisao], ['Projeto gráfico', eq.projetoGrafico], ['Capa', eq.capa], ['Diagramação digital', eq.diagramacao]].filter(function (x) { return x[1]; });
  if (linhasEq.length) {
    cred.cont.appendChild(el(doc, 'h2', null, ['Equipe editorial']));
    var ul2 = el(doc, 'ul'); linhasEq.forEach(function (x) { ul2.appendChild(el(doc, 'li', null, [x[0] + ': ' + x[1]])); }); cred.cont.appendChild(ul2);
  }
  var f = fichaCatalografica(o, livro);
  var ficha = el(doc, 'div', { 'class': 'ficha', role: 'region', 'aria-label': 'Ficha catalográfica' });
  ficha.appendChild(el(doc, 'p', { 'class': 'cip' }, ['Dados Internacionais de Catalogação na Publicação (CIP)']));
  var corpo = el(doc, 'div', { 'class': 'corpo' });
  if (f.cutter) corpo.appendChild(el(doc, 'span', { 'class': 'cutter' }, [f.cutter]));
  if (f.principal) corpo.appendChild(el(doc, 'p', null, [f.principal]));
  corpo.appendChild(el(doc, 'p', null, [f.titulo + ' – ' + f.imprenta]));
  corpo.appendChild(el(doc, 'p', null, [f.desc]));
  if (f.isbn) corpo.appendChild(el(doc, 'p', null, [f.isbn]));
  if (f.pistas) corpo.appendChild(el(doc, 'p', null, [f.pistas]));
  var cl = [f.cdd ? 'CDD ' + f.cdd : '', f.cdu ? 'CDU ' + f.cdu : ''].filter(Boolean).join(' · ');
  if (cl) corpo.appendChild(el(doc, 'p', { 'class': 'cdd' }, [cl]));
  ficha.appendChild(corpo);
  cred.cont.appendChild(ficha);
  if (eq.bibliotecario) cred.cont.appendChild(el(doc, 'p', { 'class': 'ficha-autoria' }, ['Ficha catalográfica elaborada por ' + eq.bibliotecario + (eq.crb ? ' – ' + eq.crb : '')]));
  var ed = cfg.editora;
  var contato = [ed.nome, ed.mantenedora, ed.endereco, (ed.cidade + ' – ' + ed.uf), ed.email, ed.site].filter(Boolean);
  cred.cont.appendChild(el(doc, 'h2', null, ['Editora']));
  contato.forEach(function (l) { cred.cont.appendChild(el(doc, 'p', null, [l])); });
  extras.push(cred);
  livro.ficha = f;

  // listas (NBR 6029, elementos opcionais)
  var minimo = o.listas === 'sempre' ? 1 : o.listas === 'nunca' ? 1e9 : 3;
  function lista(id, et, titulo, itens) {
    var s = sec(id, et, '', titulo, 'lista');
    s.cont.appendChild(el(doc, 'h1', { 'class': 'titulo-centro' }, [titulo]));
    var ol = el(doc, 'ol');
    itens.forEach(function (it) { ol.appendChild(el(doc, 'li', null, [el(doc, 'a', { href: '#', 'data-alvo': it.alvo }, [it.texto])])); });
    s.cont.appendChild(ol); return s;
  }
  livro.listasGeradas = [];
  if (livro.ilustracoes.length >= minimo) { var li = lista('lista-ilustracoes', 'loi', 'Lista de ilustrações', livro.ilustracoes.map(function (x) { return { alvo: x.id, texto: x.rotulo + ' – ' + x.titulo }; })); livro.listasGeradas.push(li); }
  if (livro.tabelas.length >= minimo) { var lt = lista('lista-tabelas', 'lot', 'Lista de tabelas e quadros', livro.tabelas.map(function (x) { return { alvo: x.id, texto: x.rotulo + ' – ' + x.titulo }; })); livro.listasGeradas.push(lt); }
  if (livro.siglas.length >= minimo) {
    var ls = sec('lista-siglas', '', '', 'Lista de abreviaturas e siglas', 'lista');
    ls.cont.appendChild(el(doc, 'h1', { 'class': 'titulo-centro' }, ['Lista de abreviaturas e siglas']));
    var dl = el(doc, 'dl');
    livro.siglas.forEach(function (x) { dl.appendChild(el(doc, 'dt', null, [el(doc, 'strong', null, [x.sigla])])); dl.appendChild(el(doc, 'dd', null, [x.nome])); });
    ls.cont.appendChild(dl); livro.listasGeradas.push(ls);
  }

  // sumário (NBR 6027)
  var sum = sec('sumario', 'toc', 'doc-toc', 'Sumário');
  livro.sumario = sum;

  // colofão e licenças
  var col = { tipo: 'colofao', def: { et: 'colophon', role: 'doc-colophon', parte: 'back' }, id: 'colofao', titulo: 'Colofão', cont: el(doc, 'div', { 'class': 'colofao' }), subtitulos: [], gerada: true };
  var d = new Date();
  col.cont.appendChild(el(doc, 'img', { 'class': 'vinheta', src: '../img/vinheta.svg', alt: '', role: 'presentation' }));
  col.cont.appendChild(el(doc, 'p', null, ['Este livro foi editado pela ' + cfg.editora.nome + ', selo editorial do ' + cfg.editora.mantenedora + ', em ' + cfg.editora.cidade + ', ' + cfg.editora.uf + ', em ' + MESES[d.getMonth()] + ' de ' + d.getFullYear() + '.']));
  col.cont.appendChild(el(doc, 'p', null, ['Composto em Literata e Cinzel, fontes de licença livre (SIL Open Font License 1.1).']));
  col.cont.appendChild(el(doc, 'p', null, ['Livro digital em EPUB 3, produzido e auditado pelo motor editorial da Editora conforme as normas da ABNT e as diretrizes de acessibilidade EPUB.']));
  col.cont.appendChild(el(doc, 'p', null, [el(doc, 'a', { href: 'licencas.xhtml' }, ['Licenças das fontes tipográficas'])]));
  var lic = { tipo: 'licencas', def: { et: '', role: '', parte: 'back' }, id: 'licencas', titulo: 'Licenças das fontes', cont: el(doc, 'div', { 'class': 'licencas' }), subtitulos: [], gerada: true, naoLinear: true };
  lic.cont.appendChild(el(doc, 'h1', { 'class': 'titulo-centro' }, ['Licenças das fontes']));
  var ofl = '';
  try { ofl = await (await fetch(BASE + 'fontes/OFL-Literata.txt')).text(); } catch (e) {}
  lic.cont.appendChild(el(doc, 'p', null, ['Literata — Copyright 2017 The Literata Project Authors (https://github.com/googlefonts/literata). Cinzel — Copyright 2020 The Cinzel Project Authors (https://github.com/NDISCOVER/Cinzel). Ambas licenciadas sob a SIL Open Font License, versão 1.1, reproduzida a seguir.']));
  if (ofl) lic.cont.appendChild(el(doc, 'pre', null, [ofl.replace(/^Copyright[^\n]*\n+/, '')]));
  return { capa: capa, falsa: falsa, rosto: rosto, creditos: cred, sumario: sum, colofao: col, licencas: lic };
}

/* ───────────────────────── 10. EMPACOTAMENTO EPUB 3 ───────────────────────── */
var XML = '<?xml version="1.0" encoding="UTF-8"?>\n';
function serial(no) { return new XMLSerializer().serializeToString(no).replace(/ xmlns="http:\/\/www\.w3\.org\/1999\/xhtml"/g, ''); }
function xhtml(titulo, corpoHtml, tipoBody) {
  return XML + '<!DOCTYPE html>\n<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="pt-BR" lang="pt-BR">\n<head>\n<meta charset="UTF-8"/>\n<title>' + esc(titulo) + '</title>\n<link rel="stylesheet" type="text/css" href="../css/livro.css"/>\n</head>\n<body' + (tipoBody ? ' epub:type="' + tipoBody + '"' : '') + '>\n' + corpoHtml + '\n</body>\n</html>\n';
}
function limparControles(s) { return s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, ''); }

function montarSecaoHtml(livro, s) {
  var doc = livro.doc, d = s.def, cls = d.parte === 'front' ? 'pre' : d.parte === 'back' ? 'pos' : 'texto';
  var attrs = { id: s.id, 'class': cls + ' ' + s.tipo };
  if (d.et) attrs['epub:type'] = d.et;
  if (d.role && s.tipo !== 'sumario') attrs.role = d.role;
  var secEl = el(doc, s.tipo === 'sumario' ? 'nav' : 'section', attrs);
  if (s.tipo === 'sumario') { secEl.setAttribute('class', 'sumario'); secEl.setAttribute('role', 'doc-toc'); secEl.setAttribute('aria-labelledby', 't-sumario'); }
  if (s.gerada) {
    while (s.cont.firstChild) secEl.appendChild(s.cont.firstChild);
    if (s.tipo === 'creditos' || s.tipo === 'falsa-rosto' || s.tipo === 'rosto' || s.tipo === 'capa' || s.tipo === 'colofao') secEl.setAttribute('aria-label', s.titulo);
    if (s.cont.className) secEl.setAttribute('class', (secEl.getAttribute('class') || '') + ' ' + s.cont.className);
    return secEl;
  }
  if (d.semTitulo) secEl.setAttribute('aria-label', s.titulo);
  else if (s.tipo === 'parte') {
    if (s.rotulo) secEl.appendChild(el(doc, 'span', { 'class': 'rotulo-parte' }, [s.rotulo]));
    secEl.appendChild(el(doc, 'h1', { id: 't-' + s.id }, [s.titulo]));
  } else if (s.tipo === 'capitulo' || s.tipo === 'abertura') {
    var ab = el(doc, 'div', { 'class': 'abre-capitulo' });
    if (s.rotulo) ab.appendChild(el(doc, 'span', { 'class': 'rotulo-cap' }, [s.rotulo]));
    var h1 = el(doc, 'h1', { id: 't-' + s.id });
    if (s.numero) h1.appendChild(el(doc, 'span', { 'class': 'indicativo' }, [s.numero]));
    h1.appendChild(doc.createTextNode(s.titulo));
    if (s.tipo === 'abertura' && !s.tituloOrig) secEl.setAttribute('aria-label', 'Abertura');
    else ab.appendChild(h1);
    ab.appendChild(el(doc, 'img', { 'class': 'vinheta', src: '../img/vinheta.svg', alt: '', role: 'presentation' }));
    secEl.appendChild(ab);
    if (s.autoria) secEl.appendChild(el(doc, 'p', { 'class': 'autoria-cap' }, [s.autoria]));
  } else {
    secEl.appendChild(el(doc, 'h1', { id: 't-' + s.id, 'class': 'titulo-centro' }, [s.titulo]));
  }
  if (s.cont.className) secEl.setAttribute('class', secEl.getAttribute('class') + ' ' + s.cont.className);
  while (s.cont.firstChild) secEl.appendChild(s.cont.firstChild);
  return secEl;
}

function preencherSumario(livro, ordem) {
  var doc = livro.doc, sum = livro.sumario;
  sum.cont.appendChild(el(doc, 'h1', { id: 't-sumario', 'class': 'titulo-centro' }, ['Sumário']));
  var ol = el(doc, 'ol'), olParte = null;
  ordem.forEach(function (s) {
    if (!s.def.sum || s.gerada) return;
    var li, a;
    if (s.tipo === 'parte') {
      li = el(doc, 'li', { 'class': 's-parte' }, [el(doc, 'a', { href: s.arquivo }, [(s.rotulo ? s.rotulo + ' – ' : '') + s.titulo])]);
      olParte = el(doc, 'ol'); li.appendChild(olParte); ol.appendChild(li); return;
    }
    var alvo = (olParte && (s.tipo === 'capitulo' || s.tipo === 'abertura')) ? olParte : ol;
    if (!(s.tipo === 'capitulo' || s.tipo === 'abertura')) olParte = null;
    a = el(doc, 'a', { href: s.arquivo });
    if (s.numero) a.appendChild(el(doc, 'span', { 'class': 's-num' }, [s.numero]));
    a.appendChild(doc.createTextNode((s.rotulo ? s.rotulo + ' – ' : '') + s.titulo));
    li = el(doc, 'li', { 'class': s.tipo === 'capitulo' ? 's-cap' : '' }, [a]);
    if (s.autoria) li.appendChild(el(doc, 'span', { 'class': 's-autoria' }, [s.autoria]));
    var maxN = livro.modo === 'abnt' ? 3 : 2;
    var subs = s.subtitulos.filter(function (x) { return x.nivel <= maxN; });
    if (subs.length && /^(capitulo|abertura|apendice|anexo)$/.test(s.tipo)) {
      var pilha = [{ nivel: 1, ol: el(doc, 'ol') }];
      li.appendChild(pilha[0].ol);
      subs.forEach(function (x) {
        while (pilha.length > 1 && pilha[pilha.length - 1].nivel >= x.nivel) pilha.pop();
        var topo = pilha[pilha.length - 1];
        var a2 = el(doc, 'a', { href: s.arquivo + '#' + x.id });
        if (x.ind) a2.appendChild(el(doc, 'span', { 'class': 's-num' }, [x.ind]));
        a2.appendChild(doc.createTextNode(x.texto));
        var li2 = el(doc, 'li', null, [a2]);
        topo.ol.appendChild(li2);
        var sub = el(doc, 'ol'); li2.appendChild(sub);
        pilha.push({ nivel: x.nivel, ol: sub });
      });
      li.querySelectorAll('ol').forEach(function (o_) { if (!o_.children.length) o_.remove(); });
    }
    alvo.appendChild(li);
  });
  sum.cont.appendChild(ol);
}

function navXhtml(livro, ordem, landmarks) {
  function itens(lista) {
    return '<ol>\n' + lista.map(function (s) {
      var sub = '';
      if (s.subtitulos.length && /^(capitulo|abertura|apendice|anexo)$/.test(s.tipo)) {
        var nivel2 = s.subtitulos.filter(function (x) { return x.nivel === 2; });
        if (nivel2.length) sub = '<ol>' + nivel2.map(function (x) { return '<li><a href="text/' + s.arquivo + '#' + x.id + '">' + esc((x.ind ? x.ind + ' ' : '') + x.texto) + '</a></li>'; }).join('') + '</ol>';
      }
      return '<li><a href="text/' + s.arquivo + '">' + esc(rotuloNav(s)) + '</a>' + sub + '</li>';
    }).join('\n') + '\n</ol>';
  }
  var visiveis = ordem.filter(function (s) { return !s.naoLinear && s.tipo !== 'capa'; });
  var corpo = '<nav epub:type="toc" id="toc" role="doc-toc"><h1>Sumário</h1>\n' + itens(visiveis) + '</nav>\n';
  corpo += '<nav epub:type="landmarks" id="landmarks" hidden=""><h2>Pontos de referência</h2><ol>' + landmarks.map(function (l) { return '<li><a epub:type="' + l[0] + '" href="text/' + l[1] + '">' + esc(l[2]) + '</a></li>'; }).join('') + '</ol></nav>';
  return XML + '<!DOCTYPE html>\n<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="pt-BR" lang="pt-BR">\n<head><meta charset="UTF-8"/><title>Sumário</title><link rel="stylesheet" type="text/css" href="css/livro.css"/></head>\n<body>\n' + corpo + '\n</body>\n</html>\n';
}
function rotuloNav(s) { return (s.numero ? s.numero + ' ' : '') + (s.rotulo ? s.rotulo + ' – ' : '') + s.titulo; }
function ncx(livro, ordem, idPub, titulo) {
  var k = 0;
  var pontos = ordem.filter(function (s) { return !s.naoLinear; }).map(function (s) { k++; return '<navPoint id="np' + k + '" playOrder="' + k + '"><navLabel><text>' + esc(rotuloNav(s)) + '</text></navLabel><content src="text/' + s.arquivo + '"/></navPoint>'; }).join('\n');
  return XML + '<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1" xml:lang="pt-BR">\n<head><meta name="dtb:uid" content="' + esc(idPub) + '"/><meta name="dtb:depth" content="1"/><meta name="dtb:totalPageCount" content="0"/><meta name="dtb:maxPageNumber" content="0"/></head>\n<docTitle><text>' + esc(titulo) + '</text></docTitle>\n<navMap>\n' + pontos + '\n</navMap>\n</ncx>\n';
}

async function empacotar(livro, o, logos, editoriais, opcoes) {
  var A = livro.A, doc = livro.doc;
  o = Object.assign({}, o, { titulo: (o.titulo || '').trim() || 'Sem título' });
  var zip = new window.JSZip();
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  zip.file('META-INF/container.xml', XML + '<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>\n');
  zip.file('META-INF/com.apple.ibooks.display-options.xml', XML + '<display_options><platform name="*"><option name="specified-fonts">true</option></platform></display_options>\n');

  var manifesto = [], arquivos = {};
  function add(caminho, dados, mime, id, props) { zip.file('OEBPS/' + caminho, dados); manifesto.push({ id: id, href: caminho, mime: mime, props: props }); arquivos[caminho] = true; }

  // CSS e fontes
  var css = await (await fetch(BASE + 'livro.css?v=' + VERSAO)).text();
  add('css/livro.css', css, 'text/css', 'css');
  for (var i = 0; i < FONTES_EPUB.length; i++) {
    var fb = new Uint8Array(await (await fetch(BASE + 'fontes/' + FONTES_EPUB[i])).arrayBuffer());
    add('fontes/' + FONTES_EPUB[i], fb, 'application/font-woff', 'font-' + i);
  }
  add('img/vinheta.svg', await (await fetch(BASE + 'vinheta.svg')).text(), 'image/svg+xml', 'vinheta');

  // capa
  var capaBytes;
  var fonteCapa = o.capaPropria || (!o.capaGerada && livro.meta.capa) || '';
  if (fonteCapa) { var dc = dataUrlParaBytes(fonteCapa); var nz = dc && await normalizarImagem(dc.bytes, dc.mime); if (nz) { var bm = await decodificarImagem(nz.bytes, nz.mime); nz = await canvasPara(await aparar(bm), 2560, 'image/jpeg', 0.9); } capaBytes = nz ? nz.bytes : null; }
  if (!capaBytes) capaBytes = await gerarCapa(o, logos);
  livro.capaBytes = capaBytes;
  add('img/capa.jpg', capaBytes, 'image/jpeg', 'img-capa', 'cover-image');

  // logomarcas
  logos.forEach(function (l) {
    if (!l.dados || !l.arquivoEpub) return;
    add(l.arquivoEpub, l.dados.bytes, l.dados.mime === 'image/png' || l.dados.mime === 'image/svg+xml' ? l.dados.mime : 'image/jpeg', 'logo-' + l.id);
  });
  // ilustrações
  livro.imagens.forEach(function (im) { add(im.arquivo, im.bytes, im.mime, im.id); });

  // ordem de leitura
  var ed = editoriais;
  var pre = livro.secoes.filter(function (s) { return s.def.parte === 'front' && !/^(apresentacao|prefacio)$/.test(s.tipo); });
  var aprPref = livro.secoes.filter(function (s) { return /^(apresentacao|prefacio)$/.test(s.tipo); });
  var corpo = livro.secoes.filter(function (s) { return s.def.parte === 'body'; });
  var pos = livro.secoes.filter(function (s) { return s.def.parte === 'back'; });
  var indiceSec = null;
  var ordem = [ed.capa, ed.falsa, ed.rosto, ed.creditos].concat(pre, livro.listasGeradas || [], [ed.sumario], aprPref, corpo, pos);
  // nomes de arquivo
  var nCap = 0;
  ordem.forEach(function (s) { s.arquivo = (s.tipo === 'capitulo' || s.tipo === 'abertura') ? 'cap-' + pad(++nCap) + '.xhtml' : (s.gerada ? s.id : s.id.replace(/[^a-z0-9\-]/gi, '')) + '.xhtml'; });

  // índice remissivo
  if (opcoes.indice) {
    var termos = String(o.termosIndice || '').split(/\n|;/).concat(livro.termosIndice || []).map(function (t) { return t.trim(); }).filter(Boolean);
    if (termos.length) {
      var entradas = gerarIndice(livro, termos);
      if (entradas.length) {
        indiceSec = { tipo: 'indice', def: { et: 'index', role: 'doc-index', parte: 'back', sum: true }, id: 'indice', titulo: 'Índice remissivo', cont: el(doc, 'div', { 'class': 'indice-remissivo' }), subtitulos: [], arquivo: 'indice.xhtml' };
        var letraAt = '', ul = null;
        entradas.forEach(function (e) {
          var L = N(e.termo)[0] || '#';
          if (L !== letraAt) { letraAt = L; indiceSec.cont.appendChild(el(doc, 'h2', null, [L])); ul = el(doc, 'ul'); indiceSec.cont.appendChild(ul); }
          var li = el(doc, 'li', null, [e.termo + ': ']);
          e.locais.forEach(function (lc, j) {
            if (j) li.appendChild(doc.createTextNode(', '));
            var lab = lc.secao.numero ? 'cap. ' + lc.secao.numero : (lc.secao.rotulo ? lc.secao.rotulo.replace('Capítulo', 'cap.') : lc.secao.titulo.length > 28 ? lc.secao.titulo.slice(0, 26) + '…' : lc.secao.titulo);
            li.appendChild(el(doc, 'a', { href: lc.secao.arquivo + '#' + lc.id }, [lab]));
          });
          ul.appendChild(li);
        });
        ordem.push(indiceSec);
        A.corr('Índice remissivo com links gerado (NBR 6034)', entradas.length);
      }
    } else A.add('info', 'Índice', 'Índice remissivo não gerado: nenhum termo informado.', { norma: 'NBR 6034', sug: 'Informe os termos na aba “Dados da obra” ou ative a IA para sugestão automática.' });
  }
  var sobre = ordem.filter(function (s) { return s.tipo === 'sobre'; });
  ordem = ordem.filter(function (s) { return s.tipo !== 'sobre'; }).concat(sobre, [ed.colofao, ed.licencas]);
  ed.colofao.arquivo = 'colofao.xhtml'; ed.licencas.arquivo = 'licencas.xhtml';
  // remissões de listas e índice usam o nome do arquivo da seção
  var alvos = {};
  livro.ilustracoes.concat(livro.tabelas).forEach(function (x) { alvos[x.id] = x.secao.arquivo + '#' + x.id; });
  (livro.listasGeradas || []).forEach(function (ls) { ls.cont.querySelectorAll('a[data-alvo]').forEach(function (a) { a.setAttribute('href', alvos[a.getAttribute('data-alvo')] || '#'); a.removeAttribute('data-alvo'); }); });
  preencherSumario(livro, ordem);

  // gera cada XHTML
  var paginas = [], ids = {}, links = [];
  ordem.forEach(function (s, k) {
    var secEl = montarSecaoHtml(livro, s);
    var html = limparControles(serial(secEl));
    var tipoBody = s.def.parte === 'front' ? 'frontmatter' : s.def.parte === 'back' ? 'backmatter' : 'bodymatter';
    var arq = xhtml(s.tipo === 'capa' ? o.titulo : s.titulo, html, tipoBody);
    paginas.push({ s: s, arq: arq });
    var dd = new DOMParser().parseFromString(arq, 'application/xhtml+xml');
    if (dd.getElementsByTagName('parsererror').length) A.add('bloqueante', 'Técnico', 'XHTML malformado em ' + s.arquivo + ': ' + txt(dd.getElementsByTagName('parsererror')[0]).slice(0, 160), { onde: s.titulo });
    ids[s.arquivo] = {};
    Array.prototype.forEach.call(dd.querySelectorAll('[id]'), function (e) { if (ids[s.arquivo][e.id]) A.add('bloqueante', 'Técnico', 'Identificador duplicado “' + e.id + '” em ' + s.arquivo, { onde: s.titulo }); ids[s.arquivo][e.id] = 1; });
    Array.prototype.forEach.call(dd.querySelectorAll('a[href]'), function (a) { links.push({ de: s.arquivo, href: a.getAttribute('href') }); });
    Array.prototype.forEach.call(dd.querySelectorAll('img'), function (im) { var src = (im.getAttribute('src') || '').replace(/^\.\.\//, ''); if (!arquivos[src]) A.add('bloqueante', 'Técnico', 'Imagem referenciada e não empacotada: ' + src, { onde: s.titulo }); });
    add('text/' + s.arquivo, arq, 'application/xhtml+xml', 'x-' + s.arquivo.replace(/\.xhtml$/, '').replace(/[^a-z0-9\-]/gi, ''), dd.querySelector('svg') ? 'svg' : null);
  });
  var quebrados = 0;
  links.forEach(function (l) {
    if (/^(https?:|mailto:|tel:)/i.test(l.href)) return;
    var p = l.href.split('#'), arq = p[0] || l.de, frag = p[1];
    if (!ids[arq]) { quebrados++; return; }
    if (frag && !ids[arq][frag]) quebrados++;
  });
  if (quebrados) A.add('bloqueante', 'Técnico', quebrados + ' link(s) interno(s) quebrado(s).', {});
  livro.ordem = ordem; livro.paginas = paginas;

  // nav, ncx, opf
  var landmarks = [['cover', ed.capa.arquivo, 'Capa'], ['titlepage', ed.rosto.arquivo, 'Folha de rosto'], ['toc', ed.sumario.arquivo, 'Sumário']];
  var primeiro = ordem.find(function (s) { return s.def.parte === 'body'; }); if (primeiro) landmarks.push(['bodymatter', primeiro.arquivo, 'Início do texto']);
  var bib = ordem.find(function (s) { return s.tipo === 'referencias'; }); if (bib) landmarks.push(['bibliography', bib.arquivo, 'Referências']);
  if (indiceSec) landmarks.push(['index', indiceSec.arquivo, 'Índice remissivo']);
  var idPub = isbnValido(o.isbn) ? 'urn:isbn:' + isbnLimpo(o.isbn) : 'urn:uuid:' + (livro.uuid || (livro.uuid = uuid()));
  add('nav.xhtml', navXhtml(livro, ordem, landmarks), 'application/xhtml+xml', 'nav', 'nav');
  add('toc.ncx', ncx(livro, ordem, idPub, o.titulo), 'application/x-dtbncx+xml', 'ncx');

  var aut = pessoas(o.autores), org = pessoas(o.organizadores);
  var md = ['<dc:identifier id="pub-id">' + esc(idPub) + '</dc:identifier>',
    '<dc:title id="titulo">' + esc(o.titulo) + '</dc:title>', '<meta refines="#titulo" property="title-type">main</meta>'];
  if (o.subtitulo) md.push('<dc:title id="subtitulo">' + esc(o.subtitulo) + '</dc:title>', '<meta refines="#subtitulo" property="title-type">subtitle</meta>');
  aut.forEach(function (p, i) { md.push('<dc:creator id="aut' + i + '">' + esc(p.nome) + '</dc:creator>', '<meta refines="#aut' + i + '" property="role" scheme="marc:relators">aut</meta>', '<meta refines="#aut' + i + '" property="file-as">' + esc(nomeFicha(p.nome)) + '</meta>'); });
  org.forEach(function (p, i) { md.push('<dc:creator id="org' + i + '">' + esc(p.nome) + '</dc:creator>', '<meta refines="#org' + i + '" property="role" scheme="marc:relators">edt</meta>', '<meta refines="#org' + i + '" property="file-as">' + esc(nomeFicha(p.nome)) + '</meta>'); });
  md.push('<dc:language>pt-BR</dc:language>', '<dc:publisher>' + esc(cfg.editora.nome) + '</dc:publisher>', '<dc:date>' + esc(/^\d{4}$/.test(o.ano) ? o.ano : String(new Date().getFullYear())) + '</dc:date>');
  String(o.palavrasChave || '').split(/;|\n/).map(function (x) { return x.trim(); }).filter(Boolean).forEach(function (k) { md.push('<dc:subject>' + esc(k) + '</dc:subject>'); });
  if (o.sinopse) md.push('<dc:description>' + esc(o.sinopse) + '</dc:description>');
  md.push('<dc:rights>' + esc(livro.direitos) + '</dc:rights>');
  if (isbnValido(o.isbnImpresso)) md.push('<dc:source>urn:isbn:' + isbnLimpo(o.isbnImpresso) + '</dc:source>');
  md.push('<meta property="dcterms:modified">' + new Date().toISOString().replace(/\.\d+Z$/, 'Z') + '</meta>');
  if (o.serie) md.push('<meta property="belongs-to-collection" id="serie">' + esc(o.serie) + '</meta>', '<meta refines="#serie" property="collection-type">series</meta>');
  md.push('<meta name="cover" content="img-capa"/>');
  // acessibilidade (metadados schema.org)
  md.push('<meta property="schema:accessMode">textual</meta>', '<meta property="schema:accessMode">visual</meta>');
  var a11yGrave = A.itens.some(function (x) { return x.cat === 'Acessibilidade' && (x.sev === 'grave' || x.sev === 'bloqueante'); });
  md.push('<meta property="schema:accessModeSufficient">textual' + (a11yGrave ? ',visual' : '') + '</meta>');
  ['tableOfContents', 'readingOrder', 'structuralNavigation', 'displayTransformability'].concat(a11yGrave ? [] : ['alternativeText']).concat(indiceSec ? ['index'] : []).concat(livro.tabelas.length ? ['table'] : []).forEach(function (f) { md.push('<meta property="schema:accessibilityFeature">' + f + '</meta>'); });
  md.push('<meta property="schema:accessibilityHazard">none</meta>');
  md.push('<meta property="schema:accessibilitySummary">' + esc('Livro digital refluível com sumário navegável, ordem de leitura lógica, títulos estruturados, notas interativas' + (a11yGrave ? '' : ', textos alternativos nas imagens') + ' e texto ajustável pelo leitor. Produzido pela ' + cfg.editora.nome + '.') + '</meta>');
  if (!a11yGrave && !A.itens.some(function (x) { return x.cat === 'Técnico' && x.sev === 'bloqueante'; })) md.push('<meta property="dcterms:conformsTo">EPUB Accessibility 1.1 - WCAG 2.1 Level AA</meta>', '<meta property="a11y:certifiedBy">' + esc(cfg.editora.nome) + '</meta>');
  var man = manifesto.map(function (m) { return '<item id="' + m.id + '" href="' + esc(m.href) + '" media-type="' + m.mime + '"' + (m.props ? ' properties="' + m.props + '"' : '') + '/>'; }).join('\n    ');
  var spine = ordem.map(function (s) { return '<itemref idref="x-' + s.arquivo.replace(/\.xhtml$/, '').replace(/[^a-z0-9\-]/gi, '') + '"' + (s.naoLinear ? ' linear="no"' : '') + '/>'; }).join('\n    ');
  var opf = XML + '<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="pub-id" xml:lang="pt-BR" dir="ltr">\n  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">\n    ' + md.join('\n    ') + '\n  </metadata>\n  <manifest>\n    ' + man + '\n  </manifest>\n  <spine toc="ncx">\n    ' + spine + '\n  </spine>\n</package>\n';
  zip.file('OEBPS/content.opf', opf);
  var blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/epub+zip', compression: 'DEFLATE', compressionOptions: { level: 9 } });
  livro.css = css;
  return blob;
}

/* ───────────────────────── 11. AUDITORIA EDITORIAL ───────────────────────── */
function auditarObra(o, A, logos) {
  if (!o.titulo) A.add('bloqueante', 'Metadados', 'Título da obra não informado.', { sug: 'Preencha na aba “Dados da obra”.' });
  var aut = pessoas(o.autores), org = pessoas(o.organizadores);
  if (!aut.length && !org.length) A.add('bloqueante', 'Metadados', 'Nenhum autor ou organizador informado.', { sug: 'Informe um por linha: Nome completo; Povo (se indígena).' });
  if (cfg.regras.exigeAutorIndigena && (aut.length || org.length) && !aut.concat(org).some(function (p) { return p.indigena; }))
    A.add('bloqueante', 'Selo', 'Política do selo: nenhum autor ou organizador indígena declarado. Autores não indígenas só podem publicar se ao menos um dos autores for indígena.', { norma: 'Política editorial da Editora Cacique Enir Terena', sug: 'Indique o povo do(s) autor(es) indígena(s) após ponto e vírgula, por exemplo: Maria Terena; Terena.' });
  if (!o.isbn) A.add('bloqueante', 'ISBN', 'ISBN do livro digital não informado.', { norma: 'Lei 10.753/2003 (Política Nacional do Livro), art. 6º', sug: 'Solicite o ISBN do e-book à Câmara Brasileira do Livro (agência brasileira do ISBN). O e-book precisa de ISBN próprio, diferente do impresso.' });
  else if (!isbnValido(o.isbn)) A.add('bloqueante', 'ISBN', 'ISBN inválido (dígito verificador não confere): ' + o.isbn, { norma: 'ISO 2108', sug: 'Confira o número junto à agência do ISBN.' });
  else {
    if (!/^97[89](65|85)/.test(isbnLimpo(o.isbn))) A.add('aviso', 'ISBN', 'ISBN sem prefixo de grupo brasileiro (978-65 ou 978-85).', { norma: 'ISO 2108' });
    if (o.isbnImpresso && isbnLimpo(o.isbnImpresso) === isbnLimpo(o.isbn)) A.add('bloqueante', 'ISBN', 'O ISBN do e-book é igual ao do livro impresso. Cada formato exige ISBN próprio.', { norma: 'ISO 2108' });
  }
  if (!cfg.conselho.length) A.add('bloqueante', 'Conselho', 'Conselho editorial não cadastrado. O selo exige a relação do conselho no verso da folha de rosto.', { norma: 'Política editorial da Editora', sug: 'Cadastre os membros na aba “Editora e conselho”.' });
  if (!cfg.equipe.bibliotecario || !cfg.equipe.crb) A.add('grave', 'Ficha', 'Ficha catalográfica sem bibliotecário(a) responsável e registro no CRB.', { norma: 'Lei 4.084/1962 (profissão de bibliotecário); Lei 10.753/2003, art. 6º', sug: 'A ficha (CIP) deve ser elaborada e assinada por bibliotecário(a) com registro no CRB.' });
  if (!o.cdd && !o.cdu) A.add('grave', 'Ficha', 'Classificação (CDD ou CDU) não informada na ficha catalográfica.', { sug: 'O(a) bibliotecário(a) define a classificação.' });
  if (!String(o.assuntos || '').trim()) A.add('grave', 'Ficha', 'Assuntos (cabeçalhos de assunto) não informados na ficha catalográfica.', { sug: 'Cabeçalhos definidos pelo(a) bibliotecário(a), com vocabulário controlado.' });
  if (aut.length > 3) A.add('info', 'Ficha', 'Obra com ' + aut.length + ' autores: pela AACR2, a entrada principal da ficha é pelo título, com os autores em entradas secundárias. Confirme com o(a) bibliotecário(a).', {});
  if (!o.cutter) A.add('aviso', 'Ficha', 'Notação de autor (Cutter-Sanborn ou PHA) não informada.', {});
  if (!o.sinopse) A.add('aviso', 'Metadados', 'Sinopse não informada (usada pelas lojas e bibliotecas digitais).', {});
  if (!o.palavrasChave) A.add('aviso', 'Metadados', 'Palavras-chave não informadas.', {});
  if (!/^\d{4}$/.test(o.ano || '')) A.add('grave', 'Metadados', 'Ano de publicação inválido.', {});
  logos.forEach(function (l) {
    if (!l.dados) A.add('bloqueante', 'Marcas', 'Logomarca oficial de ' + l.sigla + ' não carregada.', { sug: 'Envie o arquivo oficial (PNG ou JPG, ao menos 600 px) na aba “Logomarcas”, obtido no manual de identidade visual da instituição.' });
    else if (!l.autorizado) A.add('grave', 'Marcas', 'Uso da marca ' + l.sigla + ' sem autorização registrada.', { norma: 'Lei 9.279/1996 (propriedade industrial) e manuais de identidade visual', sug: 'Obtenha autorização formal da instituição e marque “uso autorizado” na aba “Logomarcas”.' });
  });
}
function resumoAuditoria(A) {
  var pontos = 100;
  A.itens.forEach(function (i) { pontos -= PESO[i.sev] || 0; });
  pontos = Math.max(0, pontos);
  var b = A.conta('bloqueante'), g = A.conta('grave');
  var status = b ? 'REPROVADO PARA PUBLICAÇÃO' : g ? 'APROVADO COM RESSALVAS' : 'APROVADO PARA PUBLICAÇÃO';
  return { pontos: pontos, status: status, classe: b ? 'rep' : g ? 'ress' : 'apr', b: b, g: g, a: A.conta('aviso'), i: A.conta('info') };
}
var CHECKLIST = [
  ['Selo', 'Política do selo (autoria indígena)'], ['Conselho', 'Conselho editorial'], ['ISBN', 'ISBN do livro digital (Lei 10.753/2003)'],
  ['Ficha', 'Ficha catalográfica — CIP'], ['Metadados', 'Metadados da publicação'], ['Estrutura', 'Estrutura e numeração (NBR 6029 e 6024)'],
  ['Citações', 'Citações (NBR 10520)'], ['Notas', 'Notas de rodapé (NBR 10520)'], ['Referências', 'Referências (NBR 6023)'],
  ['Ilustrações', 'Ilustrações e tabelas (NBR 6029; IBGE)'], ['Índice', 'Índice remissivo (NBR 6034)'], ['Marcas', 'Logomarcas institucionais'],
  ['Acessibilidade', 'Acessibilidade (LBI, art. 68; EPUB Accessibility 1.1)'], ['Técnico', 'Integridade técnica do EPUB 3'], ['Revisão', 'Revisão linguística (IA)']
];
function relatorioHtml(livro, o, res, revisao) {
  var A = livro.A, d = new Date();
  var porCat = {};
  A.itens.forEach(function (i) { var r = { bloqueante: 3, grave: 2, aviso: 1, info: 0 }[i.sev]; porCat[i.cat] = Math.max(porCat[i.cat] || 0, r); });
  var linhasCheck = CHECKLIST.map(function (c) {
    var r = porCat[c[0]] || 0, rot = r === 3 ? '✗ Bloqueante' : r === 2 ? '✗ Grave' : r === 1 ? '⚠ Avisos' : '✓ Conforme';
    if (c[0] === 'Revisão' && !revisao) rot = '— Não executada';
    return '<tr class="r' + r + '"><td>' + esc(c[1]) + '</td><td>' + rot + '</td></tr>';
  }).join('');
  var ordemSev = { bloqueante: 0, grave: 1, aviso: 2, info: 3 };
  var itens = A.itens.slice().sort(function (a, b) { return ordemSev[a.sev] - ordemSev[b.sev]; }).map(function (i) {
    return '<tr class="s-' + i.sev + '"><td><b>' + i.sev.toUpperCase() + '</b></td><td>' + esc(i.cat) + '</td><td>' + esc(i.msg) + (i.sug ? '<br><small>➜ ' + esc(i.sug) + '</small>' : '') + '</td><td>' + esc(i.onde) + '</td><td>' + esc(i.norma) + '</td></tr>';
  }).join('');
  var corr = Object.keys(A.correcoes).map(function (k) { return '<tr><td>' + esc(k) + '</td><td style="text-align:right">' + A.correcoes[k] + '</td></tr>'; }).join('');
  var rev = (revisao || []).filter(function (r) { return !r.erro; }).map(function (r) { return '<tr><td>' + esc(r.secao) + '</td><td>' + esc(r.tipo) + '</td><td>' + esc(r.trecho) + '</td><td><b>' + esc(r.correcao) + '</b></td><td>' + esc(r.explicacao) + '</td></tr>'; }).join('');
  var errosRev = (revisao || []).filter(function (r) { return r.erro; });
  return '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Auditoria editorial — ' + esc(o.titulo) + '</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>' +
    'body{font-family:Georgia,serif;color:#1c140c;max-width:1100px;margin:0 auto;padding:24px 16px;background:#fbf8f2}h1{font-size:1.5rem;margin:0 0 .3rem}h2{font-size:1.1rem;margin:2rem 0 .6rem;border-bottom:2px solid #8B3A0F;padding-bottom:.3rem}' +
    'table{border-collapse:collapse;width:100%;font-size:.86rem;background:#fff}td,th{border:1px solid #e3d9c6;padding:.4rem .5rem;vertical-align:top;text-align:left}th{background:#f1e8d6}' +
    '.selo{display:inline-block;padding:.5rem 1rem;border-radius:6px;font-weight:bold;color:#fff;margin:.6rem 0}.apr{background:#2D6A4F}.ress{background:#b7791f}.rep{background:#9b1c1c}' +
    '.s-bloqueante td:first-child{color:#9b1c1c}.s-grave td:first-child{color:#c2410c}.s-aviso td:first-child{color:#a16207}.s-info td:first-child{color:#475569}' +
    '.r3 td:last-child,.r2 td:last-child{color:#9b1c1c;font-weight:bold}.r1 td:last-child{color:#a16207}.r0 td:last-child{color:#2D6A4F;font-weight:bold}small{color:#555}' +
    '.meta{font-size:.9rem;color:#444}.num{font-size:2rem;font-weight:bold}</style></head><body>' +
    '<p class="meta">' + esc(cfg.editora.nome) + ' · Motor editorial v' + VERSAO + ' · ' + d.toLocaleString('pt-BR') + '</p>' +
    '<h1>Relatório de auditoria editorial</h1><p><b>' + esc(o.titulo) + '</b>' + (o.subtitulo ? ': ' + esc(o.subtitulo) : '') + '<br>' + esc(frase(pessoas(o.autores).concat(pessoas(o.organizadores)).map(function (p) { return p.nome; }))) + '</p>' +
    '<div class="selo ' + res.classe + '">' + res.status + '</div> <span class="num">' + res.pontos + '</span>/100' +
    '<p class="meta">' + res.b + ' bloqueante(s) · ' + res.g + ' grave(s) · ' + res.a + ' aviso(s) · ' + res.i + ' informação(ões) · ' + livro.ordem.length + ' arquivos de conteúdo · ' + livro.imagens.length + ' imagem(ns) · ' + livro.tabelas.length + ' tabela(s)</p>' +
    '<h2>Verificação por requisito</h2><table><tr><th>Requisito</th><th>Resultado</th></tr>' + linhasCheck + '</table>' +
    '<h2>Ocorrências</h2>' + (itens ? '<table><tr><th>Nível</th><th>Área</th><th>Ocorrência e providência</th><th>Local</th><th>Base normativa</th></tr>' + itens + '</table>' : '<p>Nenhuma ocorrência.</p>') +
    '<h2>Correções automáticas aplicadas</h2>' + (corr ? '<table><tr><th>Correção</th><th>Qtd.</th></tr>' + corr + '</table>' : '<p>Nenhuma.</p>') +
    (revisao ? '<h2>Revisão linguística assistida por IA (sugestões — não aplicadas)</h2>' + (rev ? '<table><tr><th>Seção</th><th>Tipo</th><th>Trecho</th><th>Sugestão</th><th>Motivo</th></tr>' + rev + '</table>' : '<p>Nenhum problema objetivo apontado.</p>') + (errosRev.length ? '<p><small>' + errosRev.length + ' trecho(s) não puderam ser revisados: ' + esc(errosRev[0].erro) + '</small></p>' : '') : '') +
    '<h2>Observações do auditor</h2><p class="meta">Este relatório verifica a conformidade formal do livro digital com as normas da ABNT aplicáveis a livros (NBR 6029, 6027, 6024, 6023, 10520 e 6034), com a legislação do livro (Lei 10.753/2003), com a política do selo e com as diretrizes de acessibilidade EPUB. ' +
    'A ficha catalográfica é gerada em formato de rascunho a partir dos dados informados e deve ser conferida e assinada por bibliotecário(a) com registro no CRB. A revisão de conteúdo, a revisão técnica especializada e a aprovação do conselho editorial continuam sendo atos humanos indispensáveis.</p>' +
    '</body></html>';
}

/* ───────────────────────── 12. PRÉVIA E PDF ───────────────────────── */
function cssParaNavegador(css) {
  return css.replace(/url\("\.\.\/fontes\//g, 'url("' + BASE + 'fontes/').replace(/url\("\.\.\/img\/vinheta\.svg"\)/g, 'url("' + BASE + 'vinheta.svg")');
}
function trocarImagens(html, livro, logos) {
  var mapa = { 'img/vinheta.svg': BASE + 'vinheta.svg' };
  if (livro.capaBytes) mapa['img/capa.jpg'] = livro._capaUrl || (livro._capaUrl = URL.createObjectURL(new Blob([livro.capaBytes], { type: 'image/jpeg' })));
  livro.imagens.forEach(function (im) { mapa[im.arquivo] = im._url || (im._url = URL.createObjectURL(new Blob([im.bytes], { type: im.mime }))); });
  logos.forEach(function (l) { if (l.arquivoEpub && l.dados) mapa[l.arquivoEpub] = l.dados.url; });
  return html.replace(/src="\.\.\/(img\/[^"]+)"/g, function (m, p) { return 'src="' + (mapa[p] || p) + '"'; });
}
function corpoDe(arq) { var m = /<body[^>]*>([\s\S]*)<\/body>/.exec(arq); return m ? m[1] : ''; }
function htmlPrevia(livro, k, logos) {
  var p = livro.paginas[k];
  return '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><style>' + cssParaNavegador(livro.css) + 'body{margin:1.6em 8%;font-size:17px;background:#fffdf8}</style></head><body>' + trocarImagens(corpoDe(p.arq), livro, logos).replace(/href="([^"#:]*\.xhtml)(#[^"]*)?"/g, 'href="#" data-arq="$1"') + '</body></html>';
}
function htmlImpressao(livro, logos, o) {
  var css = cssParaNavegador(livro.css) + '@page{size:148mm 210mm;margin:18mm 15mm 20mm 17mm}body{margin:0;font-size:10.5pt}.pg{break-before:page;page-break-before:always}.pg:first-child{break-before:auto}.capa img{width:100%;height:auto}aside.nota{display:block}a{color:inherit}';
  var corpo = livro.paginas.filter(function (p) { return !p.s.naoLinear; }).map(function (p) { return '<div class="pg">' + trocarImagens(corpoDe(p.arq), livro, logos) + '</div>'; }).join('\n');
  return '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>' + esc(o.titulo) + '</title><style>' + css + '</style></head><body>' + corpo + '<script>document.fonts.ready.then(function(){setTimeout(function(){window.print();},400);});<\/script></body></html>';
}

/* ───────────────────────── 13. ORQUESTRAÇÃO ───────────────────────── */
var estado = { arquivo: null, entrada: null, livro: null, epub: null, relatorio: null, revisao: null, logos: [], rodando: false };

async function logosDaObra() {
  var lista = [];
  for (var l of cfg.logos) {
    var d = await logoDados(l), x = Object.assign({}, l, { dados: d });
    if (d) x.arquivoEpub = 'img/logo-' + l.id + '.' + (d.mime === 'image/png' ? 'png' : d.mime === 'image/svg+xml' ? 'svg' : 'jpg');
    lista.push(x);
  }
  return lista;
}
async function produzir(opcoesExtras) {
  if (estado.rodando) return;
  if (!estado.entrada) { ui.msg('Envie um manuscrito primeiro.', 'err'); return; }
  estado.rodando = true; ui.travar(true);
  var etapa = ui.etapa;
  try {
    ui.limparEtapas();
    etapa('ingestao', 'ok', estado.arquivo ? estado.arquivo.name : '');
    // metadados por IA (preenche apenas o que estiver vazio)
    var precisaMeta = !obra.titulo || !obra.autores && !obra.organizadores || !obra.sinopse || !obra.palavrasChave || !obra.termosIndice;
    if (estado.entrada.meta) {
      if (!obra.titulo && estado.entrada.meta.titulo) obra.titulo = estado.entrada.meta.titulo;
      if (!obra.subtitulo && estado.entrada.meta.subtitulo) obra.subtitulo = estado.entrada.meta.subtitulo;
    }
    if (chaveClaude() && precisaMeta && !estado.metaIAFeita) {
      etapa('ia-meta', 'rodando');
      try {
        var dtmp = new DOMParser().parseFromString('<body>' + estado.entrada.html + '</body>', 'text/html');
        var r = await iaMetadados(estado.entrada, txt(dtmp.body));
        _origemIA = {};
        function pre(c, v) { if (!obra[c] && v) { obra[c] = v; _origemIA[c] = 1; } }
        pre('titulo', r.titulo); pre('subtitulo', r.subtitulo);
        pre('autores', (r.autores || []).map(function (a) { return a.nome + (a.povo ? '; ' + a.povo : ''); }).join('\n'));
        pre('sinopse', r.sinopse); pre('palavrasChave', (r.palavrasChave || []).join('; '));
        pre('termosIndice', (r.termosIndice || []).join('\n'));
        if (r.cddSugerida) estado.cddSugerida = r.cddSugerida;
        estado.metaIAFeita = true;
        etapa('ia-meta', 'ok', Object.keys(_origemIA).length + ' campo(s) sugeridos');
      } catch (e) { etapa('ia-meta', 'aviso', 'IA indisponível: ' + e.message); }
      ui.preencherForm();
    } else etapa('ia-meta', chaveClaude() ? 'pulado' : 'pulado', chaveClaude() ? 'dados já preenchidos' : 'sem chave do Claude configurada');
    if (!obra.titulo && estado.entrada.meta && estado.entrada.meta.titulo) obra.titulo = estado.entrada.meta.titulo;
    if (!obra.autores && !obra.organizadores && estado.entrada.meta && estado.entrada.meta.autor) obra.autores = estado.entrada.meta.autor;
    obraGuardar();

    var opcoes = { numeracao: obra.numeracao, indice: obra.indice, dedicatoria: obra.dedicatoria, epigrafe: obra.epigrafe };
    var livro = await processar(estado.entrada, opcoes, etapa);
    if (!obra.titulo && livro.meta.titulo) obra.titulo = livro.meta.titulo;
    if (!obra.subtitulo && livro.meta.subtitulo) obra.subtitulo = livro.meta.subtitulo;
    aplicarMetaManuscrito(livro);
    obraGuardar(); ui.preencherForm();
    estado.livro = livro;
    etapa('ilustracoes', 'rodando');
    await processarIlustracoes(livro);
    etapa('ilustracoes', 'ok', livro.imagens.length + ' imagem(ns), ' + livro.tabelas.length + ' tabela(s)');

    var revisao = null;
    if (obra.revisaoIA && chaveClaude()) {
      etapa('ia-revisao', 'rodando', 'iniciando…');
      revisao = await iaRevisao(livro.secoes, function (f, t) { etapa('ia-revisao', 'rodando', f + '/' + t + ' trechos'); });
      var ok = revisao.filter(function (r) { return !r.erro; });
      ok.forEach(function (r) { livro.A.add('aviso', 'Revisão', '“' + r.trecho + '” → “' + r.correcao + '” (' + r.tipo + ')', { onde: r.secao, sug: r.explicacao }); });
      etapa('ia-revisao', revisao.some(function (r) { return r.erro; }) ? 'aviso' : 'ok', ok.length + ' sugestão(ões)');
    } else etapa('ia-revisao', 'pulado', obra.revisaoIA ? 'sem chave do Claude configurada' : 'desligada');
    estado.revisao = revisao;

    etapa('editoriais', 'rodando');
    var logos = await logosDaObra();
    estado.logos = logos;
    auditarObra(obra, livro.A, logos);
    if (estado.cddSugerida && !obra.cdd) livro.A.add('info', 'Ficha', 'Sugestão de classificação (IA) para o bibliotecário: ' + estado.cddSugerida, {});
    var ed = await montarEditoriais(livro, obra, logos);
    etapa('editoriais', 'ok', 'capa, folha de rosto, créditos, ficha, sumário' + (livro.listasGeradas.length ? ', ' + livro.listasGeradas.length + ' lista(s)' : ''));

    etapa('epub', 'rodando');
    var blob = await empacotar(livro, obra, logos, ed, opcoes);
    estado.epub = blob;
    etapa('epub', 'ok', (blob.size / 1024 / 1024).toFixed(2) + ' MB · ' + livro.ordem.length + ' arquivos');

    var res = resumoAuditoria(livro.A);
    estado.res = res;
    estado.relatorio = relatorioHtml(livro, obra, res, revisao);
    etapa('auditoria', res.b ? 'erro' : res.g ? 'aviso' : 'ok', res.status + ' · ' + res.pontos + '/100');
    ui.resultado(livro, res);
    ui.msg('E-book gerado. ' + res.status + '.', res.b ? 'err' : 'ok');
  } catch (e) {
    console.error(e);
    ui.msg('Erro na produção: ' + e.message, 'err');
    ui.etapaErro(e.message);
  } finally { estado.rodando = false; ui.travar(false); }
}
function povosDaSecaoSobre(livro) {
  var mapa = {};
  livro.secoes.filter(function (s) { return s.tipo === 'sobre'; }).forEach(function (s) {
    s.cont.querySelectorAll('h2,h3,h4,h5,p').forEach(function (h) {
      var m = /^(.{5,90}?)\s*\(([^)]{3,40})\)\s*$/.exec(txt(h));
      if (m && !/\d/.test(m[2])) mapa[N(m[1].replace(/[‑–]/g, '-'))] = tituloCaso(m[2]);
    });
  });
  return mapa;
}
function aplicarMetaManuscrito(livro) {
  var m = livro.meta, f = m.ficha || {}, usados = [];
  function pre(c, v) { if (v && !String(obra[c] || '').trim()) { obra[c] = v; usados.push(c); } }
  pre('titulo', m.titulo); pre('subtitulo', m.subtitulo);
  if (m.autores && m.autores.length) pre('autores', m.autores.join('\n'));
  pre('isbn', f.isbn); pre('cdd', f.cdd); pre('cdu', f.cdu); pre('cutter', f.cutter);
  if (f.assuntos) pre('assuntos', f.assuntos.join('\n'));
  pre('direitosTexto', m.direitos);
  if (m.local && !obra.local) { obra.local = m.local; usados.push('local'); }
  var povos = povosDaSecaoSobre(livro), np = 0;
  ['autores', 'organizadores'].forEach(function (c) {
    obra[c] = String(obra[c] || '').split('\n').map(function (l) {
      var pp = l.split(/\s*;\s*/); if (!pp[0].trim() || (pp[1] || '').trim()) return l;
      var povo = povos[N(pp[0].replace(/[‑–]/g, '-'))]; if (povo) { np++; return pp[0].trim() + '; ' + povo; } return l;
    }).join('\n');
  });
  if (np) usados.push('povo de ' + np + ' autor(es), pela seção sobre a autoria');
  if (usados.length) livro.A.add('info', 'Metadados', 'Dados lidos do próprio manuscrito: ' + usados.join(', ') + '. Confira na aba “Dados da obra”.', {});
  obraGuardar(); if (ui.preencherForm) ui.preencherForm();
}
async function receberArquivo(file) {
  if (!file) return;
  if (file.size > 60 * 1024 * 1024) { ui.msg('Arquivo muito grande (máx. 60 MB).', 'err'); return; }
  ui.msg('Lendo ' + file.name + '…');
  try {
    await libs();
    estado.arquivo = file; estado.metaIAFeita = false; estado.cddSugerida = '';
    estado.entrada = await lerArquivo(file);
    var novo = !!obra._arquivo && obra._arquivo !== file.name;
    if (novo) { var manter = { numeracao: obra.numeracao, revisaoIA: obra.revisaoIA, indice: obra.indice, listas: obra.listas, licenca: obra.licenca }; obra = mesclar(clone(OBRA_PADRAO), manter); ui.preencherForm(); }
    obra._arquivo = file.name;
    await produzir();
  } catch (e) { console.error(e); ui.msg(e.message, 'err'); }
}
function baixar(blob, nome) { var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nome; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 2000); }

/* ───────────────────────── 14. INTERFACE (painel ADM) ───────────────────────── */
var ETAPAS = [
  ['ingestao', 'Ingestão do manuscrito'], ['ia-meta', 'Metadados assistidos por IA'], ['estrutura', 'Estrutura e hierarquia de títulos'],
  ['tipografia', 'Normalização tipográfica'], ['abnt', 'Normas ABNT (6029, 6024, 10520, 6023)'], ['ilustracoes', 'Ilustrações e tabelas'],
  ['ia-revisao', 'Revisão linguística por IA'], ['editoriais', 'Elementos editoriais e ficha catalográfica'], ['epub', 'Empacotamento EPUB 3'], ['auditoria', 'Auditoria final']
];
var CSS_PAINEL = '\
.ebm{font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#EDE5CF;background:rgba(10,6,3,.55);border:1px solid rgba(242,196,90,.28);border-radius:12px;padding:1.2rem;margin-top:1rem}\
.ebm *{box-sizing:border-box}.ebm h3{font-family:Cinzel,Georgia,serif;color:#F2C45A;margin:0 0 .25rem;font-size:1.15rem}\
.ebm .sub{font-size:.8rem;color:rgba(247,242,232,.72);margin:0 0 1rem;line-height:1.5}\
.ebm .tabs{display:flex;gap:.3rem;flex-wrap:wrap;margin-bottom:1rem;border-bottom:1px solid rgba(242,196,90,.2)}\
.ebm .tab{background:none;border:0;border-bottom:2px solid transparent;color:rgba(247,242,232,.75);padding:.5rem .8rem;cursor:pointer;font-size:.82rem}\
.ebm .tab.on{color:#F2C45A;border-color:#F2C45A}.ebm .pane{display:none}.ebm .pane.on{display:block}\
.ebm .drop{border:2px dashed rgba(242,196,90,.45);border-radius:10px;padding:1.6rem 1rem;text-align:center;cursor:pointer;background:rgba(242,196,90,.04);transition:.2s}\
.ebm .drop.sobre{background:rgba(242,196,90,.14)}.ebm .drop b{color:#F2C45A}.ebm .drop small{display:block;color:rgba(247,242,232,.6);margin-top:.4rem}\
.ebm .opc{display:flex;gap:1rem;flex-wrap:wrap;margin:1rem 0;font-size:.8rem;align-items:center}.ebm .opc label{display:flex;gap:.35rem;align-items:center}\
.ebm select,.ebm input[type=text],.ebm input[type=url],.ebm input[type=email],.ebm textarea{background:rgba(255,255,255,.06);border:1px solid rgba(242,196,90,.25);color:#F7F2E8;border-radius:6px;padding:.45rem .55rem;font-size:.82rem;width:100%;font-family:inherit}\
.ebm select{width:auto}.ebm select option{background:#1e1208}.ebm textarea{min-height:4.2rem;resize:vertical}\
.ebm .grade{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:.8rem}.ebm .campo label{display:block;font-size:.72rem;color:#E8A853;margin-bottom:.25rem;letter-spacing:.02em}\
.ebm .campo .ia{color:#52B788;font-size:.68rem;margin-left:.3rem}.ebm .campo .dica{font-size:.68rem;color:rgba(247,242,232,.55);margin-top:.2rem}\
.ebm .etapas{list-style:none;margin:1rem 0;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:.3rem}\
.ebm .etapas li{display:flex;gap:.6rem;align-items:baseline;font-size:.8rem;padding:.35rem .55rem;border-radius:6px;background:rgba(255,255,255,.03)}\
.ebm .etapas .ic{width:1.1rem;text-align:center}.ebm .etapas .det{color:rgba(247,242,232,.6);font-size:.72rem;margin-left:auto;text-align:right}\
.ebm .etapas li.ok .ic{color:#52B788}.ebm .etapas li.aviso .ic{color:#E8A853}.ebm .etapas li.erro .ic{color:#f87171}.ebm .etapas li.rodando .ic{color:#F2C45A}\
.ebm .acoes{display:flex;gap:.5rem;flex-wrap:wrap;margin:.8rem 0}\
.ebm .bt{background:rgba(242,196,90,.12);border:1px solid rgba(242,196,90,.4);color:#F2C45A;border-radius:6px;padding:.5rem .85rem;font-size:.8rem;cursor:pointer}\
.ebm .bt.pri{background:#C4621A;border-color:#E8722A;color:#fff}.ebm .bt:disabled{opacity:.45;cursor:not-allowed}\
.ebm .msg{font-size:.8rem;margin:.5rem 0;min-height:1.1rem}.ebm .msg.err{color:#fca5a5}.ebm .msg.ok{color:#86efac}\
.ebm .placar{display:flex;gap:1rem;align-items:center;flex-wrap:wrap;margin:.6rem 0;padding:.8rem;border-radius:8px;background:rgba(255,255,255,.04)}\
.ebm .placar .st{font-weight:700;padding:.35rem .7rem;border-radius:5px;font-size:.78rem}.ebm .st.apr{background:#2D6A4F}.ebm .st.ress{background:#b7791f}.ebm .st.rep{background:#9b1c1c}\
.ebm .placar .pt{font-size:1.7rem;font-weight:700;color:#F2C45A}.ebm .placar .ct{font-size:.75rem;color:rgba(247,242,232,.75)}\
.ebm .filtros{display:flex;gap:.3rem;flex-wrap:wrap;margin:.5rem 0}.ebm .filtros button{font-size:.7rem;padding:.25rem .55rem}\
.ebm .ocorr{max-height:360px;overflow:auto;border:1px solid rgba(242,196,90,.15);border-radius:8px}\
.ebm .ocorr div{padding:.45rem .6rem;border-bottom:1px solid rgba(255,255,255,.05);font-size:.76rem;line-height:1.45}\
.ebm .ocorr .sv{font-weight:700;font-size:.66rem;text-transform:uppercase;margin-right:.4rem}.ebm .sv.bloqueante{color:#f87171}.ebm .sv.grave{color:#fb923c}.ebm .sv.aviso{color:#facc15}.ebm .sv.info{color:#94a3b8}\
.ebm .ocorr small{display:block;color:rgba(247,242,232,.6)}\
.ebm .previa{display:grid;grid-template-columns:1fr;gap:.5rem;margin-top:1rem}.ebm .previa iframe{width:100%;height:560px;border:1px solid rgba(242,196,90,.25);border-radius:8px;background:#fff}\
.ebm .capa-mini{max-width:150px;border-radius:6px;box-shadow:0 4px 18px rgba(0,0,0,.5)}\
.ebm .logos-ed{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:.8rem}\
.ebm .lg{border:1px solid rgba(242,196,90,.2);border-radius:8px;padding:.7rem;display:grid;gap:.45rem}\
.ebm .lg .vis{height:110px;border-radius:6px;display:flex;align-items:center;justify-content:center;overflow:hidden}.ebm .lg .vis img{max-height:96px;max-width:90%}\
.ebm .lg .falta{color:#fca5a5;font-size:.75rem;font-weight:700}.ebm .linha{display:flex;gap:.5rem;align-items:center;flex-wrap:wrap}\
.ebm .aviso-box{border-left:3px solid #E8A853;background:rgba(232,168,83,.08);padding:.6rem .8rem;font-size:.76rem;border-radius:4px;margin:.6rem 0;line-height:1.5}';

var ui = {};
function montarUI(alvo) {
  if (!document.getElementById('ebm-css')) { var st = document.createElement('style'); st.id = 'ebm-css'; st.textContent = CSS_PAINEL; document.head.appendChild(st); }
  var raiz = document.createElement('div');
  raiz.className = 'ebm notranslate'; raiz.setAttribute('translate', 'no'); raiz.setAttribute('data-i18n-ignorar', '');
  raiz.innerHTML =
    '<h3>📚 ' + esc(cfg.editora.nome) + ' — Motor de e-book</h3>' +
    '<p class="sub">Envie o manuscrito e o motor produz o livro digital completo, em EPUB 3, no padrão da Editora: capa, folha de rosto, créditos, conselho editorial, ficha catalográfica, sumário, normas da ABNT, notas, referências, índice e logomarcas. Ao final, faz uma auditoria rigorosa e entrega o relatório.</p>' +
    '<div class="tabs"><button class="tab on" data-p="prod">Produção</button><button class="tab" data-p="obra">Dados da obra</button><button class="tab" data-p="ed">Editora e conselho</button><button class="tab" data-p="lg">Logomarcas</button></div>' +
    '<div class="pane on" data-p="prod">' +
      '<div class="drop" tabindex="0" role="button" aria-label="Enviar manuscrito"><b>Arraste o manuscrito aqui</b> ou clique para escolher<small>Word (.docx), LibreOffice (.odt), Markdown (.md), texto (.txt) ou HTML. Use os estilos de título do editor de texto para um resultado exato.</small><input type="file" accept=".docx,.odt,.md,.markdown,.txt,.html,.htm" hidden></div>' +
      '<div class="opc">' +
        '<label>Numeração <select data-o="numeracao"><option value="auto">Automática</option><option value="abnt">Progressiva ABNT (1, 1.1, 1.1.1)</option><option value="capitulo">Capítulo 1, 2, 3</option><option value="nenhuma">Sem numeração</option></select></label>' +
        '<label>Listas <select data-o="listas"><option value="auto">Automáticas (3+ itens)</option><option value="sempre">Sempre</option><option value="nunca">Nunca</option></select></label>' +
        '<label><input type="checkbox" data-o="indice"> Índice remissivo</label>' +
        '<label><input type="checkbox" data-o="revisaoIA"> Revisão linguística por IA</label>' +
      '</div>' +
      '<div class="acoes"><button class="bt pri" data-a="regerar" disabled>⟳ Regerar com os dados atuais</button><button class="bt" data-a="epub" disabled>⬇ Baixar EPUB</button><button class="bt" data-a="rel" disabled>📋 Relatório de auditoria</button><button class="bt" data-a="pdf" disabled>🖨 PDF para impressão</button></div>' +
      '<div class="msg" role="status" aria-live="polite"></div>' +
      '<ol class="etapas"></ol>' +
      '<div class="res" hidden><div class="placar"></div><div class="filtros"></div><div class="ocorr"></div>' +
      '<div class="previa"><div class="linha"><label style="font-size:.75rem">Prévia: <select data-a="pg"></select></label></div><iframe title="Prévia do livro" sandbox="allow-same-origin"></iframe></div></div>' +
    '</div>' +
    '<div class="pane" data-p="obra"><div class="grade">' +
      campo('titulo', 'Título', 'text') + campo('subtitulo', 'Subtítulo', 'text') +
      campo('autores', 'Autores (um por linha: Nome; Povo, se indígena)', 'area', 'Ex.: Maria da Silva Terena; Terena') +
      campo('organizadores', 'Organizadores (um por linha: Nome; Povo)', 'area') +
      campo('edicao', 'Edição (número)', 'text') + campo('ano', 'Ano de publicação', 'text') +
      campo('local', 'Local de publicação', 'text', 'Padrão: ' + cfg.editora.cidade + ', ' + cfg.editora.uf) +
      campo('isbn', 'ISBN do e-book', 'text', 'Obrigatório (Lei 10.753/2003). Diferente do impresso.') + campo('isbnImpresso', 'ISBN do impresso (se houver)', 'text') +
      campo('serie', 'Série / coleção', 'text') +
      campo('cdd', 'CDD', 'text') + campo('cdu', 'CDU', 'text') + campo('cutter', 'Notação de autor (Cutter)', 'text') +
      campo('assuntos', 'Assuntos da ficha (um por linha)', 'area', 'Definidos pelo(a) bibliotecário(a).') +
      campo('palavrasChave', 'Palavras-chave (separadas por ;)', 'area') +
      campo('sinopse', 'Sinopse (quarta capa e lojas)', 'area') +
      campo('termosIndice', 'Termos do índice remissivo (um por linha)', 'area') +
      campo('dedicatoria', 'Dedicatória (se não estiver no manuscrito)', 'area') +
      campo('epigrafe', 'Epígrafe (se não estiver no manuscrito)', 'area', 'Última linha iniciada por — vira a autoria.') +
      campo('direitosTexto', 'Texto de direitos autorais (se preenchido, substitui a licença)', 'area') +
      '<div class="campo"><label>Licença</label><select data-f="licenca"><option value="todos">Todos os direitos reservados</option><option value="cc-by">CC BY 4.0</option><option value="cc-by-sa">CC BY-SA 4.0</option><option value="cc-by-nc">CC BY-NC 4.0</option><option value="cc-by-nc-sa">CC BY-NC-SA 4.0</option><option value="cc-by-nc-nd">CC BY-NC-ND 4.0</option></select></div>' +
      '<div class="campo"><label><input type="checkbox" data-f="ctDeclaracao"> Incluir declaração sobre conhecimentos tradicionais</label><textarea data-f="ctTexto"></textarea></div>' +
      '<div class="campo"><label>Capa própria (opcional, JPG/PNG 1600×2560)</label><input type="file" accept="image/*" data-capa><div class="linha" style="margin-top:.4rem"><img class="capa-mini" alt="Capa atual" hidden><button class="bt" data-a="sem-capa" type="button">Usar capa gerada</button></div></div>' +
    '</div><div class="acoes"><button class="bt pri" data-a="regerar2">⟳ Aplicar e regerar o e-book</button></div></div>' +
    '<div class="pane" data-p="ed">' +
      '<div class="grade">' + cfgCampo('editora.nome', 'Nome da editora') + cfgCampo('editora.mantenedora', 'Mantenedora') + cfgCampo('editora.cidade', 'Cidade') + cfgCampo('editora.uf', 'UF') + cfgCampo('editora.endereco', 'Endereço') + cfgCampo('editora.email', 'E-mail') + cfgCampo('editora.site', 'Site') +
      cfgCampo('equipe.editor', 'Edição (editor/a responsável)') + cfgCampo('equipe.revisao', 'Revisão') + cfgCampo('equipe.projetoGrafico', 'Projeto gráfico') + cfgCampo('equipe.capa', 'Capa') + cfgCampo('equipe.diagramacao', 'Diagramação digital') +
      cfgCampo('equipe.bibliotecario', 'Bibliotecário(a) da ficha') + cfgCampo('equipe.crb', 'Registro CRB (ex.: CRB-1/1234)') + '</div>' +
      '<div class="campo" style="margin-top:.8rem"><label>Conselho editorial (um membro por linha: Nome — titulação e vínculo)</label><textarea data-conselho style="min-height:8rem"></textarea></div>' +
      '<div class="campo"><label>Política do selo</label><textarea data-c="editora.politica"></textarea></div>' +
      '<label style="font-size:.78rem;display:flex;gap:.4rem;margin:.6rem 0"><input type="checkbox" data-c="regras.exigeAutorIndigena"> Exigir ao menos um autor indígena (regra do selo)</label>' +
      '<div class="acoes"><button class="bt pri" data-a="salvar-cfg">💾 Salvar na nuvem (todos os ADM)</button></div>' +
    '</div>' +
    '<div class="pane" data-p="lg"><div class="aviso-box">Use somente os arquivos oficiais das marcas, obtidos nos manuais de identidade visual de cada instituição, e registre a autorização de uso. O auditor bloqueia a publicação enquanto faltar uma logomarca e aponta como grave a marca sem autorização registrada.</div><div class="logos-ed"></div>' +
      '<div class="acoes"><button class="bt pri" data-a="salvar-lg">💾 Salvar logomarcas na nuvem</button></div></div>';
  alvo.appendChild(raiz);
  var Q = function (s) { return raiz.querySelector(s); }, QA = function (s) { return raiz.querySelectorAll(s); };

  function campo(id, rot, tipo, dica) {
    return '<div class="campo"><label>' + esc(rot) + '<span class="ia" data-ia="' + id + '" hidden>✦ sugerido por IA</span></label>' + (tipo === 'area' ? '<textarea data-f="' + id + '"></textarea>' : '<input type="text" data-f="' + id + '">') + (dica ? '<div class="dica">' + esc(dica) + '</div>' : '') + '</div>';
  }
  function cfgCampo(caminho, rot) { return '<div class="campo"><label>' + esc(rot) + '</label><input type="text" data-c="' + caminho + '"></div>'; }
  function getC(c) { return c.split('.').reduce(function (o, k) { return o && o[k]; }, cfg); }
  function setC(c, v) { var p = c.split('.'), o = cfg; for (var i = 0; i < p.length - 1; i++) o = o[p[i]]; o[p[p.length - 1]] = v; }

  // abas
  QA('.tab').forEach(function (b) { b.addEventListener('click', function () { QA('.tab').forEach(function (x) { x.classList.toggle('on', x === b); }); QA('.pane').forEach(function (p) { p.classList.toggle('on', p.getAttribute('data-p') === b.getAttribute('data-p')); }); }); });

  // envio do manuscrito
  var drop = Q('.drop'), inp = drop.querySelector('input');
  drop.addEventListener('click', function () { inp.click(); });
  drop.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inp.click(); } });
  inp.addEventListener('change', function () { if (inp.files[0]) receberArquivo(inp.files[0]); inp.value = ''; });
  ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('sobre'); }); });
  ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('sobre'); }); });
  drop.addEventListener('drop', function (e) { var f = e.dataTransfer && e.dataTransfer.files[0]; if (f) receberArquivo(f); });

  // opções e formulário da obra
  QA('[data-o]').forEach(function (x) { x.addEventListener('change', function () { obra[x.getAttribute('data-o')] = x.type === 'checkbox' ? x.checked : x.value; obraGuardar(); }); });
  QA('[data-f]').forEach(function (x) { x.addEventListener('input', function () { var k = x.getAttribute('data-f'); obra[k] = x.type === 'checkbox' ? x.checked : x.value; delete _origemIA[k]; var m = raiz.querySelector('[data-ia="' + k + '"]'); if (m) m.hidden = true; obraGuardar(); }); x.addEventListener('change', function () { x.dispatchEvent(new Event('input')); }); });
  Q('[data-capa]').addEventListener('change', function (e) { var f = e.target.files[0]; if (!f) return; var r = new FileReader(); r.onload = function () { obra.capaPropria = r.result; obra.capaGerada = false; obraGuardar(); ui.preencherForm(); }; r.readAsDataURL(f); });
  Q('[data-a="sem-capa"]').addEventListener('click', function () { obra.capaPropria = ''; obra.capaGerada = true; obraGuardar(); ui.preencherForm(); ui.msg('A capa gerada no padrão da Editora será usada. Clique em “Aplicar e regerar”.', 'ok'); });

  // configuração
  QA('[data-c]').forEach(function (x) { x.addEventListener('input', function () { setC(x.getAttribute('data-c'), x.type === 'checkbox' ? x.checked : x.value); cfgGuardarLocal(); }); x.addEventListener('change', function () { x.dispatchEvent(new Event('input')); }); });
  Q('[data-conselho]').addEventListener('input', function (e) { cfg.conselho = e.target.value.split(/\n+/).map(function (l) { l = l.trim(); if (!l) return null; var p = l.split(/\s+[—–-]\s+/); return { nome: p[0].trim(), vinculo: p.slice(1).join(' — ').trim() }; }).filter(Boolean); cfgGuardarLocal(); });
  function salvarNuvem(btn) { btn.disabled = true; cfgSalvarNuvem().then(function () { ui.msg('Configuração salva na nuvem.', 'ok'); if (window.notif) window.notif('💾 Editora: configuração salva', 'ok'); }, function (e) { ui.msg('Salvo neste navegador. Nuvem: ' + e.message, 'err'); }).then(function () { btn.disabled = false; }); }
  Q('[data-a="salvar-cfg"]').addEventListener('click', function (e) { salvarNuvem(e.target); });
  Q('[data-a="salvar-lg"]').addEventListener('click', function (e) { salvarNuvem(e.target); });

  // ações
  Q('[data-a="regerar"]').addEventListener('click', function () { produzir(); });
  Q('[data-a="regerar2"]').addEventListener('click', function () { if (!estado.entrada) { ui.msg('Envie o manuscrito na aba Produção.', 'err'); return; } QA('.tab')[0].click(); produzir(); });
  Q('[data-a="epub"]').addEventListener('click', function () { if (estado.epub) baixar(estado.epub, slug(obra.titulo) + '.epub'); });
  Q('[data-a="rel"]').addEventListener('click', function () { if (estado.relatorio) baixar(new Blob([estado.relatorio], { type: 'text/html' }), 'auditoria-' + slug(obra.titulo) + '.html'); });
  Q('[data-a="pdf"]').addEventListener('click', function () {
    if (!estado.livro) return;
    var w = window.open('', '_blank');
    if (!w) { ui.msg('Permita janelas pop-up para gerar o PDF.', 'err'); return; }
    w.document.open(); w.document.write(htmlImpressao(estado.livro, estado.logos, obra)); w.document.close();
  });
  var selPg = Q('[data-a="pg"]'), ifr = Q('iframe');
  function mostrarPg(k) {
    ifr.srcdoc = htmlPrevia(estado.livro, k, estado.logos);
    ifr.onload = function () { try { ifr.contentDocument.querySelectorAll('a[data-arq]').forEach(function (a) { a.addEventListener('click', function (e) { e.preventDefault(); var i = estado.livro.paginas.findIndex(function (p) { return p.s.arquivo === a.getAttribute('data-arq'); }); if (i >= 0) { selPg.value = i; mostrarPg(i); } }); }); } catch (e) {} };
  }
  selPg.addEventListener('change', function () { mostrarPg(+selPg.value); });

  ui.msg = function (m, t) { var e = Q('.msg'); e.textContent = m; e.className = 'msg' + (t ? ' ' + t : ''); };
  ui.travar = function (s) { QA('.acoes .bt').forEach(function (b) { if (/regerar/.test(b.getAttribute('data-a'))) b.disabled = s || !estado.entrada; else if (/^(epub|rel|pdf)$/.test(b.getAttribute('data-a'))) b.disabled = s || !estado.epub; }); drop.style.pointerEvents = s ? 'none' : ''; drop.style.opacity = s ? .6 : 1; };
  ui.limparEtapas = function () { Q('.etapas').innerHTML = ETAPAS.map(function (e) { return '<li data-e="' + e[0] + '"><span class="ic">○</span><span>' + esc(e[1]) + '</span><span class="det"></span></li>'; }).join(''); Q('.res').hidden = true; estado.epub = null; };
  ui.etapa = function (id, st, det) {
    var li = raiz.querySelector('.etapas [data-e="' + id + '"]'); if (!li) return;
    li.className = st; li.querySelector('.ic').textContent = { ok: '✓', aviso: '!', erro: '✗', rodando: '◌', pulado: '–' }[st] || '○';
    if (det != null) li.querySelector('.det').textContent = det;
  };
  ui.etapaErro = function (m) { var li = raiz.querySelector('.etapas li:not(.ok):not(.pulado):not(.aviso)'); if (li) { li.className = 'erro'; li.querySelector('.ic').textContent = '✗'; li.querySelector('.det').textContent = m; } };
  ui.preencherForm = function () {
    QA('[data-f]').forEach(function (x) { var k = x.getAttribute('data-f'); if (x.type === 'checkbox') x.checked = !!obra[k]; else if (x.type !== 'file') x.value = obra[k] == null ? '' : obra[k]; });
    QA('[data-o]').forEach(function (x) { var k = x.getAttribute('data-o'); if (x.type === 'checkbox') x.checked = !!obra[k]; else x.value = obra[k]; });
    QA('[data-ia]').forEach(function (m) { m.hidden = !_origemIA[m.getAttribute('data-ia')]; });
    var cm = Q('.capa-mini'); if (obra.capaPropria) { cm.src = obra.capaPropria; cm.hidden = false; } else cm.hidden = true;
    if (!obra.ctTexto) {
      var povos = pessoas(obra.autores).concat(pessoas(obra.organizadores)).filter(function (p) { return p.povo; }).map(function (p) { return p.povo; }).filter(function (v, i, a) { return a.indexOf(v) === i; });
      Q('[data-f="ctTexto"]').placeholder = 'Os conhecimentos tradicionais, os grafismos e as expressões culturais do povo ' + (povos.length ? frase(povos) : '[povo]') + ' registrados nesta obra são patrimônio coletivo de seu povo (Constituição Federal, art. 231). Seu uso comercial por terceiros depende do consentimento livre, prévio e informado da comunidade (Convenção nº 169 da OIT; Declaração das Nações Unidas sobre os Direitos dos Povos Indígenas, art. 31).';
    }
  };
  Q('[data-f="ctDeclaracao"]').addEventListener('change', function (e) { var ta = Q('[data-f="ctTexto"]'); if (e.target.checked && !ta.value) { ta.value = ta.placeholder; obra.ctTexto = ta.value; obraGuardar(); } });
  ui.preencherCfg = function () {
    QA('[data-c]').forEach(function (x) { var v = getC(x.getAttribute('data-c')); if (x.type === 'checkbox') x.checked = !!v; else x.value = v == null ? '' : v; });
    Q('[data-conselho]').value = cfg.conselho.map(function (m) { return m.nome + (m.vinculo ? ' — ' + m.vinculo : ''); }).join('\n');
    ui.renderLogos();
  };
  ui.renderLogos = function () {
    var box = Q('.logos-ed'); box.innerHTML = '';
    cfg.logos.forEach(function (l, i) {
      var d = document.createElement('div'); d.className = 'lg';
      d.innerHTML = '<div class="linha"><b style="color:#F2C45A">' + esc(l.sigla) + '</b><span style="font-size:.7rem;color:rgba(247,242,232,.7)">' + esc(l.nome) + '</span></div>' +
        '<div class="vis" style="background:' + esc(l.fundo || '#fff') + '"></div>' +
        '<div class="linha"><label style="font-size:.72rem">Papel <select data-k="papel"><option>Realização</option><option>Coedição</option><option>Apoio institucional</option><option>Apoio</option><option>Parceria</option><option>Patrocínio</option><option>Fomento</option></select></label>' +
        '<label style="font-size:.72rem">Fundo <input type="color" data-k="fundo" value="' + esc(/^#[0-9a-f]{6}$/i.test(l.fundo) ? l.fundo : '#ffffff') + '"></label></div>' +
        '<label style="font-size:.72rem;display:flex;gap:.35rem"><input type="checkbox" data-k="autorizado"' + (l.autorizado ? ' checked' : '') + '> Uso da marca autorizado pela instituição</label>' +
        '<div class="linha"><input type="file" accept="image/png,image/jpeg,image/svg+xml" data-k="arq" style="font-size:.7rem"><button class="bt" type="button" data-k="cima">↑</button><button class="bt" type="button" data-k="fora" title="Remover da publicação">✕</button></div>';
      d.querySelector('[data-k="papel"]').value = l.papel;
      var vis = d.querySelector('.vis');
      logoDados(l).then(function (x) { vis.innerHTML = x ? '<img alt="Logomarca ' + esc(l.sigla) + '" src="' + x.url + '">' : '<span class="falta">Logomarca oficial não carregada</span>'; });
      d.querySelector('[data-k="papel"]').addEventListener('change', function (e) { l.papel = e.target.value; cfgGuardarLocal(); });
      d.querySelector('[data-k="fundo"]').addEventListener('input', function (e) { l.fundo = e.target.value; vis.style.background = l.fundo; cfgGuardarLocal(); });
      d.querySelector('[data-k="autorizado"]').addEventListener('change', function (e) { l.autorizado = e.target.checked; cfgGuardarLocal(); });
      d.querySelector('[data-k="cima"]').addEventListener('click', function () { if (i) { cfg.logos.splice(i - 1, 0, cfg.logos.splice(i, 1)[0]); cfgGuardarLocal(); ui.renderLogos(); } });
      d.querySelector('[data-k="fora"]').addEventListener('click', function () { if (confirm('Retirar a logomarca ' + l.sigla + ' das publicações?')) { cfg.logos.splice(i, 1); cfgGuardarLocal(); ui.renderLogos(); } });
      d.querySelector('[data-k="arq"]').addEventListener('change', function (e) {
        var f = e.target.files[0]; if (!f) return;
        f.arrayBuffer().then(async function (ab) {
          var bytes = new Uint8Array(ab), mime = f.type || 'image/png';
          if (mime !== 'image/svg+xml') { var nz = await normalizarImagem(bytes, mime); if (!nz) { ui.msg('Formato de imagem não suportado.', 'err'); return; } if (nz.w && nz.w < 300 && nz.h < 300) ui.msg('Atenção: a imagem de ' + l.sigla + ' tem resolução baixa (' + nz.w + '×' + nz.h + ').', 'err'); bytes = nz.bytes; mime = nz.mime; }
          var ext = mime === 'image/png' ? 'png' : mime === 'image/svg+xml' ? 'svg' : 'jpg';
          l._dataUrl = bytesParaDataUrl(bytes, mime);
          var caminho = 'logos/' + l.id + '.' + ext;
          delete _logoCache[l.arquivo]; l.arquivo = caminho; _logoCache[caminho] = { bytes: bytes, mime: mime, url: l._dataUrl };
          cfgGuardarLocal(); ui.renderLogos();
          if (ghOk()) ghPut('editora/' + caminho, bufParaB64(bytes), 'Editora: logomarca ' + l.sigla).then(function () { return cfgSalvarNuvem(); }).then(function () { ui.msg('Logomarca ' + l.sigla + ' salva na nuvem.', 'ok'); }, function (er) { ui.msg('Logomarca guardada neste navegador. Nuvem: ' + er.message, 'err'); });
          else ui.msg('Logomarca guardada nesta sessão. Entre como ADM para salvar na nuvem.', 'err');
        });
      });
      box.appendChild(d);
    });
  };
  ui.resultado = function (livro, res) {
    var r = Q('.res'); r.hidden = false;
    Q('.placar').innerHTML = '<img class="capa-mini" alt="Capa gerada" src="' + URL.createObjectURL(new Blob([livro.capaBytes], { type: 'image/jpeg' })) + '"><div><div class="st ' + res.classe + '">' + res.status + '</div><div class="ct">' + res.b + ' bloqueante(s) · ' + res.g + ' grave(s) · ' + res.a + ' aviso(s) · ' + Object.keys(livro.A.correcoes).length + ' tipos de correção automática</div></div><div class="pt">' + res.pontos + '<span style="font-size:.8rem">/100</span></div>';
    var sevs = ['bloqueante', 'grave', 'aviso', 'info', 'correções'];
    Q('.filtros').innerHTML = sevs.map(function (s) { var n = s === 'correções' ? Object.keys(livro.A.correcoes).length : livro.A.conta(s); return '<button class="bt" data-sv="' + s + '">' + s + ' (' + n + ')</button>'; }).join('');
    function lista(sv) {
      var oc = Q('.ocorr');
      if (sv === 'correções') { oc.innerHTML = Object.keys(livro.A.correcoes).map(function (k) { return '<div><span class="sv info">✓ ' + livro.A.correcoes[k] + '</span>' + esc(k) + '</div>'; }).join('') || '<div>Nenhuma.</div>'; return; }
      var it = livro.A.itens.filter(function (i) { return !sv || i.sev === sv; });
      oc.innerHTML = it.map(function (i) { return '<div><span class="sv ' + i.sev + '">' + i.sev + '</span><b>' + esc(i.cat) + ':</b> ' + esc(i.msg) + (i.onde ? ' <i>(' + esc(i.onde) + ')</i>' : '') + (i.sug || i.norma ? '<small>' + (i.norma ? esc(i.norma) + (i.sug ? ' · ' : '') : '') + esc(i.sug) + '</small>' : '') + '</div>'; }).join('') || '<div>Nenhuma ocorrência.</div>';
    }
    QA('.filtros button').forEach(function (b) { b.addEventListener('click', function () { lista(b.getAttribute('data-sv')); }); });
    lista(res.b ? 'bloqueante' : res.g ? 'grave' : 'aviso');
    selPg.innerHTML = livro.paginas.map(function (p, i) { return '<option value="' + i + '">' + esc(rotuloNav(p.s)) + '</option>'; }).join('');
    selPg.value = 0; mostrarPg(0);
  };
  ui.preencherForm(); ui.preencherCfg(); ui.travar(false);
}

/* ───────────────────────── inicialização ───────────────────────── */
var _montado = false;
function iniciar(alvo) {
  if (_montado || !alvo) return;
  _montado = true;
  obraCarregar();
  cfgCarregar().then(function () { montarUI(alvo); });
}
window.EBOOK_ICET = {
  versao: VERSAO, iniciar: iniciar,
  // API para testes e automação
  _interno: { lerArquivo: lerArquivo, processar: processar, processarIlustracoes: processarIlustracoes, montarEditoriais: montarEditoriais, empacotar: empacotar, auditarObra: auditarObra, resumoAuditoria: resumoAuditoria, relatorioHtml: relatorioHtml, isbnValido: isbnValido, extrairCitacoes: extrairCitacoes, libs: libs, cfg: function () { return cfg; }, obra: function () { return obra; }, setObra: function (o) { obra = mesclar(clone(OBRA_PADRAO), o); obraGuardar(); if (ui.preencherForm) ui.preencherForm(); }, estado: estado, receberArquivo: receberArquivo, produzir: produzir, logosDaObra: logosDaObra }
};
function auto() {
  var alvo = document.getElementById('editora-ebook-motor');
  if (!alvo) return;
  var tentar = function () { if (document.body.classList.contains('adm-on')) iniciar(alvo); };
  tentar();
  new MutationObserver(tentar).observe(document.body, { attributes: true, attributeFilter: ['class'] });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', auto); else auto();
})();
