# Plano: tela de abertura própria do app Android (AND-10)

Pedido da Sil em 07/11/2026, depois de ver o app no emulador: sem login, o app abre a home de
marketing do site com o modal "Você já é usuária?" e o aviso de cookies empilhados por cima.
O app precisa de tela própria; ele não é cópia do desktop. Wireframe em cinza aprovado em 07/11.

**Decisões da Sil (07/11):** ícone com fundo pedra; nome embaixo do ícone "Pólia One";
escolha de cookies como linha no rodapé da tela de entrada.

**Ação principal da tela:** Entrar.
**Fluxo em 1 frase:** a dona toca no ícone, vê a abertura com a marca e cai na tela de entrada
(sem sessão) ou direto na aba Hoje (com sessão).

Mesma tecnologia (Capacitor). Nada de reescrita nativa.

## O que muda

### 1. Rota nova `/app` (tela de entrada do app)
- `src/routes/app.tsx`: logo Pólia One, rótulo "o sistema da sua marca" (DM Sans caixa alta),
  título em Cabinet "Cada encomenda num lugar só.", linha de apoio "Pedidos, entregas e quanto
  cada um lucra.", botão turquesa **Entrar** (`/auth/login`) e botão de contorno **Criar conta
  grátis** (`/auth/cadastro`, com `origem=app`). Copy é rascunho do wireframe, a Sil pode trocar.
- Rodapé: "Cookies de análise: Aceitar · Só essenciais" e link pra Política de Privacidade.
  Usa `setCookieConsent` de `src/lib/cookieConsent.ts`. Some depois que ela escolhe.
- Com sessão: vai direto pra `/hoje` (mesma regra que já existe no `useAppEntryGate`).
- `noindex`, fora do sitemap. Só tokens de `src/styles.css`, estados de foco e carregando.

### 2. O app passa a abrir em `/app`
- `capacitor.config.ts`: `server.url` vira `https://one.usepolia.com.br/app` e `appName` vira
  "Pólia One". Exige APK novo (o app não está na loja, então não afeta cliente).
- `src/hooks/useAppEntryGate.ts`: no app e sem sessão, a home manda pra `/app` em vez de abrir
  o modal. Cobre quem tem o APK antigo instalado e quem sai da conta e cai na home.
- `src/components/site/AppEntryGateModal.tsx` deixa de ser usado e sai, com o teste dele.

### 3. Aviso de cookies fora de cima das telas no app
- `src/components/ui/CookieConsent.tsx`: dentro do app (`useAppNativo`), o aviso flutuante não
  aparece; a escolha fica na linha da tela `/app`. No site nada muda.
- Efeito colateral aceito: quem já entra logada no app e nunca passa pela `/app` fica só com os
  essenciais (sem análise), que é o padrão sem consentimento.

### 4. Ícone, nome e abertura com a marca (Android)
- Ícone: gerar `mipmap-*/ic_launcher*.png` a partir de `polia-app-icon-light.svg` (fundo pedra)
  e o ícone adaptativo com o símbolo `polia-icone-c.svg` sobre `#F2F0ED` (`--bg`), dentro da
  área segura do Android. Substitui o X azul do Capacitor.
- Nome: `android/app/src/main/res/values/strings.xml` com "Pólia One".
- Abertura: `splash.png` (todas as densidades) com o símbolo no fundo pedra, e fundo pedra no
  tema de abertura do Android 12+. Plugin `@capacitor/splash-screen` (oficial do Capacitor)
  segura a abertura até a primeira tela pintar, pra não aparecer a tela preta de hoje.
  É dependência nova, a única deste plano.

## Ordem
1. Diário de bordo em `docs/script.md` (o arquivo tem mudança de outra sessão sem commit:
   a entrada nova vai só no fim, sem mexer no resto).
2. Itens 1 a 3 (site) + testes da `/app`, do gate e do aviso de cookies; tsc, lint, testes e build.
3. Item 4 (Android) + `cap sync` + APK de teste.
4. Ok da Sil pra commit e deploy. A `/app` precisa estar no ar antes do APK novo abrir nela.
5. Instalar o APK novo no emulador e conferir as três telas com print.

## Fora deste plano
- Keystore de release, versionCode e publicação na Play (AND-01, AND-04).
- Tutorial: a `/app` não é rota logada, então não ganha tutorial (o teste só cobre
  `_authenticated`). Nenhum tutorial existente fala da abertura do app.
- Novidade no sino: não entra, porque a tela só existe no APK novo, que ainda não chegou a
  nenhuma cliente. Entra quando o app for pra loja.
