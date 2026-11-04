/* Acervo editorial — Editora Cacique Enir Terena
   Catálogo de títulos, edições, versões, ISBN e exemplares numerados, com os arquivos de cada versão.
   Tudo é gravado no repositório do site CIFRADO (AES-GCM 256): o repositório é público, então o catálogo
   e os arquivos só podem ser lidos por quem tem a senha do ADM. A chave do acervo é aleatória e fica
   embrulhada pela senha do ADM (PBKDF2); trocar a senha exige "Reproteger" com a senha anterior. */
(function () {
'use strict';
var DIR = 'editora/acervo/', CAT = DIR + 'catalogo.cifrado.json', ARQ = DIR + 'arquivos/';
var SITUACOES = ['em produção', 'em avaliação pelo conselho', 'aprovada', 'publicada', 'suspensa', 'esgotada', 'retirada de circulação'];
var FORMATOS = [['epub', 'EPUB'], ['pdf', 'PDF'], ['html', 'HTML de leitura'], ['impresso', 'Impresso']];
var TIPOS_VERSAO = [['preparacao', 'Preparação (arquivada antes do ISBN)'], ['lancamento', 'Lançamento da edição'], ['correcao', 'Correção (sem mudança de conteúdo)'], ['reimpressao', 'Reimpressão'], ['atualizacao', 'Atualização de arquivo (mesmo conteúdo)']];
var TIPOS_DOC = [['resolucao', 'Resolução de criação da Editora'], ['ato-conselho', 'Ato ou portaria do Conselho Editorial'], ['aprovacao', 'Aprovação de obra pelo Conselho Editorial'], ['isbn', 'Declaração de registro de ISBN (CBL)'], ['deposito', 'Comprovante de depósito legal (Biblioteca Nacional)'], ['direitos', 'Registro de direitos autorais'], ['contrato', 'Contrato ou cessão de direitos'], ['marca', 'Autorização de uso de marca'], ['outro', 'Outro documento']];
function nomeTipoDoc(t) { return (TIPOS_DOC.find(function (x) { return x[0] === t; }) || [0, t])[1]; }
var FINALIDADES = ['venda', 'doação', 'cortesia', 'autor(a)', 'avaliação/parecer', 'depósito legal', 'imprensa', 'biblioteca', 'arquivo da editora', 'outra'];
var I = function () { return window.EBOOK_ICET && window.EBOOK_ICET._interno; };
var st = { cat: null, sha: null, chave: null, envelope: null, raiz: null, vista: 'titulos', obraId: null, carregando: false };

/* ───────── utilidades ───────── */
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function hoje() { return new Date().toISOString().slice(0, 10); }
function dataBr(d) { if (!d) return ''; var p = String(d).slice(0, 10).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : d; }
function n3(n) { return String(n).padStart(3, '0'); }
function ord(n) { return n + 'ª'; }
function tam(b) { return b > 1048576 ? (b / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB'; }
function isbnL(s) { return String(s || '').replace(/[^0-9Xx]/g, '').toUpperCase(); }
function isbnOk(s) { var f = I() && I().isbnValido; return f ? f(s) : isbnL(s).length === 13; }
function isbnFmt(s) { var d = isbnL(s); return d.length === 13 ? d.slice(0, 3) + '-' + d.slice(3, 5) + '-' + d.slice(5, 10) + '-' + d.slice(10, 12) + '-' + d[12] : s; }
function b64(u) { return I().bufParaB64(u); }
function deB64(s) { var x = atob(s), u = new Uint8Array(x.length); for (var i = 0; i < x.length; i++) u[i] = x.charCodeAt(i); return u; }
function senha() { return I() && I().senhaAdm ? I().senhaAdm() : ''; }
function ghOk() { return !!(window.GH && window.GH.token && window.GH.repo); }
function msg(t, tipo) { st.ultMsg = [t, tipo]; var m = st.raiz && st.raiz.querySelector('.ac-msg'); if (m) { m.textContent = t; m.className = 'msg ac-msg' + (tipo ? ' ' + tipo : ''); } }
function baixar(blob, nome) { if (I() && I().baixar) return I().baixar(blob, nome); var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nome; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 2000); }
function slug(s) { return I().slug(s); }
function sha256(u) { return crypto.subtle.digest('SHA-256', u).then(function (h) { return Array.from(new Uint8Array(h)).map(function (x) { return x.toString(16).padStart(2, '0'); }).join(''); }); }
function idAleatorio() { return Array.from(crypto.getRandomValues(new Uint8Array(12))).map(function (x) { return x.toString(16).padStart(2, '0'); }).join(''); }

/* ───────── cifra ───────── */
async function novaChave() { return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']); }
async function embrulhar(chave, pw) { var raw = new Uint8Array(await crypto.subtle.exportKey('raw', chave)); return I().cifrarSegredo(b64(raw), pw); }
async function desembrulhar(env, pw) { var t = await I().decifrarSegredo(env, pw); if (!t) return null; return crypto.subtle.importKey('raw', deB64(t), 'AES-GCM', true, ['encrypt', 'decrypt']); }
async function cifrar(u8) { var iv = crypto.getRandomValues(new Uint8Array(12)); var c = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, st.chave, u8)); var o = new Uint8Array(12 + c.length); o.set(iv); o.set(c, 12); return o; }
async function decifrar(u8) { return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: u8.subarray(0, 12) }, st.chave, u8.subarray(12))); }

/* ───────── GitHub ───────── */
function api(p) { return 'https://api.github.com/repos/' + window.GH.repo + '/contents/' + p; }
function cab(extra) { var h = { 'Authorization': 'token ' + window.GH.token, 'Accept': 'application/vnd.github+json' }; for (var k in extra || {}) h[k] = extra[k]; return h; }
async function ghLerJson(p) {
  var r = await fetch(api(p) + '?ref=main&t=' + Date.now(), { headers: cab(), cache: 'no-store' });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error('GitHub ' + r.status);
  var j = await r.json(), txt;
  if (j.content && j.encoding === 'base64') txt = new TextDecoder().decode(deB64(j.content.replace(/\s+/g, '')));
  else txt = await (await fetch(api(p) + '?ref=main&t=' + Date.now(), { headers: cab({ Accept: 'application/vnd.github.raw' }), cache: 'no-store' })).text();
  return { sha: j.sha, dados: JSON.parse(txt) };
}
async function ghLerBytes(p) {
  var r = await fetch(api(p) + '?ref=main', { headers: cab({ Accept: 'application/vnd.github.raw' }), cache: 'no-store' });
  if (!r.ok) throw new Error('arquivo não encontrado no acervo (' + r.status + ')');
  return new Uint8Array(await r.arrayBuffer());
}
async function ghGravar(p, conteudoB64, mensagem, sha) {
  var corpo = { message: mensagem, content: conteudoB64, branch: 'main' }; if (sha) corpo.sha = sha;
  var r = await fetch(api(p), { method: 'PUT', headers: cab({ 'Content-Type': 'application/json' }), body: JSON.stringify(corpo) });
  var j = await r.json().catch(function () { return {}; });
  if (r.status === 409 || r.status === 422 && /sha/i.test(j.message || '')) { var e = new Error('o acervo foi alterado por outro ADM; recarregue e repita'); e.conflito = true; throw e; }
  if (!r.ok) throw new Error(j.message || ('GitHub ' + r.status));
  return j;
}

/* ───────── catálogo ───────── */
function catVazio() {
  return { versao: 1, criado: new Date().toISOString(), editora: { sigla: 'ECET', prefixoIsbn: '978-65-84351', proximoCodigo: 1 }, isbns: [], obras: [], historico: [] };
}
function log(acao, obra, detalhe) { st.cat.historico.unshift({ quando: new Date().toISOString(), acao: acao, obra: obra || '', detalhe: detalhe || '' }); if (st.cat.historico.length > 3000) st.cat.historico.length = 3000; }
function obraPorId(id) { return st.cat && st.cat.obras.find(function (o) { return o.id === id; }); }
function novoCodigo() { var e = st.cat.editora, c = e.sigla + '-' + String(e.proximoCodigo).padStart(4, '0'); e.proximoCodigo++; return c; }
function edVigente(o) { return o.edicoes[o.edicoes.length - 1]; }
function verVigente(ed) { return ed.versoes.find(function (v) { return v.vigente; }) || ed.versoes[ed.versoes.length - 1]; }

