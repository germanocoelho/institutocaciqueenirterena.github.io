# Motor editorial digital — Editora Cacique Enir Terena

Painel no ADM do site do ICET (seção “Editora Cacique Enir Terena”, visível após a senha do ADM).

## Como usar
1. **Editora e conselho**: cadastre uma vez o conselho editorial, a equipe e o(a) bibliotecário(a) com CRB. Clique em “Salvar na nuvem”.
2. **Logomarcas**: envie os arquivos oficiais do IFMS e do MPMS, confira ICET, CMDDI e FOCAMS e marque “uso autorizado” em cada marca.
3. **Produção**: arraste o manuscrito (.docx, .odt, .md, .txt ou .html). O motor faz tudo sozinho e mostra cada etapa.
4. **Dados da obra**: complete ISBN do e-book, CDD/CDU, assuntos e o que faltar. Depois clique em “Aplicar e regerar”.
5. Baixe o **EPUB**, o **relatório de auditoria** e, se quiser, o **PDF para impressão**.

## O que o motor faz
- Lê Word, LibreOffice, Markdown, texto e HTML, com notas de rodapé, imagens e tabelas.
- Monta capa, falsa folha de rosto, folha de rosto, créditos com conselho editorial, ficha catalográfica (CIP), listas, sumário, colofão e índice remissivo.
- Aplica a NBR 6029 (estrutura), a 6027 (sumário), a 6024 (numeração progressiva), a 10520 (citações e notas), a 6023 (referências) e a 6034 (índice).
- Normaliza a tipografia: aspas, travessões, reticências, intervalos e espaços.
- Gera EPUB 3 acessível (metadados EPUB Accessibility 1.1), com as fontes livres Literata e Cinzel embutidas.
- Faz a auditoria: política do selo (autoria indígena), ISBN (Lei 10.753/2003), ficha, marcas, citações × referências, acessibilidade e integridade técnica.
- Com a chave do Claude configurada no site, sugere metadados (título, sinopse, palavras-chave, termos do índice) e faz a revisão linguística. As sugestões vão para o relatório e nada é alterado no texto sem decisão humana.

## Painel de correções e projeto
- Depois de cada geração, o filtro **🛠 a corrigir** mostra só as ocorrências que têm conserto pelo próprio painel: dar título a uma tabela, corrigir ou incluir uma referência (com formatação ABNT pela IA), corrigir o ano ou a grafia de uma citação, marcar falsos alarmes como “não é citação” e aplicar sugestões da revisão linguística. Os itens de configuração levam direto ao campo ou à aba certa.
- As decisões ficam guardadas no projeto e são reaplicadas a cada geração. O manuscrito original nunca é alterado.
- **💾 Salvar projeto** baixa um arquivo `.json` com os dados da obra e todas as correções. **📂 Abrir projeto** retoma o trabalho em qualquer computador: abra o projeto e envie o mesmo manuscrito.
- O motor também faz sozinho:
  - dá destaque ao título das referências (NBR 6023) e padroniza a grafia da autoria nas citações (opção “Citações”);
  - propõe título para tabelas sem título, pela IA ou pelo cabeçalho;
  - extrai a sinopse da apresentação e as palavras-chave dos assuntos da ficha;
  - seleciona os termos do índice a partir do glossário, das siglas e dos nomes recorrentes.
  Tudo isso é sinalizado para revisão.

## Dicas para o manuscrito
- Use os estilos “Título 1/2/3” para capítulos e seções, “Citação” para citações longas e “Legenda” para títulos de figuras.
- Escreva “Figura 1 – Título” acima da imagem e “Fonte: …” abaixo; para tabelas, “Tabela 1 – Título” acima.
- Em coletâneas, logo abaixo do título de cada capítulo escreva `Autoria: Nome e Nome`.
- Para o índice, informe os termos (um por linha) em “Dados da obra”.

Bibliotecas incluídas: JSZip (MIT) e mammoth.js (BSD-2). Fontes: Literata e Cinzel (SIL OFL 1.1).

## Paginação (PDF e EPUB)

