# Refúgio das Páginas

Site do clube de leitura com curadoria e mediação de Taís Rick. Site estático (GitHub Pages) com login e dados no Firebase (plano gratuito).

## O que tem

- **index.html**: área das leitoras. Entrada com usuário e senha, próximo encontro com confirmação de presença, votação do livro do mês, livro do mês com mural de comentários (com proteção de spoiler), acervo, calendário, estante e combinados.
- **admin.html**: painel da Taís. Cria acessos e gera a mensagem para o WhatsApp, gera senha nova, desativa leitoras, marca encontros, vê presenças, abre/encerra/revela votações e cuida do acervo.
- **firestore.rules**: regras de segurança. Cada leitora só vê o próprio voto; só as administradoras mudam encontros, acervo e votação.

## Como funciona o login

As leitoras entram com **usuário + senha**. Por baixo, o Firebase usa um e-mail interno (`usuario.N@refugio-das-paginas.firebaseapp.com`) que nunca recebe mensagens. Quando a Taís gera uma senha nova, o número `N` sobe e uma conta nova substitui a antiga. Por isso tudo funciona sem servidor próprio e sem custo.

## Configuração (uma vez)

1. **Regras**: Firebase → Firestore Database → Regras → cole o conteúdo de `firestore.rules` → Publicar.
2. **Contas das administradoras**: Firebase → Authentication → Usuários → Adicionar usuário:
   - Taís: e-mail `tais.1@refugio-das-paginas.firebaseapp.com` + uma senha
   - Rick: e-mail `rick.1@refugio-das-paginas.firebaseapp.com` + uma senha
   No site, elas entram com o usuário `tais` / `rick`.
3. **Publicar o site**: GitHub → Settings → Pages → Source: *Deploy from a branch* → `main` / `(root)` → Save.
4. Entrar no site como `tais` → **Painel da Taís** → aba **Acervo** → **Importar acervo inicial** (importa os 20 livros e cria o 1º encontro).

## Capas

- As 20 capas iniciais estão na pasta `capas/` deste repositório.
- Capas enviadas pelo painel (botão "Enviar imagem da capa") são reduzidas no navegador para até 300 × 450 e guardadas no Firestore, na coleção `capas` (uma ficha por livro), sem precisar do Cloud Storage. Cada capa ocupa de 20 a 40 KB.

## Especiais

Páginas sobre uma autora, um autor ou um tema, criadas pela Taís no painel (aba **Especiais**): foto, frase de abertura, "quem é", linha do tempo (uma linha por acontecimento, `ano — texto`), livros do acervo, curiosidades e links (`nome | https://…`). Ficam como rascunho até serem marcadas como publicadas. Dados na coleção `especiais`; a foto vai para `capas/esp_<id>`.

### Cadernos de leitura

Um especial pode ter o formato **Caderno de leitura**, inspirado nos cadernos da Taís: abertura com o título e uma imagem, a coleção de livros (capas, estrelas e situação), a ficha de cada livro (título, autor, editora, publicação, páginas, início, término, avaliação e resumo, com `==marca-texto==`) e as reflexões das leitoras. Cada livro pode ter capa e ilustração próprias; sem elas, o site desenha uma capa provisória. A ficha e as reflexões geram imagens para redes sociais (post 4:5 ou story 9:16) com legenda pronta.

Há dois temas visuais: **Noite estrelada** (moldura escura com estrelas douradas, etiquetas de colagem) e **Campo florido** (aquarela rosa, fita kraft, moldura vermelha). No painel: **Especiais → formato Caderno**, e o botão **Livros** abre a lista, a entrada de títulos em lote e a ficha de cada livro. O botão **Criar os cadernos** importa os cadernos *Byung-Chul Han* (27 livros) e *Anne of Green Gables* (12 livros). Dados nas coleções `especiais` e `cadernoLivros` (com a subcoleção `reflexoes`); capas em `capas/cl_<livro>` e ilustrações em `capas/cli_<livro>`.

## Registro dos encontros (Memórias)

No painel, **Encontros → Registro** abre o registro de um encontro: apresentação (um parágrafo por linha), frase da noite, nota média e até **24 fotos**, enviadas de uma vez pela galeria do celular. Cada foto é reduzida no navegador em duas versões: uma miniatura (até 480 px, ~30–60 KB) na coleção `fotos` e uma versão grande (até 1600 px, até ~350 KB) na coleção `fotosGrandes`, carregada só quando alguém amplia a foto. O total usado fica em `config/armazenamento` e aparece no topo do painel. Registros marcados como **Publicado** aparecem para as leitoras na seção **Nossos encontros** (menu **Memórias**). Apagar um encontro apaga também o registro e as fotos dele.

## Cópia de segurança

No topo do painel há dois botões. **Cópia dos dados** gera um arquivo `.json` leve com os dados do clube (leitoras, acervo, capas enviadas, encontros, presenças, comentários, especiais, registros, a lista das fotos, configuração e os votos da votação atual). **Cópia das fotos (.zip)** baixa todas as fotos dos encontros em tamanho grande, uma pasta por encontro, com as legendas; no registro de cada encontro também dá para baixar só as fotos dele. Senhas não entram: ficam só no Firebase Authentication. O painel avisa quando a última cópia tem mais de 35 dias. Guarde os arquivos num lugar privado.

## Administradoras

A lista fica em dois lugares, que precisam bater: `ADMINS` em `js/firebase.js` e `isAdmin()` em `firestore.rules`.
Qualquer pessoa (leitora ou administradora) troca a própria senha pelo link **Trocar senha**, no topo do site ou no menu do celular, confirmando a senha atual.
Se uma administradora **esquecer** a senha, apague a conta dela em Authentication e crie de novo com o mesmo e-mail; ao entrar, o site atualiza o cadastro sozinho. Leitoras que esquecem a senha recebem uma nova pelo painel (**Leitoras → Nova senha**).

## Versões e cache

O GitHub Pages deixa os arquivos guardados no navegador por até 10 minutos. Para que uma atualização nunca misture arquivos novos com antigos, todos os `import` entre os arquivos de `js/` e os links em `index.html` e `admin.html` levam a mesma marca de versão (`?v=...`). **A cada publicação, troque a marca em todos os lugares de uma vez** (a mesma em todos os arquivos, senão o Firebase é carregado duas vezes). Se o código não carregar, a página mostra um aviso pedindo para recarregar.
