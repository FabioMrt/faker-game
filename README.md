# FAKER
**Um de vocês não sabe.**

Jogo presencial de palavras, blefe e dedução feito com Next.js, React e TypeScript. Um celular passa entre os jogadores.
## Rodar
- npm install
- npm run dev
- Abra http://localhost:3000
## Verificar
- npm test
- npm run build
O projeto usa a configuração padrão do Next.js e pode ser importado diretamente na Vercel, sem variáveis de ambiente ou ajustes de build.
## Regras
De 3 a 20 participantes; tema escolhido pelo grupo; exatamente um impostor.
Cada palavra tem três dicas de uma palavra. Apenas uma é sorteada para o impostor.
A ordem muda a cada rodada. A palavra anterior não se repete imediatamente.
Soltar o botão, perder o foco ou sair da tela esconde a carta.
A discussão e a votação são presenciais. A revelação pede confirmação.
Só os nomes são salvos no navegador. Atualizar a página encerra a rodada.
## Catálogo
Edite lib/catalog.mjs. Cada entrada segue [palavra, dica1, dica2, dica3].
As dicas iniciais devem ser calibradas com partidas reais do grupo.
## Limite do modo local
O jogo depende de confiança ao passar o celular: respostas e catálogo estão no navegador. Não é um sistema contra inspeção técnica ou trapaça.