- **PDF:** o fólio (número da página) sai no rodapé, contado desde a capa, para coincidir com o número de página do leitor de PDF. Capa, falsa folha de rosto, folha de rosto, créditos, dedicatória e epígrafe não exibem fólio.
- **Sumário e listas com número de página (NBR 6027 e 6029):** o navegador não calcula a página de destino (`target-counter`), por isso a produção do PDF final é feita em dois passes:
  1. `htmlImpressao(livro, logos, obra, { reservar: true })` compõe o livro com o espaço do número já reservado. Mede-se em que página cai cada destino do sumário e das listas.
  2. `htmlImpressao(livro, logos, obra, { paginas: { alvo: página } })` compõe a versão final, com a mesma paginação.

  O botão "Gerar PDF" do painel imprime direto pelo navegador: sai com fólio, mas sem os números no sumário.
- **EPUB com paginação equivalente (EPUB 3 `page-list`, EPUB Accessibility 1.1):** cada bloco do livro tem um identificador provisório (`data-b`). A partir da página medida no PDF, `paginarEpub(epub, { bloco: página }, fonte, âncoras)` faz quatro coisas:
  - insere marcadores `doc-pagebreak` no EPUB;
  - gera a lista de páginas no `nav`;
  - declara `pageBreakMarkers` e `pageNavigation` nos metadados;
  - retira os identificadores provisórios.

  Com isso, o leitor pode ir à página N e citar o e-book pela mesma numeração do PDF.

## Marca da Editora

As três versões oficiais da marca ficam no site, em `editora/logos/`: `editora-cor.png` (colorida), `editora-pb.png` (preta) e `editora-branca.png` (branca), todas em PNG com fundo transparente. Para trocar uma versão, use a aba **Logomarcas** do painel: o arquivo novo é gravado no site e passa a valer para todos os livros.

Na mesma aba, escolha **livro a livro** onde a marca entra e qual versão usar em cada lugar. Os lugares são a folha de rosto, a falsa folha de rosto, o verso da folha de rosto (créditos), o colofão, a capa gerada pela Editora, a capa enviada pelos autores (como carimbo) e a tela de senha do HTML de leitura. Para cada lugar há cinco opções: Automática, Colorida, Preta, Branca ou Não usar.

- **Automática:** o motor mede o brilho do fundo. Sobre fundo escuro usa a branca. Sobre fundo claro usa a colorida na folha de rosto e nas capas, e a preta nas páginas internas.
- **Modo noturno do EPUB:** nos leitores em modo noturno, a marca troca sozinha para a versão branca.
- **PDF e HTML de leitura:** a página é sempre clara, então sai sempre a versão escolhida para fundo claro.
- **Carimbo na capa dos autores:** fica desligado por padrão. Quando ligado, o motor procura a área mais calma da capa (no topo, no rodapé ou em qualquer dos dois) para não cobrir título, nomes ou ilustração. Confira o resultado na prévia antes de publicar.
- **Padrão para novos livros:** o botão **Usar estas escolhas como padrão para novos livros** guarda a combinação atual. Cada livro novo começa com ela.
- **Testar sobre a cor:** mostra qual versão a escolha automática usaria sobre qualquer cor.

## HTML de leitura e cópias controladas

O botão **"HTML de leitura (cópia controlada)"** gera um arquivo único que abre em qualquer navegador, sem instalar nada e sem internet: fontes, imagens e ornamentos vêm embutidos.

- **Sem destinatário:** cópia de leitura simples, identificada pelo ISBN.
- **Com destinatário:** exemplar numerado e nominal. O número e o nome aparecem em todas as telas, e o conteúdo vai cifrado (AES-GCM 256, chave derivada da senha por PBKDF2-SHA-256 com 310 mil iterações). Sem a senha o texto não pode ser lido nem copiado do arquivo.
- **Registro:** cada exemplar entra no projeto (`obra.exemplares`) e no relatório de auditoria.
- **Senha:** envie-a à pessoa por um canal diferente do arquivo.
- **ISBN:** cada formato distribuído separadamente tem ISBN próprio (ISO 2108). Enquanto a versão HTML não tiver número registrado na Agência Brasileira do ISBN, o arquivo se identifica como cópia de leitura da edição em EPUB. Ao registrar, informe o número em "ISBN da versão HTML", na aba "Dados da obra".