function abrir() { if (!st._abrindo) st._abrindo = abrir0().then(function () { st._abrindo = null; }, function () { st._abrindo = null; }); return st._abrindo; }
async function abrir0() {
  if (st.carregando) return;
  if (!ghOk() || !senha()) { desenhar(); return; }
  st.carregando = true; msg('Abrindo o acervo…');
  try {
    var r = await ghLerJson(CAT);
    if (!r) { st.cat = null; st.sha = null; st.envelope = null; desenhar(); msg('O acervo ainda não foi criado. Clique em “Criar o acervo”.'); return; }
    var k = await desembrulhar(r.dados.chave, senha());
    if (!k) { st.cat = null; st.envelope = r.dados; desenhar(); msg('A senha atual do ADM não abre o acervo. Se a senha foi trocada, use “Reproteger com a senha anterior”.', 'err'); return; }
    st.chave = k; st.envelope = r.dados; st.sha = r.sha;
    st.cat = JSON.parse(new TextDecoder().decode(await decifrar(deB64(r.dados.dados))));
    desenhar(); msg('Acervo aberto: ' + st.cat.obras.length + ' título(s).', 'ok');
  } catch (e) { msg('Não foi possível abrir o acervo: ' + e.message, 'err'); }
  finally { st.carregando = false; }
}
async function criar() {
  if (!ghOk() || !senha()) return msg('Entre como ADM para criar o acervo.', 'err');
  st.chave = await novaChave(); st.cat = catVazio(); st.sha = null;
  log('criação do acervo', '', '');
  await salvar('Acervo: criação');
  desenhar();
}
async function salvar(mensagem) {
  var cif = await cifrar(new TextEncoder().encode(JSON.stringify(st.cat)));
  var env = { tipo: 'acervo-editora-cacique-enir-terena', versao: 1, alg: 'AES-GCM-256', chave: (st.envelope && st.envelope.chave && !st._rewrap) ? st.envelope.chave : await embrulhar(st.chave, senha()), dados: b64(cif), atualizado: new Date().toISOString() };
  st._rewrap = false;
  var txt = JSON.stringify(env);
  try {
    var j = await ghGravar(CAT, b64(new TextEncoder().encode(txt)), mensagem || 'Acervo: atualização', st.sha);
    st.sha = j.content && j.content.sha; st.envelope = env;
    msg('Acervo salvo.', 'ok');
  } catch (e) { msg('Não salvo: ' + e.message, 'err'); throw e; }
}
async function guardarArquivo(bytes, nome, formato) {
  var id = idAleatorio(), hash = await sha256(bytes);
  msg('Cifrando e enviando ' + nome + ' (' + tam(bytes.length) + ')…');
  await ghGravar(ARQ + id + '.bin', b64(await cifrar(bytes)), 'Acervo: arquivo cifrado');
  return { id: id, nome: nome, formato: formato || formatoDe(nome), tamanho: bytes.length, sha256: hash, data: hoje() };
}
function formatoDe(nome) { var e = (String(nome).split('.').pop() || '').toLowerCase(); return { epub: 'EPUB', pdf: 'PDF', html: 'HTML', htm: 'HTML', json: 'Projeto', docx: 'Manuscrito', doc: 'Manuscrito', odt: 'Manuscrito', jpg: 'Capa', jpeg: 'Capa', png: 'Capa', zip: 'Pacote' }[e] || e.toUpperCase(); }
async function baixarArquivo(a) {
  msg('Baixando e decifrando ' + a.nome + '…');
  try {
    var u = await decifrar(await ghLerBytes(ARQ + a.id + '.bin'));
    if (a.sha256 && await sha256(u) !== a.sha256) throw new Error('a impressão digital (SHA-256) não confere');
    baixar(new Blob([u]), a.nome); msg(a.nome + ' baixado; integridade conferida.', 'ok');
  } catch (e) { msg('Falha ao baixar: ' + e.message, 'err'); }
}

/* ───────── ISBN ───────── */
function isbnUso(isbn) { var d = isbnL(isbn); return st.cat.isbns.find(function (x) { return x.isbn === d; }); }
function registrarIsbn(isbn, obra, edicao, formato) {
  var d = isbnL(isbn); if (!d) return null;
  if (!isbnOk(d)) throw new Error('ISBN ' + isbn + ' inválido (dígito verificador)');
  var u = isbnUso(d);
  if (u && u.situacao === 'atribuído' && !(u.obra === obra && u.edicao === edicao && u.formato === formato)) throw new Error('ISBN ' + isbnFmt(d) + ' já atribuído a ' + u.obra + ', ' + ord(u.edicao) + ' ed., ' + u.formato + '. Cada formato de cada edição exige ISBN próprio.');
  if (u && u.situacao === 'cancelado') throw new Error('ISBN ' + isbnFmt(d) + ' foi cancelado e não pode ser reutilizado.');
  if (!u) { u = { isbn: d, situacao: 'livre', data: hoje() }; st.cat.isbns.push(u); }
  u.situacao = 'atribuído'; u.obra = obra; u.edicao = edicao; u.formato = formato; u.atribuido = hoje();
  return u;
}
function proximoIsbnLivre() { var l = st.cat.isbns.find(function (x) { return x.situacao === 'livre'; }); return l ? l.isbn : ''; }

/* ───────── interface ───────── */
var CSS = '.ac .sub2{display:flex;gap:.3rem;flex-wrap:wrap;margin:.2rem 0 .8rem}.ac .sub2 button{font-size:.74rem}.ac .sub2 button.on{background:rgba(242,196,90,.3)}' +
  '.ac .cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:.7rem}.ac .card{border:1px solid rgba(242,196,90,.3);border-radius:8px;padding:.7rem;cursor:pointer;display:grid;gap:.25rem}.ac .card:hover{border-color:#F2C45A}' +
  '.ac .card h4{margin:0;color:#F2C45A;font-size:.92rem}.ac .card small,.ac .mut{color:rgba(247,242,232,.62);font-size:.72rem}.ac .selo{display:inline-block;font-size:.64rem;border:1px solid rgba(242,196,90,.5);border-radius:1em;padding:.05rem .5rem;margin-right:.3rem}' +
  '.ac table{width:100%;border-collapse:collapse;font-size:.74rem;margin:.4rem 0}.ac th,.ac td{text-align:left;padding:.32rem .4rem;border-bottom:1px solid rgba(255,255,255,.08);vertical-align:top}.ac th{color:#E8A853;font-weight:600}' +
  '.ac .bloco{border:1px solid rgba(242,196,90,.22);border-radius:8px;padding:.75rem;margin:.7rem 0}.ac .bloco h4{margin:0 0 .5rem;color:#F2C45A;font-size:.9rem;display:flex;gap:.5rem;align-items:center;flex-wrap:wrap}' +
  '.ac .alerta{color:#fca5a5;font-size:.74rem}.ac .okk{color:#86efac}.ac .bt.mini{font-size:.68rem;padding:.2rem .5rem}.ac .linha{display:flex;gap:.5rem;align-items:center;flex-wrap:wrap}' +
  '.ac .form{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:.6rem}.ac .form label{font-size:.7rem;color:#E8A853;display:grid;gap:.2rem}.ac .form textarea{min-height:4rem}' +
  '.ac dialog{background:#1b130d;color:#f7f2e8;border:1px solid rgba(242,196,90,.5);border-radius:10px;max-width:640px;width:94vw}.ac dialog::backdrop{background:rgba(0,0,0,.6)}';

