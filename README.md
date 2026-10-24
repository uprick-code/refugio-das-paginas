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

## Cópia de segurança

No topo do painel, o botão **Baixar cópia de segurança** gera um arquivo `.json` com todos os dados do clube (leitoras, acervo, capas enviadas, encontros, presenças, comentários, especiais, configuração e os votos da votação atual). Senhas não entram: ficam só no Firebase Authentication. O painel avisa quando a última cópia tem mais de 35 dias. Guarde os arquivos num lugar privado.

## Administradoras

A lista fica em dois lugares, que precisam bater: `ADMINS` em `js/firebase.js` e `isAdmin()` em `firestore.rules`.
Para trocar a senha de uma administradora, apague a conta dela em Authentication e crie de novo com o mesmo e-mail; ao entrar, o site atualiza o cadastro sozinho.