function montar(alvo) {
  if (st.raiz) return;
  if (!document.getElementById('ac-css')) { var s = document.createElement('style'); s.id = 'ac-css'; s.textContent = CSS; document.head.appendChild(s); }
  st.raiz = document.createElement('div'); st.raiz.className = 'ac'; alvo.appendChild(st.raiz);
  st.raiz.addEventListener('click', clique);
  desenhar();
}
function desenhar() {
  var R = st.raiz; if (!R) return;
  var topo = '<div class="aviso-box">Acervo da Editora: títulos, edições, versões, ISBN, exemplares numerados e os arquivos de cada versão. ' +
    'O repositório do site é público; por isso o catálogo e os arquivos são gravados cifrados e só abrem com a senha do ADM.</div>';
  var corpo = '';
  if (!ghOk() || !senha()) corpo = '<p class="mut">Entre como ADM (senha) para abrir o acervo.</p>';
  else if (!st.cat && st.envelope) corpo = '<div class="acoes"><button class="bt" data-ac="reproteger">🔑 Reproteger com a senha anterior</button><button class="bt" data-ac="abrir">⟳ Tentar de novo</button></div>';
  else if (!st.cat) corpo = '<div class="acoes"><button class="bt pri" data-ac="criar">📚 Criar o acervo</button><button class="bt" data-ac="abrir">⟳ Abrir</button></div>';
  else {
    var V = st.vista;
    corpo = '<div class="sub2">' + [['titulos', '📚 Títulos'], ['documentos', '📄 Documentos'], ['isbn', '🔢 ISBN'], ['exemplares', '🎫 Exemplares'], ['historico', '🕘 Histórico'], ['dados', '⇅ Importar e exportar']].map(function (b) { return '<button class="bt' + (V === b[0] || (V === 'obra' && b[0] === 'titulos') ? ' on' : '') + '" data-ac="vista" data-v="' + b[0] + '">' + b[1] + '</button>'; }).join('') +
      '<button class="bt" data-ac="abrir" title="Recarregar do servidor">⟳</button></div>';
    if (!st.cat.documentos) st.cat.documentos = [];
    corpo += V === 'obra' ? vObra() : V === 'documentos' ? vDocumentos() : V === 'isbn' ? vIsbn() : V === 'exemplares' ? vExemplares() : V === 'historico' ? vHistorico() : V === 'dados' ? vDados() : vTitulos();
  }
  R.innerHTML = topo + corpo + '<div class="msg ac-msg' + (st.ultMsg && st.ultMsg[1] ? ' ' + st.ultMsg[1] : '') + '" role="status" aria-live="polite">' + esc(st.ultMsg ? st.ultMsg[0] : '') + '</div><input type="file" multiple hidden data-ac-arq><dialog data-ac-dlg></dialog>';
}
function pendencias(o) {
  var p = [], ed = edVigente(o); if (!ed) return ['sem edição'];
  if (!(ed.formatos.epub && ed.formatos.epub.isbn) && !(ed.formatos.pdf && ed.formatos.pdf.isbn)) p.push('ISBN não registrado');
  if (o.situacao === 'publicada') {
    if (!ed.publicacao) p.push('data de publicação');
    if (!(ed.depositoLegal && ed.depositoLegal.data)) { var dias = ed.publicacao ? Math.floor((Date.now() - new Date(ed.publicacao)) / 864e5) : 0; p.push('depósito legal na Biblioteca Nacional' + (dias > 30 ? ' (prazo de 30 dias vencido)' : '')); }
  }
  if (!ed.aprovacao || !ed.aprovacao.data) p.push('aprovação do conselho');
  if (!ed.versoes.length || !verVigente(ed).arquivos.length) p.push('arquivos da versão');
  else if (ed.versoes.every(function (v) { return v.tipo === 'preparacao'; })) p.push('lançamento: ao receber o ISBN, regerar com o número e registrar a versão ' + ed.n + '.0');
  return p;
}
function vTitulos() {
  var o = st.cat.obras;
  return '<div class="acoes"><button class="bt pri" data-ac="nova-obra">＋ Novo título</button>' + (I() && I().estado && I().estado.epub ? '<button class="bt" data-ac="registrar-motor">📥 Registrar o livro gerado no motor</button>' : '') + '</div>' +
    (o.length ? '<div class="cards">' + o.map(function (x) {
      var ed = edVigente(x), v = ed && verVigente(ed), p = pendencias(x);
      return '<div class="card" data-ac="ver" data-id="' + x.id + '"><small>' + esc(x.id) + '</small><h4>' + esc(x.titulo) + '</h4><small>' + esc((x.autores || []).slice(0, 3).join('; ') + ((x.autores || []).length > 3 ? ' et al.' : '')) + '</small>' +
        '<div><span class="selo">' + esc(x.situacao) + '</span>' + (ed ? '<span class="selo">' + ord(ed.n) + ' ed.' + (v ? ' · v' + esc(v.v) : '') + '</span>' : '') + (ed && ed.exemplares.length ? '<span class="selo">' + ed.exemplares.length + ' exemplar(es)</span>' : '') + '</div>' +
        (p.length ? '<small class="alerta">Pendente: ' + esc(p.join('; ')) + '</small>' : '<small class="okk">Em ordem</small>') + '</div>';
    }).join('') + '</div>' : '<p class="mut">Nenhum título no acervo. Use “Novo título”, “Registrar o livro gerado no motor” ou importe um pacote na aba “Importar e exportar”.</p>');
}
function campoF(rot, nome, val, tipo, extra) { return '<label>' + esc(rot) + (tipo === 'area' ? '<textarea data-k="' + nome + '">' + esc(val) + '</textarea>' : tipo === 'sel' ? '<select data-k="' + nome + '">' + extra.map(function (x) { return '<option' + (x === val ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join('') + '</select>' : '<input type="' + (tipo || 'text') + '" data-k="' + nome + '" value="' + esc(val) + '">') + '</label>'; }
function vObra() {
  var o = obraPorId(st.obraId); if (!o) { st.vista = 'titulos'; return vTitulos(); }
  var h = '<div class="acoes"><button class="bt" data-ac="vista" data-v="titulos">← Títulos</button></div>' +
    '<div class="bloco"><h4>' + esc(o.id) + ' · ' + esc(o.titulo) + '</h4><div class="form" data-form="obra">' +
    campoF('Título', 'titulo', o.titulo) + campoF('Subtítulo', 'subtitulo', o.subtitulo) +
    campoF('Autores (um por linha)', 'autores', (o.autores || []).join('\n'), 'area') + campoF('Organizadores (um por linha)', 'organizadores', (o.organizadores || []).join('\n'), 'area') +
    campoF('Situação', 'situacao', o.situacao, 'sel', SITUACOES) + campoF('Série / coleção', 'serie', o.serie) + campoF('Idioma', 'idioma', o.idioma || 'pt-BR') +
    campoF('CDD', 'cdd', o.cdd) + campoF('CDU', 'cdu', o.cdu) + campoF('Assuntos (um por linha)', 'assuntos', (o.assuntos || []).join('\n'), 'area') +
    campoF('Sinopse', 'sinopse', o.sinopse, 'area') + campoF('Observações internas', 'obs', o.obs, 'area') +
    '</div><div class="acoes"><button class="bt pri" data-ac="salvar-obra">💾 Salvar dados do título</button><button class="bt" data-ac="nova-edicao">＋ Nova edição</button><button class="bt" data-ac="ficha-csv">⬇ Ficha do título (CSV)</button></div></div>';
  var docs = (st.cat.documentos || []).filter(function (d) { return d.obra === o.id; });
  h += '<div class="bloco"><h4>Documentos desta obra <button class="bt mini" data-ac="doc-novo">＋ Arquivar documento</button></h4>' + tabelaDocs(docs) + '</div>';
  o.edicoes.slice().reverse().forEach(function (ed) { h += vEdicao(o, ed); });
  return h;
}
function vEdicao(o, ed) {
  var k = o.id + '|' + ed.n, F = ed.formatos;
  var h = '<div class="bloco" data-ed="' + ed.n + '"><h4>' + ord(ed.n) + ' edição' + (ed.rotulo ? ' · ' + esc(ed.rotulo) : '') + (ed === edVigente(o) ? ' <span class="selo">vigente</span>' : '') + '</h4>' +
    '<div class="form" data-form="ed" data-n="' + ed.n + '">' +
    campoF('Designação (ex.: revista e ampliada)', 'rotulo', ed.rotulo) + campoF('Ano', 'ano', ed.ano) + campoF('Data de publicação', 'publicacao', ed.publicacao, 'date') +
    campoF('Aprovação do conselho (data)', 'aprovacaoData', ed.aprovacao && ed.aprovacao.data, 'date') + campoF('Ato da aprovação (ata, parecer)', 'aprovacaoAto', ed.aprovacao && ed.aprovacao.ato) +
    campoF('Depósito legal na BN (data de envio)', 'depData', ed.depositoLegal && ed.depositoLegal.data, 'date') + campoF('Depósito legal: protocolo', 'depProt', ed.depositoLegal && ed.depositoLegal.protocolo) +
    campoF('Registro de direitos autorais (órgão e nº)', 'direitos', ed.direitos) +
    FORMATOS.map(function (f) { return campoF('ISBN ' + f[1], 'isbn_' + f[0], F[f[0]] && F[f[0]].isbn ? isbnFmt(F[f[0]].isbn) : ''); }).join('') +
    campoF('Tiragem do impresso', 'tiragem', F.impresso && F.impresso.tiragem) + campoF('Preço de capa / licença (R$)', 'preco', ed.preco) +
    campoF('Notas da edição', 'notas', ed.notas, 'area') +
    '</div><div class="acoes"><button class="bt pri" data-ac="salvar-ed" data-n="' + ed.n + '">💾 Salvar edição</button>' + (proximoIsbnLivre() ? '<button class="bt" data-ac="isbn-livre" data-n="' + ed.n + '" title="Preenche o primeiro formato sem ISBN com o próximo ISBN livre do lote">🔢 Usar ISBN livre do lote</button>' : '') + '</div>';
  // versões
  h += '<h4 style="margin-top:.8rem">Versões e arquivos <button class="bt mini" data-ac="nova-versao" data-n="' + ed.n + '">＋ Nova versão com arquivos</button>' + (I() && I().estado && I().estado.epub ? '<button class="bt mini" data-ac="registrar-motor" data-n="' + ed.n + '">📥 Versão a partir do motor</button>' : '') + '</h4>';
  h += ed.versoes.length ? '<table><tr><th>Versão</th><th>Data</th><th>Tipo</th><th>Notas</th><th>Arquivos</th><th></th></tr>' + ed.versoes.slice().reverse().map(function (v) {
    return '<tr><td><b>' + esc(v.v) + '</b>' + (v.vigente ? '<br><span class="selo">vigente</span>' : '') + '</td><td>' + dataBr(v.data) + '</td><td>' + esc((TIPOS_VERSAO.find(function (t) { return t[0] === v.tipo; }) || [0, v.tipo])[1]) + '</td><td>' + esc(v.notas || '') + (v.responsavel ? '<br><small class="mut">' + esc(v.responsavel) + '</small>' : '') + '</td><td>' +
      v.arquivos.map(function (a) { return '<div><a href="#" data-ac="baixar" data-arq="' + a.id + '">⬇ ' + esc(a.nome) + '</a> <small class="mut">' + esc(a.formato) + ' · ' + tam(a.tamanho) + '</small>' + (a.formato === 'Projeto' ? ' <button class="bt mini" data-ac="abrir-motor" data-arq="' + a.id + '">abrir no motor</button>' : '') + '</div>'; }).join('') +
      '<button class="bt mini" data-ac="mais-arq" data-n="' + ed.n + '" data-v="' + esc(v.v) + '">＋ arquivo</button></td><td>' + (v.vigente ? '' : '<button class="bt mini" data-ac="vigente" data-n="' + ed.n + '" data-v="' + esc(v.v) + '">tornar vigente</button>') + '</td></tr>';
  }).join('') + '</table>' : '<p class="mut">Nenhuma versão registrada.</p>';
  // exemplares
  var ativos = ed.exemplares.filter(function (x) { return x.situacao !== 'cancelado'; }).length;
  h += '<h4 style="margin-top:.8rem">Exemplares numerados <small class="mut">' + ativos + ' ativo(s) · próximo nº ' + n3(proxEx(ed)) + '</small> <button class="bt mini" data-ac="emitir" data-n="' + ed.n + '">🎫 Emitir exemplar</button>' + (fonteMotor(ed) ? '<button class="bt mini" data-ac="carregar-motor" data-n="' + ed.n + '" title="Abre no motor o livro arquivado nesta edição (projeto e manuscrito)">⚙ Carregar no motor</button>' : '') + '</h4>';
  h += ed.exemplares.length ? '<table><tr><th>Nº</th><th>Destinatário</th><th>Finalidade</th><th>Formato · versão</th><th>Data</th><th>Situação</th><th></th></tr>' + ed.exemplares.slice().reverse().map(function (x) {
    return '<tr><td><b>' + n3(x.n) + '</b></td><td>' + esc(x.destinatario) + (x.contato ? '<br><small class="mut">' + esc(x.contato) + '</small>' : '') + '</td><td>' + esc(x.finalidade || '') + '</td><td>' + esc(x.formato || '') + (x.versao ? ' · v' + esc(x.versao) : '') + '</td><td>' + dataBr(x.data) + '</td><td>' + esc(x.situacao || 'ativo') + (x.motivo ? '<br><small class="mut">' + esc(x.motivo) + '</small>' : '') + '</td><td>' +
      (x.arquivo ? '<a href="#" data-ac="baixar" data-arq="' + x.arquivo.id + '" title="Baixar o arquivo deste exemplar">⬇</a> ' : '') + (x.senha ? '<button class="bt mini" data-ac="ver-senha" data-n="' + ed.n + '" data-x="' + x.n + '" title="Mostrar a senha de leitura">🔑</button> ' : (x.formato === 'HTML' ? '<button class="bt mini" data-ac="reg-senha" data-n="' + ed.n + '" data-x="' + x.n + '">registrar senha</button> ' : '')) + (x.situacao !== 'cancelado' ? '<button class="bt mini" data-ac="cancelar-ex" data-n="' + ed.n + '" data-x="' + x.n + '">cancelar</button>' : '') + '</td></tr>';
  }).join('') + '</table>' : '<p class="mut">Nenhum exemplar emitido nesta edição.</p>';
  return h + '</div>';
}
function linhaDoc(d) {
  var o = d.obra && obraPorId(d.obra);
  return '<tr><td>' + esc(nomeTipoDoc(d.tipo)) + (d.numero ? '<br><small class="mut">nº ' + esc(d.numero) + '</small>' : '') + '</td><td>' + esc(d.titulo) + (d.resumo ? '<br><small class="mut">' + esc(d.resumo) + '</small>' : '') + (d.alerta ? '<br><small class="alerta">' + esc(d.alerta) + '</small>' : '') + '</td><td>' + dataBr(d.data) + (d.emissor ? '<br><small class="mut">' + esc(d.emissor) + '</small>' : '') + '</td><td>' + (o ? esc(o.id) + (d.edicao ? ' · ' + ord(d.edicao) + ' ed.' : '') : '<span class="mut">Editora</span>') + (d.isbn ? '<br><small>ISBN ' + isbnFmt(d.isbn) + '</small>' : '') + (d.verificacao ? '<br><small class="mut">verificação: ' + esc(d.verificacao) + '</small>' : '') + '</td><td>' +
    (d.arquivos || []).map(function (a) { return '<div><a href="#" data-ac="baixar" data-arq="' + a.id + '">⬇ ' + esc(a.nome) + '</a></div>'; }).join('') + '<button class="bt mini" data-ac="doc-arq" data-d="' + d.id + '">＋ arquivo</button> <button class="bt mini" data-ac="doc-editar" data-d="' + d.id + '">editar</button></td></tr>';
}
function tabelaDocs(L) { return L.length ? '<table><tr><th>Tipo</th><th>Documento</th><th>Data · emissor</th><th>Vínculo</th><th>Arquivos</th></tr>' + L.map(linhaDoc).join('') + '</table>' : '<p class="mut">Nenhum documento arquivado.</p>'; }
function vDocumentos() {
  var D = st.cat.documentos.slice().sort(function (a, b) { return (b.data || '').localeCompare(a.data || ''); });
  var ed = D.filter(function (d) { return !d.obra; }), ob = D.filter(function (d) { return d.obra; });
  return '<div class="acoes"><button class="bt pri" data-ac="doc-novo">＋ Arquivar documento</button></div>' +
    '<p class="mut">Documentos oficiais da Editora e de cada obra, gravados cifrados. Ao arquivar, as informações vão para o lugar certo: a declaração de ISBN registra o número no lote e na edição; a aprovação do conselho preenche a aprovação da edição; a resolução e os atos do conselho podem atualizar o texto de constituição do conselho que sai nos créditos de todos os livros.</p>' +
    '<div class="bloco"><h4>Documentos da Editora</h4>' + tabelaDocs(ed) + '</div><div class="bloco"><h4>Documentos das obras</h4>' + tabelaDocs(ob) + '</div>';
}
function formDoc(d) {
  d = d || {};
  return campoF('Tipo', 'tipo', nomeTipoDoc(d.tipo || 'outro'), 'sel', TIPOS_DOC.map(function (t) { return t[1]; })) + campoF('Título ou ementa', 'titulo', d.titulo) + campoF('Número', 'numero', d.numero) + campoF('Data', 'data', d.data, 'date') + campoF('Emissor (órgão, conselho, CBL…)', 'emissor', d.emissor) +
    campoF('Obra vinculada', 'obra', d.obra ? d.obra + ' · ' + (obraPorId(d.obra) || {}).titulo : '(Editora, sem obra)', 'sel', ['(Editora, sem obra)'].concat(st.cat.obras.map(function (o) { return o.id + ' · ' + o.titulo; }))) + campoF('Edição', 'edicao', d.edicao || 1, 'number') +
    campoF('ISBN declarado (se houver)', 'isbn', d.isbn ? isbnFmt(d.isbn) : '') + campoF('Formato do ISBN', 'formato', d.formato || 'a definir', 'sel', ['a definir'].concat(FORMATOS.map(function (f) { return f[1]; }))) + campoF('Código de verificação', 'verificacao', d.verificacao) +
    campoF('Resumo', 'resumo', d.resumo, 'area') + campoF('Texto para os livros (resolução/ato: completa “Constituído e …” nos créditos)', 'textoLivros', d.textoLivros, 'area') +
    (d.id ? '' : '<label>Arquivos (PDF, imagem…)<input type="file" multiple data-k="arqs"></label>');
}
async function aplicarDoc(d) {
  var o = d.obra && obraPorId(d.obra), ed = o && (o.edicoes.find(function (x) { return x.n === (+d.edicao || 1); }) || null), feito = [];
  if (d.isbn && o && ed) {
    var fm = FORMATOS.find(function (f) { return f[1] === d.formato; });
    registrarIsbn(d.isbn, o.id, ed.n, fm ? fm[1] : 'a definir'); feito.push('ISBN ' + isbnFmt(d.isbn) + ' atribuído');
    if (fm) { ed.formatos[fm[0]] = ed.formatos[fm[0]] || {}; ed.formatos[fm[0]].isbn = isbnL(d.isbn); }
  } else if (d.isbn && !isbnUso(d.isbn)) { if (!isbnOk(d.isbn)) throw new Error('ISBN inválido'); st.cat.isbns.push({ isbn: isbnL(d.isbn), situacao: 'livre', data: hoje() }); feito.push('ISBN incluído no lote'); }
  if (d.tipo === 'aprovacao' && ed) { ed.aprovacao = { data: d.data, ato: d.titulo + (d.numero ? ', nº ' + d.numero : '') + (d.emissor ? ' (' + d.emissor + ')' : ''), documento: d.id }; feito.push('aprovação da ' + ord(ed.n) + ' edição'); }
  if (d.tipo === 'deposito' && ed) { ed.depositoLegal = { data: d.data, protocolo: d.numero, documento: d.id }; feito.push('depósito legal'); }
  if (d.tipo === 'direitos' && ed) { ed.direitos = (d.emissor ? d.emissor + ' ' : '') + (d.numero || ''); feito.push('registro de direitos'); }
  if ((d.tipo === 'resolucao' || d.tipo === 'ato-conselho') && d.textoLivros && I().cfg) {
    I().cfg().editora.conselhoAto = d.textoLivros.trim();
    try { await I().cfgSalvarNuvem(); feito.push('texto do conselho atualizado para todos os livros'); } catch (e) { feito.push('texto do conselho guardado só neste navegador (' + e.message + ')'); }
  }
  return feito;
}
function lerDocForm(v, d) {
  d.tipo = TIPOS_DOC.find(function (t) { return t[1] === v.tipo; })[0]; d.titulo = v.titulo.trim(); d.numero = v.numero.trim(); d.data = v.data; d.emissor = v.emissor.trim();
  d.obra = /^\(Editora/.test(v.obra) ? '' : v.obra.split(' · ')[0]; d.edicao = d.obra ? (+v.edicao || 1) : 0; d.isbn = isbnL(v.isbn); d.formato = v.formato; d.verificacao = v.verificacao.trim(); d.resumo = v.resumo.trim(); d.textoLivros = v.textoLivros.trim();
  if (!d.titulo) throw new Error('Informe o título ou a ementa do documento.');
  return d;
}
function proxEx(ed) { return ed.exemplares.reduce(function (m, x) { return Math.max(m, +x.n || 0); }, 0) + 1; }
function vIsbn() {
  var L = st.cat.isbns.slice().sort(function (a, b) { return a.isbn < b.isbn ? -1 : 1; });
  var livres = L.filter(function (x) { return x.situacao === 'livre'; }).length;
  return '<div class="bloco"><h4>Lote de ISBN da Editora</h4><div class="form">' + campoF('Prefixo de editora (informativo)', 'prefixo', st.cat.editora.prefixoIsbn) +
    '<label>Incluir ISBN recebidos da Agência Brasileira do ISBN (um por linha)<textarea data-isbn-novos placeholder="978-65-84351-01-1"></textarea></label></div>' +
    '<div class="acoes"><button class="bt pri" data-ac="isbn-incluir">＋ Incluir no lote</button></div><p class="mut">' + L.length + ' ISBN no controle · ' + livres + ' livre(s). Cada formato de cada edição recebe ISBN próprio; uma nova edição exige novo ISBN; correção e reimpressão mantêm o ISBN. ISBN cancelado nunca é reutilizado.</p></div>' +
    (L.length ? '<table><tr><th>ISBN</th><th>Situação</th><th>Título · edição · formato</th><th>Data</th><th></th></tr>' + L.map(function (x) {
      var o = x.obra && obraPorId(x.obra);
      return '<tr><td>' + isbnFmt(x.isbn) + '</td><td>' + esc(x.situacao) + '</td><td>' + (o ? esc(o.id + ' · ' + o.titulo) + ' · ' + ord(x.edicao) + ' ed. · ' + esc(x.formato) : '') + '</td><td>' + dataBr(x.atribuido || x.data) + '</td><td>' + (x.situacao === 'livre' ? '<button class="bt mini" data-ac="isbn-cancelar" data-i="' + x.isbn + '">cancelar</button>' : '') + '</td></tr>';
    }).join('') + '</table>' : '');
}
function todosEx() { var L = []; st.cat.obras.forEach(function (o) { o.edicoes.forEach(function (ed) { ed.exemplares.forEach(function (x) { L.push({ o: o, ed: ed, x: x }); }); }); }); return L.sort(function (a, b) { return (b.x.data || '').localeCompare(a.x.data || ''); }); }
function vExemplares() {
  var L = todosEx();
  return '<div class="acoes"><button class="bt" data-ac="csv-ex">⬇ Registro de exemplares (CSV)</button></div>' +
    (L.length ? '<table><tr><th>Título</th><th>Edição</th><th>Nº</th><th>Destinatário</th><th>Finalidade</th><th>Formato</th><th>Data</th><th>Situação</th></tr>' + L.map(function (e) {
      return '<tr><td>' + esc(e.o.titulo) + '<br><small class="mut">' + esc(e.o.id) + '</small></td><td>' + ord(e.ed.n) + '</td><td>' + n3(e.x.n) + '</td><td>' + esc(e.x.destinatario) + '</td><td>' + esc(e.x.finalidade || '') + '</td><td>' + esc(e.x.formato || '') + '</td><td>' + dataBr(e.x.data) + '</td><td>' + esc(e.x.situacao || 'ativo') + '</td></tr>';
    }).join('') + '</table>' : '<p class="mut">Nenhum exemplar emitido.</p>');
}
function vHistorico() {
  return '<table><tr><th>Quando</th><th>Ação</th><th>Título</th><th>Detalhe</th></tr>' + st.cat.historico.slice(0, 500).map(function (h) { return '<tr><td>' + esc(h.quando.slice(0, 16).replace('T', ' ')) + '</td><td>' + esc(h.acao) + '</td><td>' + esc(h.obra) + '</td><td>' + esc(h.detalhe) + '</td></tr>'; }).join('') + '</table>';
}
function vDados() {
  return '<div class="bloco"><h4>Importar pacote do acervo (.zip)</h4><p class="mut">Pacote com <code>acervo.json</code> (título, edição, versão e exemplares) e os arquivos da versão. Os arquivos são cifrados antes do envio.</p><div class="acoes"><button class="bt pri" data-ac="importar">📦 Escolher pacote</button></div></div>' +
    '<div class="bloco"><h4>Exportar</h4><div class="acoes"><button class="bt" data-ac="csv-cat">⬇ Catálogo (CSV)</button><button class="bt" data-ac="csv-ex">⬇ Exemplares (CSV)</button><button class="bt" data-ac="csv-isbn">⬇ ISBN (CSV)</button><button class="bt" data-ac="json-cat">⬇ Catálogo completo (JSON, sem arquivos)</button></div></div>' +
    '<div class="bloco"><h4>Numeração</h4><div class="form" data-form="numeracao">' + campoF('Sigla dos códigos de título', 'sigla', st.cat.editora.sigla) + campoF('Próximo código', 'proximoCodigo', st.cat.editora.proximoCodigo, 'number') + '</div><div class="acoes"><button class="bt" data-ac="salvar-num">💾 Salvar numeração</button></div></div>';
}

/* ───────── diálogos ───────── */
function dialogo(titulo, html, aoConfirmar) {
  var d = st.raiz.querySelector('[data-ac-dlg]');
  d.innerHTML = '<form method="dialog"><h4 style="margin:0 0 .6rem;color:#F2C45A">' + esc(titulo) + '</h4><div class="form">' + html + '</div><div class="acoes" style="margin-top:.8rem"><button class="bt pri" value="ok">Confirmar</button><button class="bt" value="cancel" formnovalidate>Cancelar</button></div></form>';
  d.onclose = function () { if (d.returnValue === 'ok') { var v = {}; d.querySelectorAll('[data-k]').forEach(function (x) { v[x.getAttribute('data-k')] = x.type === 'checkbox' ? x.checked : x.type === 'file' ? x.files : x.value; }); Promise.resolve(aoConfirmar(v)).catch(function (e) { msg(e.message, 'err'); }); } };
  d.showModal();
}
function lerForm(sel) { var v = {}; st.raiz.querySelectorAll(sel + ' [data-k]').forEach(function (x) { v[x.getAttribute('data-k')] = x.value; }); return v; }
function linhas(s) { return String(s || '').split(/\n+/).map(function (x) { return x.trim(); }).filter(Boolean); }
async function lerArquivos(lista) { var r = []; for (var i = 0; i < (lista || []).length; i++) r.push({ nome: lista[i].name, bytes: new Uint8Array(await lista[i].arrayBuffer()) }); return r; }
function novaEdicao(n, base) { return { n: n, rotulo: '', ano: String(new Date().getFullYear()), publicacao: '', aprovacao: {}, depositoLegal: {}, direitos: '', preco: '', notas: '', formatos: {}, versoes: [], exemplares: [], criada: hoje(), base: base || null }; }
function novaObra(d) {
  return { id: novoCodigo(), titulo: d.titulo || '', subtitulo: d.subtitulo || '', autores: d.autores || [], organizadores: d.organizadores || [], situacao: d.situacao || 'em produção', serie: d.serie || '', idioma: d.idioma || 'pt-BR', cdd: d.cdd || '', cdu: d.cdu || '', assuntos: d.assuntos || [], sinopse: d.sinopse || '', obs: d.obs || '', criada: hoje(), edicoes: [novaEdicao(1)] };
}
function proximaVersao(ed, tipo) {
  var prep = ed.versoes.filter(function (x) { return x.tipo === 'preparacao'; }), pub = ed.versoes.filter(function (x) { return x.tipo !== 'preparacao'; });
  if (tipo === 'preparacao') return ed.n + '.0-p' + (prep.length + 1);
  if (!pub.length) return ed.n + '.0';
  var ult = pub[pub.length - 1].v.split('.'), menor = +ult[1] || 0;
  return ed.n + '.' + (menor + 1);
}
async function criarVersao(o, ed, tipo, notas, responsavel, arquivos) {
  var v = { v: proximaVersao(ed, tipo), data: hoje(), tipo: tipo, notas: notas || '', responsavel: responsavel || '', arquivos: [], vigente: true };
  for (var i = 0; i < arquivos.length; i++) v.arquivos.push(await guardarArquivo(arquivos[i].bytes, arquivos[i].nome, arquivos[i].formato));
  ed.versoes.forEach(function (x) { x.vigente = false; });
  ed.versoes.push(v);
  log('nova versão ' + v.v, o.id, (TIPOS_VERSAO.find(function (t) { return t[0] === tipo; }) || [0, tipo])[1] + (v.arquivos.length ? '; ' + v.arquivos.map(function (a) { return a.nome; }).join(', ') : ''));
  return v;
}

/* ───────── ações ───────── */
async function clique(e) {
  var b = e.target.closest('[data-ac]'); if (!b || b.tagName === 'INPUT') return;
  var ac = b.getAttribute('data-ac'); if (ac === 'baixar' || b.tagName === 'A') e.preventDefault();
  try { await acao(ac, b); } catch (er) { msg(er.message, 'err'); }
}
async function acao(ac, b) {
  var n = +b.getAttribute('data-n'), o = obraPorId(st.obraId), ed = o && n ? o.edicoes.find(function (x) { return x.n === n; }) : null;
  switch (ac) {
    case 'abrir': return abrir();
    case 'criar': return criar();
    case 'vista': st.vista = b.getAttribute('data-v'); return desenhar();
    case 'ver': st.obraId = b.getAttribute('data-id'); st.vista = 'obra'; return desenhar();
    case 'reproteger': return dialogo('Reproteger o acervo', '<label>Senha anterior do ADM<input type="password" data-k="ant" autocomplete="off"></label>', async function (v) {
      var k = await desembrulhar(st.envelope.chave, v.ant); if (!k) throw new Error('A senha anterior não abre o acervo.');
      st.chave = k; st.cat = JSON.parse(new TextDecoder().decode(await decifrar(deB64(st.envelope.dados))));
      var r = await ghLerJson(CAT); st.sha = r && r.sha; st._rewrap = true; log('acervo reprotegido com a senha atual', '', ''); await salvar('Acervo: nova proteção'); desenhar();
    });
    case 'nova-obra': return dialogo('Novo título', campoF('Título', 'titulo', '') + campoF('Subtítulo', 'subtitulo', '') + campoF('Autores (um por linha)', 'autores', '', 'area') + campoF('Situação', 'situacao', 'em produção', 'sel', SITUACOES), async function (v) {
      if (!v.titulo.trim()) throw new Error('Informe o título.');
      var x = novaObra({ titulo: v.titulo.trim(), subtitulo: v.subtitulo.trim(), autores: linhas(v.autores), situacao: v.situacao });
      st.cat.obras.push(x); log('novo título', x.id, x.titulo); await salvar('Acervo: novo título ' + x.id); st.obraId = x.id; st.vista = 'obra'; desenhar();
    });
    case 'salvar-obra': {
      var f = lerForm('[data-form="obra"]'), antes = o.situacao;
      o.titulo = f.titulo; o.subtitulo = f.subtitulo; o.autores = linhas(f.autores); o.organizadores = linhas(f.organizadores); o.situacao = f.situacao; o.serie = f.serie; o.idioma = f.idioma; o.cdd = f.cdd; o.cdu = f.cdu; o.assuntos = linhas(f.assuntos); o.sinopse = f.sinopse; o.obs = f.obs;
      if (o.situacao === 'publicada' && antes !== 'publicada') { var e1 = edVigente(o); if (!e1.publicacao) e1.publicacao = hoje(); }
      log('dados do título' + (antes !== o.situacao ? '; situação: ' + antes + ' → ' + o.situacao : ''), o.id, ''); await salvar('Acervo: ' + o.id); return desenhar();
    }
    case 'salvar-ed': {
      var g = lerForm('[data-form="ed"][data-n="' + n + '"]');
      FORMATOS.forEach(function (fm) {
        var novo = isbnL(g['isbn_' + fm[0]]), atual = ed.formatos[fm[0]] && ed.formatos[fm[0]].isbn || '';
        if (novo === atual) return;
        if (atual) { var u = isbnUso(atual); if (u) { u.situacao = 'livre'; delete u.obra; delete u.edicao; delete u.formato; } }
        if (novo) { registrarIsbn(novo, o.id, ed.n, fm[1]); ed.formatos[fm[0]] = ed.formatos[fm[0]] || {}; ed.formatos[fm[0]].isbn = novo; log('ISBN atribuído', o.id, isbnFmt(novo) + ' · ' + ord(ed.n) + ' ed. · ' + fm[1]); }
        else if (ed.formatos[fm[0]]) delete ed.formatos[fm[0]].isbn;
      });
      ed.rotulo = g.rotulo; ed.ano = g.ano; ed.publicacao = g.publicacao; ed.aprovacao = { data: g.aprovacaoData, ato: g.aprovacaoAto }; ed.depositoLegal = { data: g.depData, protocolo: g.depProt }; ed.direitos = g.direitos; ed.preco = g.preco; ed.notas = g.notas;
      ed.formatos.impresso = ed.formatos.impresso || {}; ed.formatos.impresso.tiragem = g.tiragem;
      log('dados da ' + ord(ed.n) + ' edição', o.id, ''); await salvar('Acervo: ' + o.id + ' ed. ' + ed.n); return desenhar();
    }
    case 'isbn-livre': {
      var fm = FORMATOS.find(function (f) { return !(ed.formatos[f[0]] && ed.formatos[f[0]].isbn) && f[0] !== 'impresso'; }); if (!fm) throw new Error('Todos os formatos digitais já têm ISBN.');
      var inp = st.raiz.querySelector('[data-form="ed"][data-n="' + n + '"] [data-k="isbn_' + fm[0] + '"]'); inp.value = isbnFmt(proximoIsbnLivre()); inp.focus();
      return msg('ISBN livre colocado no campo ' + fm[1] + '. Confira e clique em “Salvar edição”.', 'ok');
    }
    case 'nova-edicao': return dialogo('Nova edição de ' + o.titulo, '<p class="mut" style="grid-column:1/-1">Nova edição é obra com conteúdo alterado (revista, ampliada, atualizada). Exige novo ISBN para cada formato e nova aprovação do conselho. Para corrigir erros sem mudar o conteúdo, use “Nova versão” na edição vigente.</p>' + campoF('Designação', 'rotulo', 'revista e ampliada') + campoF('Notas', 'notas', '', 'area'), async function (v) {
      var x = novaEdicao(edVigente(o).n + 1, edVigente(o).n); x.rotulo = v.rotulo; x.notas = v.notas; o.edicoes.push(x); o.situacao = 'em produção';
      log('nova edição', o.id, ord(x.n) + ' edição ' + x.rotulo); await salvar('Acervo: ' + o.id + ' nova edição'); desenhar();
    });
    case 'nova-versao': return dialogo('Nova versão da ' + ord(ed.n) + ' edição', campoF('Tipo', 'tipo', ed.versoes.length ? 'Correção (sem mudança de conteúdo)' : 'Lançamento da edição', 'sel', TIPOS_VERSAO.map(function (t) { return t[1]; })) + campoF('O que mudou', 'notas', '', 'area') + campoF('Responsável', 'resp', '') + '<label>Arquivos (EPUB, PDF, HTML, projeto .json, relatório, capa…)<input type="file" multiple data-k="arqs"></label>', async function (v) {
      var tipo = TIPOS_VERSAO.find(function (t) { return t[1] === v.tipo; })[0], arqs = await lerArquivos(v.arqs);
      var nv = await criarVersao(o, ed, tipo, v.notas, v.resp, arqs); await salvar('Acervo: ' + o.id + ' versão ' + nv.v); desenhar(); msg('Versão ' + nv.v + ' registrada com ' + nv.arquivos.length + ' arquivo(s).', 'ok');
    });
    case 'mais-arq': return dialogo('Incluir arquivo na versão ' + b.getAttribute('data-v'), '<label>Arquivos<input type="file" multiple data-k="arqs"></label>', async function (v) {
      var ver = ed.versoes.find(function (x) { return x.v === b.getAttribute('data-v'); }), arqs = await lerArquivos(v.arqs);
      for (var i = 0; i < arqs.length; i++) ver.arquivos.push(await guardarArquivo(arqs[i].bytes, arqs[i].nome));
      log('arquivo incluído na versão ' + ver.v, o.id, arqs.map(function (a) { return a.nome; }).join(', ')); await salvar('Acervo: ' + o.id + ' arquivos'); desenhar();
    });
    case 'vigente': { ed.versoes.forEach(function (x) { x.vigente = x.v === b.getAttribute('data-v'); }); log('versão vigente: ' + b.getAttribute('data-v'), o.id, ''); await salvar('Acervo: ' + o.id + ' versão vigente'); return desenhar(); }
    case 'baixar': { var a = acharArquivo(b.getAttribute('data-arq')); if (a) return baixarArquivo(a); return; }
    case 'abrir-motor': {
      var ar = acharArquivo(b.getAttribute('data-arq'));
      var u = await decifrar(await ghLerBytes(ARQ + ar.id + '.bin')), pj = JSON.parse(new TextDecoder().decode(u));
      if (!pj.obra) throw new Error('Este arquivo não é um projeto do motor.');
      I().setObra(pj.obra); msg('Projeto aberto no motor. Vá à aba Produção e envie o mesmo manuscrito para regerar.', 'ok'); return;
    }
    case 'doc-novo': return dialogo('Arquivar documento', formDoc(), async function (v) {
      var d = lerDocForm(v, { id: idAleatorio(), arquivado: hoje(), arquivos: [] }), arqs = await lerArquivos(v.arqs);
      for (var i = 0; i < arqs.length; i++) d.arquivos.push(await guardarArquivo(arqs[i].bytes, arqs[i].nome, 'Documento'));
      var feito = await aplicarDoc(d); st.cat.documentos.push(d);
      log('documento arquivado', d.obra, nomeTipoDoc(d.tipo) + ': ' + d.titulo + (feito.length ? ' → ' + feito.join('; ') : ''));
      await salvar('Acervo: documento ' + nomeTipoDoc(d.tipo)); desenhar(); msg('Documento arquivado' + (feito.length ? ': ' + feito.join('; ') : '') + '.', 'ok');
    });
    case 'doc-editar': { var de = st.cat.documentos.find(function (x) { return x.id === b.getAttribute('data-d'); });
      return dialogo('Editar documento', formDoc(de), async function (v) { lerDocForm(v, de); var feito = await aplicarDoc(de); log('documento alterado', de.obra, de.titulo + (feito.length ? ' → ' + feito.join('; ') : '')); await salvar('Acervo: documento alterado'); desenhar(); }); }
    case 'doc-arq': { var da = st.cat.documentos.find(function (x) { return x.id === b.getAttribute('data-d'); });
      return dialogo('Incluir arquivo em: ' + da.titulo, '<label>Arquivos<input type="file" multiple data-k="arqs"></label>', async function (v) { var arqs = await lerArquivos(v.arqs); for (var i = 0; i < arqs.length; i++) da.arquivos.push(await guardarArquivo(arqs[i].bytes, arqs[i].nome, 'Documento')); log('arquivo incluído em documento', da.obra, da.titulo); await salvar('Acervo: documento'); desenhar(); }); }
    case 'emitir': return emitir(o, ed);
    case 'ver-senha': { var xs = ed.exemplares.find(function (y) { return String(y.n) === b.getAttribute('data-x'); }); log('senha consultada', o.id, ord(ed.n) + ' ed. nº ' + n3(xs.n)); salvar('Acervo: consulta de senha').catch(function () {});
      return dialogo('Senha do exemplar nº ' + n3(xs.n), '<p style="grid-column:1/-1">' + esc(xs.destinatario) + '</p><label>Senha de leitura<input type="text" readonly value="' + esc(xs.senha) + '" onclick="this.select()"></label><p class="mut" style="grid-column:1/-1">A consulta fica registrada no histórico.</p>', function () {}); }
    case 'reg-senha': return dialogo('Registrar a senha do exemplar nº ' + n3(b.getAttribute('data-x')), '<label>Senha de leitura<input type="text" data-k="senha" autocomplete="off"></label>', async function (v) {
      var xr = ed.exemplares.find(function (y) { return String(y.n) === b.getAttribute('data-x'); }); if ((v.senha || '').length < 8) throw new Error('Senha muito curta.');
      xr.senha = v.senha; log('senha registrada', o.id, ord(ed.n) + ' ed. nº ' + n3(xr.n)); await salvar('Acervo: senha de exemplar'); desenhar();
    });
    case 'carregar-motor': await carregarNoMotor(o, ed); return msg('Livro carregado no motor (aba Produção). Agora é possível emitir exemplares em HTML.', 'ok');
    case 'cancelar-ex': return dialogo('Cancelar exemplar nº ' + n3(b.getAttribute('data-x')), '<p class="mut" style="grid-column:1/-1">O número fica registrado como cancelado e nunca é reutilizado.</p>' + campoF('Motivo', 'motivo', ''), async function (v) {
      var x = ed.exemplares.find(function (y) { return String(y.n) === b.getAttribute('data-x'); }); x.situacao = 'cancelado'; x.motivo = v.motivo; x.cancelado = hoje();
      log('exemplar cancelado', o.id, ord(ed.n) + ' ed. nº ' + n3(x.n) + (v.motivo ? ': ' + v.motivo : '')); await salvar('Acervo: exemplar cancelado'); desenhar();
    });
    case 'registrar-motor': return registrarMotor(n ? o : null, ed);
    case 'isbn-incluir': {
      var novos = linhas(st.raiz.querySelector('[data-isbn-novos]').value), ok = 0, erros = [];
      st.cat.editora.prefixoIsbn = (st.raiz.querySelector('[data-k="prefixo"]') || {}).value || st.cat.editora.prefixoIsbn;
      novos.forEach(function (s) { var d = isbnL(s); if (!isbnOk(d)) erros.push(s + ' (dígito verificador)'); else if (isbnUso(d)) erros.push(isbnFmt(d) + ' (já está no controle)'); else { st.cat.isbns.push({ isbn: d, situacao: 'livre', data: hoje() }); ok++; } });
      if (ok) { log('ISBN incluídos no lote', '', ok + ' número(s)'); await salvar('Acervo: lote de ISBN'); }
      desenhar(); return msg(ok + ' ISBN incluído(s).' + (erros.length ? ' Recusados: ' + erros.join('; ') : ''), erros.length ? 'err' : 'ok');
    }
    case 'isbn-cancelar': { var u2 = isbnUso(b.getAttribute('data-i')); if (!confirm('Cancelar o ISBN ' + isbnFmt(u2.isbn) + '? Ele não poderá mais ser usado.')) return; u2.situacao = 'cancelado'; log('ISBN cancelado', '', isbnFmt(u2.isbn)); await salvar('Acervo: ISBN cancelado'); return desenhar(); }
    case 'salvar-num': { var g2 = lerForm('[data-form="numeracao"]'); st.cat.editora.sigla = (g2.sigla || 'ECET').toUpperCase(); st.cat.editora.proximoCodigo = Math.max(+g2.proximoCodigo || 1, 1); log('numeração dos títulos', '', st.cat.editora.sigla + ', próximo ' + st.cat.editora.proximoCodigo); await salvar('Acervo: numeração'); return desenhar(); }
    case 'importar': { var inp2 = st.raiz.querySelector('[data-ac-arq]'); inp2.accept = '.zip'; inp2.multiple = false; inp2.onchange = function () { if (inp2.files[0]) importar(inp2.files[0]).catch(function (er) { msg('Importação falhou: ' + er.message, 'err'); }); inp2.value = ''; }; return inp2.click(); }
    case 'csv-cat': return csv('catalogo-acervo.csv', [['Código', 'Título', 'Subtítulo', 'Autores', 'Situação', 'Edição vigente', 'Versão vigente', 'ISBN EPUB', 'ISBN PDF', 'ISBN HTML', 'ISBN impresso', 'Publicação', 'Depósito legal', 'Exemplares ativos']].concat(st.cat.obras.map(function (x) { var e = edVigente(x), v = e && verVigente(e), F = e ? e.formatos : {}; return [x.id, x.titulo, x.subtitulo, (x.autores || []).join('; '), x.situacao, e ? ord(e.n) : '', v ? v.v : '', isb(F.epub), isb(F.pdf), isb(F.html), isb(F.impresso), e ? e.publicacao : '', e && e.depositoLegal ? e.depositoLegal.data : '', e ? e.exemplares.filter(function (y) { return y.situacao !== 'cancelado'; }).length : 0]; })));
    case 'csv-ex': return csv('exemplares-acervo.csv', [['Código', 'Título', 'Edição', 'Nº', 'Destinatário', 'Contato', 'Finalidade', 'Formato', 'Versão', 'Data', 'Situação', 'Motivo do cancelamento']].concat(todosEx().map(function (e) { return [e.o.id, e.o.titulo, ord(e.ed.n), n3(e.x.n), e.x.destinatario, e.x.contato || '', e.x.finalidade || '', e.x.formato || '', e.x.versao || '', e.x.data, e.x.situacao || 'ativo', e.x.motivo || '']; })));
    case 'csv-isbn': return csv('isbn-acervo.csv', [['ISBN', 'Situação', 'Código', 'Edição', 'Formato', 'Data']].concat(st.cat.isbns.map(function (x) { return [isbnFmt(x.isbn), x.situacao, x.obra || '', x.edicao ? ord(x.edicao) : '', x.formato || '', x.atribuido || x.data]; })));
    case 'json-cat': return baixar(new Blob([JSON.stringify(st.cat, null, 2)], { type: 'application/json' }), 'catalogo-acervo-' + hoje() + '.json');
    case 'ficha-csv': return csv(slug(o.titulo) + '-ficha.csv', [['Campo', 'Valor']].concat([['Código', o.id], ['Título', o.titulo], ['Subtítulo', o.subtitulo], ['Autores', (o.autores || []).join('; ')], ['Situação', o.situacao], ['CDD', o.cdd], ['CDU', o.cdu], ['Assuntos', (o.assuntos || []).join('; ')]]).concat(o.edicoes.map(function (e) { return [ord(e.n) + ' edição', [e.rotulo, e.ano, 'EPUB ' + isb(e.formatos.epub), 'PDF ' + isb(e.formatos.pdf), 'versões: ' + e.versoes.map(function (v) { return v.v; }).join(', '), 'exemplares: ' + e.exemplares.length].join(' | ')]; })));
  }
}
function isb(f) { return f && f.isbn ? isbnFmt(f.isbn) : ''; }
function acharArquivo(id) { var r = null; (st.cat.documentos || []).forEach(function (d) { (d.arquivos || []).forEach(function (a) { if (a.id === id) r = a; }); }); st.cat.obras.forEach(function (o) { o.edicoes.forEach(function (ed) { ed.versoes.forEach(function (v) { v.arquivos.forEach(function (a) { if (a.id === id) r = a; }); }); ed.exemplares.forEach(function (x) { if (x.arquivo && x.arquivo.id === id) r = x.arquivo; }); }); }); return r; }
function csv(nome, linhasCsv) { var t = '﻿' + linhasCsv.map(function (l) { return l.map(function (c) { c = String(c == null ? '' : c); return /[";\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; }).join(';'); }).join('\r\n'); baixar(new Blob([t], { type: 'text/csv;charset=utf-8' }), nome); }

/* emissão de exemplar numerado: o livro arquivado (projeto + manuscrito da versão) é carregado no motor e o HTML
   numerado e protegido por senha é gerado; a senha fica guardada no catálogo cifrado */
function gerarSenha() { var A = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789', r = crypto.getRandomValues(new Uint8Array(12)), t = ''; for (var i = 0; i < 12; i++) t += A[r[i] % A.length] + (i % 4 === 3 && i < 11 ? '-' : ''); return t; }
function fonteMotor(ed) {
  var vs = ed.versoes.slice().sort(function (a, b) { return (b.vigente ? 1 : 0) - (a.vigente ? 1 : 0); });
  for (var i = 0; i < vs.length; i++) {
    var pj = vs[i].arquivos.find(function (a) { return a.formato === 'Projeto'; }), ms = vs[i].arquivos.find(function (a) { return a.formato === 'Manuscrito' || /\.(docx|doc|odt|rtf)$/i.test(a.nome); });
    if (pj && ms) return { versao: vs[i], projeto: pj, manuscrito: ms };
  }
  return null;
}
function livroNoMotor(o, ed) {
  var mot = I() && I().estado; if (!mot || !mot.livro || mot.rodando) return false;
  if (st.motorObra === o.id + '|' + ed.n) return true;
  var t = I().obra && I().obra().titulo; return !!(t && t.trim().toLowerCase() === o.titulo.trim().toLowerCase());
}
async function carregarNoMotor(o, ed) {
  var f = fonteMotor(ed); if (!f) throw new Error('Esta edição não tem projeto (.json) e manuscrito arquivados numa mesma versão. Inclua-os com “＋ arquivo”.');
  msg('Carregando o livro arquivado no motor (versão ' + f.versao.v + '); pode levar alguns minutos…');
  var pj = JSON.parse(new TextDecoder().decode(await decifrar(await ghLerBytes(ARQ + f.projeto.id + '.bin'))));
  var ms = await decifrar(await ghLerBytes(ARQ + f.manuscrito.id + '.bin'));
  var ob = pj.obra || pj; ob.revisaoIA = false; // a emissão reproduz o texto aprovado, sem nova revisão
  I().setObra(ob);
  await I().receberArquivo(new File([ms], ob._arquivo || f.manuscrito.nome));
  if (!I().estado.livro) throw new Error('o motor não conseguiu montar o livro; veja a aba Produção');
  st.motorObra = o.id + '|' + ed.n;
}
function emitir(o, ed) {
  var noMotor = livroNoMotor(o, ed), fonte = fonteMotor(ed), v = verVigente(ed);
  var opHtml = noMotor ? 'HTML de leitura com senha (livro já aberto no motor)' : fonte ? 'HTML de leitura com senha (carrega o livro arquivado)' : '';
  dialogo('Emitir exemplar nº ' + n3(proxEx(ed)) + ' · ' + ord(ed.n) + ' edição', campoF('Destinatário (pessoa ou instituição)', 'dest', '') + campoF('Contato (e-mail ou telefone)', 'contato', '') + campoF('Finalidade', 'fin', 'doação', 'sel', FINALIDADES) +
    campoF('Formato', 'formato', opHtml || 'Registro apenas', 'sel', (opHtml ? [opHtml] : []).concat(['Registro apenas', 'EPUB', 'PDF', 'Impresso'])) +
    campoF('Senha de leitura (gerada; pode trocar, mínimo 8 caracteres)', 'senha', gerarSenha()) + campoF('Observação', 'obs', '') +
    (opHtml ? '<p class="mut" style="grid-column:1/-1">A senha fica guardada no acervo (cifrado), no registro do exemplar. Envie-a ao destinatário por um canal diferente do arquivo.</p>' : '<p class="mut" style="grid-column:1/-1">Para gerar o HTML numerado e protegido, arquive na versão o projeto (.json) e o manuscrito, ou abra o livro no motor. Sem isso, o número é reservado e registrado.</p>'), async function (val) {
    if (!val.dest.trim()) throw new Error('Informe o destinatário.');
    var html = /^HTML/.test(val.formato);
    if (html && (val.senha || '').length < 8) throw new Error('Senha muito curta: use ao menos 8 caracteres.');
    if (html && !livroNoMotor(o, ed)) await carregarNoMotor(o, ed);
    var r = await ghLerJson(CAT);
    if (r && r.sha !== st.sha) { await abrir(); o = obraPorId(o.id); ed = o.edicoes.find(function (x) { return x.n === ed.n; }); }
    var num = proxEx(ed), x = { n: num, destinatario: val.dest.trim(), contato: val.contato.trim(), finalidade: val.fin, formato: html ? 'HTML' : val.formato, versao: v ? v.v : '', data: hoje(), situacao: 'ativo', obs: val.obs };
    if (html) {
      msg('Gerando o exemplar nº ' + n3(num) + '…');
      var mot = I().estado, ob = I().obra(); ob.exemplares = (ob.exemplares || []).concat([{ n: num, destinatario: x.destinatario, data: x.data }]);
      var h = await I().htmlLeitura(mot.livro, mot.logos, ob, { exemplar: num, destinatario: x.destinatario, senha: val.senha });
      var nome = slug(o.titulo) + '-' + ed.n + 'ed-exemplar-' + n3(num) + '.html', bytes = new TextEncoder().encode(h);
      x.arquivo = await guardarArquivo(bytes, nome, 'HTML'); x.senha = val.senha;
      baixar(new Blob([bytes], { type: 'text/html' }), nome);
    }
    ed.exemplares.push(x);
    log('exemplar emitido', o.id, ord(ed.n) + ' ed. nº ' + n3(num) + ' · ' + x.destinatario + ' · ' + x.finalidade + ' · ' + x.formato);
    await salvar('Acervo: exemplar ' + o.id + ' ' + ed.n + 'ed nº ' + n3(num)); desenhar();
    msg('Exemplar nº ' + n3(num) + ' registrado para ' + x.destinatario + (x.arquivo ? '. Senha guardada no registro (🔑). Envie-a por um canal diferente do arquivo.' : '.'), 'ok');
  });
}
function emitirPorTitulo(titulo) {
  var o = st.cat && st.cat.obras.find(function (x) { return x.titulo.trim().toLowerCase() === String(titulo || '').trim().toLowerCase(); });
  if (!o) return false; st.obraId = o.id; st.vista = 'obra'; desenhar(); emitir(o, edVigente(o)); return true;
}

/* registrar o livro gerado no motor como nova versão (ou novo título) */
async function registrarMotor(o, ed) {
  var M = I(), mot = M.estado, ob = M.obra();
  if (!mot || !mot.epub) throw new Error('Gere primeiro o livro na aba Produção.');
  if (!o) {
    o = st.cat.obras.find(function (x) { return x.titulo.trim().toLowerCase() === String(ob.titulo || '').trim().toLowerCase(); });
    if (!o) { o = novaObra({ titulo: ob.titulo, subtitulo: ob.subtitulo, autores: linhas(ob.autores).map(function (l) { return l.split(';')[0].trim(); }), cdd: ob.cdd, cdu: ob.cdu, assuntos: linhas(ob.assuntos), sinopse: ob.sinopse, serie: ob.serie }); st.cat.obras.push(o); log('novo título (do motor)', o.id, o.titulo); }
    ed = o.edicoes.find(function (x) { return String(x.n) === String(ob.edicao || 1); }) || edVigente(o);
  }
  [['epub', ob.isbn], ['html', ob.isbnHtml], ['impresso', ob.isbnImpresso]].forEach(function (p) { if (p[1] && isbnOk(p[1]) && !(ed.formatos[p[0]] && ed.formatos[p[0]].isbn)) { registrarIsbn(p[1], o.id, ed.n, FORMATOS.find(function (f) { return f[0] === p[0]; })[1]); ed.formatos[p[0]] = ed.formatos[p[0]] || {}; ed.formatos[p[0]].isbn = isbnL(p[1]); } });
  var base = slug(o.titulo), arqs = [{ nome: base + '.epub', bytes: new Uint8Array(await mot.epub.arrayBuffer()), formato: 'EPUB' }];
  if (mot.relatorio) arqs.push({ nome: 'auditoria-' + base + '.html', bytes: new TextEncoder().encode(mot.relatorio), formato: 'Relatório' });
  arqs.push({ nome: 'projeto-' + base + '.json', bytes: new TextEncoder().encode(JSON.stringify({ tipo: 'projeto-editora-cacique-enir-terena', versao: M.versao || '1.0', salvo: new Date().toISOString(), obra: ob })), formato: 'Projeto' });
  var nv = await criarVersao(o, ed, ed.versoes.length ? 'correcao' : 'lancamento', 'Gerada pelo motor editorial' + (mot.arquivo && mot.arquivo.name ? ' a partir de ' + mot.arquivo.name : ''), '', arqs);
  await salvar('Acervo: ' + o.id + ' versão ' + nv.v + ' (motor)');
  st.obraId = o.id; st.vista = 'obra'; desenhar(); msg('Versão ' + nv.v + ' de “' + o.titulo + '” registrada com EPUB, relatório e projeto. O PDF para impressão pode ser incluído em “＋ arquivo”.', 'ok');
}

/* pacote .zip: acervo.json + arquivos */
async function importar(file) {
  if (!window.JSZip && I().libs) await I().libs();
  var z = await window.JSZip.loadAsync(await file.arrayBuffer()), man = z.file('acervo.json');
  if (!man) throw new Error('o pacote não tem acervo.json');
  var d = JSON.parse(await man.async('string')), t = d.titulo;
  if (!st.cat.documentos) st.cat.documentos = [];
  if (!t) { var nd = await importarDocs(z, d.documentos || [], null); await salvar('Acervo: importação de documentos'); st.vista = 'documentos'; desenhar(); msg('Pacote importado: ' + nd + ' documento(s).', 'ok'); return; }
  var o = st.cat.obras.find(function (x) { return x.titulo.trim().toLowerCase() === t.titulo.trim().toLowerCase(); });
  if (o && !confirm('“' + t.titulo + '” já está no acervo (' + o.id + '). Incluir o pacote como nova versão desse título?')) return;
  if (!o) { o = novaObra(t); o.edicoes = []; st.cat.obras.push(o); log('título importado', o.id, o.titulo); }
  var ei = d.edicao || {}, ed = o.edicoes.find(function (x) { return x.n === (ei.n || 1); });
  if (!ed) { ed = novaEdicao(ei.n || 1); o.edicoes.push(ed); o.edicoes.sort(function (a, b) { return a.n - b.n; }); }
  ['rotulo', 'ano', 'publicacao', 'direitos', 'preco', 'notas'].forEach(function (k) { if (ei[k]) ed[k] = ei[k]; });
  if (ei.aprovacao) ed.aprovacao = ei.aprovacao; if (ei.depositoLegal) ed.depositoLegal = ei.depositoLegal;
  Object.keys(ei.formatos || {}).forEach(function (k) { var f = ei.formatos[k]; ed.formatos[k] = ed.formatos[k] || {}; if (f.tiragem) ed.formatos[k].tiragem = f.tiragem; if (f.isbn) { registrarIsbn(f.isbn, o.id, ed.n, (FORMATOS.find(function (x) { return x[0] === k; }) || [k, k])[1]); ed.formatos[k].isbn = isbnL(f.isbn); } });
  var vi = d.versao || {}, arqs = [];
  for (var i = 0; i < (vi.arquivos || []).length; i++) { var a = vi.arquivos[i], zf = z.file(a.caminho || a.nome); if (!zf) throw new Error('arquivo ausente no pacote: ' + a.nome); arqs.push({ nome: a.nome, formato: a.formato, bytes: new Uint8Array(await zf.async('uint8array')) }); }
  var nv = await criarVersao(o, ed, vi.tipo || (ed.versoes.length ? 'correcao' : 'lancamento'), vi.notas, vi.responsavel, arqs);
  if (vi.data) nv.data = vi.data;
  (d.exemplares || []).forEach(function (x) { if (!ed.exemplares.some(function (y) { return y.n === x.n; })) { ed.exemplares.push({ n: x.n, destinatario: x.destinatario, finalidade: x.finalidade || '', formato: x.formato || '', versao: x.versao || nv.v, data: x.data, situacao: x.situacao || 'ativo', contato: x.contato || '', obs: x.obs || '', senha: x.senha || undefined }); log('exemplar importado', o.id, ord(ed.n) + ' ed. nº ' + n3(x.n) + ' · ' + x.destinatario); } });
  ed.exemplares.sort(function (a, b) { return a.n - b.n; });
  await importarDocs(z, d.documentos || [], o);
  await salvar('Acervo: importação de ' + o.id);
  st.obraId = o.id; st.vista = 'obra'; desenhar(); msg('Pacote importado: ' + o.id + ', ' + ord(ed.n) + ' edição, versão ' + nv.v + ', ' + nv.arquivos.length + ' arquivo(s).', 'ok');
}

async function importarDocs(z, lista, oPadrao) {
  var n = 0;
  for (var i = 0; i < lista.length; i++) {
    var x = lista[i], o = x.tituloObra ? st.cat.obras.find(function (y) { return y.titulo.trim().toLowerCase() === x.tituloObra.trim().toLowerCase(); }) : oPadrao;
    if (x.criarObra && !o) { o = novaObra(x.criarObra); st.cat.obras.push(o); log('título criado a partir de documento', o.id, o.titulo); }
    var d = { id: idAleatorio(), arquivado: hoje(), arquivos: [], tipo: x.tipo, titulo: x.titulo, numero: x.numero || '', data: x.data || '', emissor: x.emissor || '', obra: x.editora ? '' : (o ? o.id : ''), edicao: x.editora ? 0 : (x.edicao || (o ? 1 : 0)), isbn: isbnL(x.isbn), formato: x.formato || 'a definir', verificacao: x.verificacao || '', resumo: x.resumo || '', textoLivros: x.textoLivros || '', alerta: x.alerta || '' };
    for (var k = 0; k < (x.arquivos || []).length; k++) { var zf = z.file(x.arquivos[k]); if (!zf) throw new Error('arquivo ausente no pacote: ' + x.arquivos[k]); d.arquivos.push(await guardarArquivo(new Uint8Array(await zf.async('uint8array')), x.arquivos[k], 'Documento')); }
    var feito = await aplicarDoc(d); st.cat.documentos.push(d); n++;
    log('documento importado', d.obra, nomeTipoDoc(d.tipo) + ': ' + d.titulo + (feito.length ? ' → ' + feito.join('; ') : ''));
  }
  return n;
}
window.ACERVO_ICET = { montar: montar, emitirPorTitulo: function (t) { return emitirPorTitulo(t); }, abrir: abrir, senhaPronta: function () { if (st.raiz) abrir(); }, registrarMotor: async function () { if (!st.cat) await abrir(); if (st.cat) return registrarMotor(null, null).catch(function (e) { msg(e.message, 'err'); }); }, _st: st };
})();
