# Plano: login dentro do app Android

28/10/2026 · origem: pergunta da Sil sobre o login no app · status: **esperando aprovação da Sil, nada codado**

## O problema

O app é o site (`one.usepolia.com.br`) aberto dentro de uma WebView do Capacitor. A tela de login é a do site. Dois caminhos quebram no app:

1. **"Entrar com Google"**: o Google bloqueia login dentro de WebView embutida (erro `403 disallowed_useragent`). O botão hoje leva pra uma tela de erro do Google.
2. **Links de e-mail** (confirmar cadastro, nova senha, "Falta um clique pra entrar", ativação de compra): o link aponta pro servidor de login do Supabase (`...supabase.co/auth/v1/verify`), que depois manda pro nosso domínio. O Android abre esse link no Chrome, não no app. Ela confirma ou troca a senha no Chrome e, no app, continua sem sessão.

Hoje o app não tem como abrir página no navegador do celular nem receber um link de volta: só existem `@capacitor/core`, `android`, `cli` e `push-notifications`, e o `AndroidManifest.xml` só tem o filtro de abrir pelo ícone.

## A ação principal e o fluxo

**Ação principal:** entrar uma vez no app e continuar entrada.

**Fluxo em uma frase:** no app, o Google abre no navegador do celular e devolve a sessão pro app; os links de e-mail apontam pro nosso domínio, e o Android abre esses links direto no app.

## Parte 1: Google pelo navegador do celular (só código + app novo)

1. Instalar `@capacitor/app` (recebe o link de volta) e `@capacitor/browser` (abre o navegador do celular por cima do app, a "aba" do Chrome).
2. Dentro do app (`isNativeApp()`), o "Entrar com Google" do login e do cadastro chama o Supabase com `skipBrowserRedirect: true` e `redirectTo: br.com.usepolia.app://entrar`, e abre a URL do Google com `Browser.open`.
3. `AndroidManifest.xml`: filtro pro esquema `br.com.usepolia.app://`. Esse esquema é só do nosso app e não precisa de verificação.
4. Ouvinte `appUrlOpen` (um só, no layout raiz): chega `br.com.usepolia.app://entrar#access_token=...&refresh_token=...`, a Pólia grava a sessão com `supabase.auth.setSession`, fecha a aba do Chrome e vai pro destino (Hoje).
5. No site (fora do app), nada muda.

## Parte 2: links de e-mail abrindo no app

1. **Página nova `/auth/link`** no nosso domínio: recebe `token_hash` e `type` e confirma pelo `supabase.auth.verifyOtp`. Dá certo, segue pro destino (confirmação de cadastro → Painel; nova senha → `/auth/redefinir-senha`; ativação de compra → `/auth/criar-senha`). Link vencido → `/auth/link-expirado`, que já existe. Serve no site também: o fluxo do navegador fica igual pra quem está no computador.
2. **E-mails que a própria Pólia monta** (`lembretes-conta`, `stripe-webhook`, `reenviar-emails`): trocar o `action_link` do Supabase por `https://one.usepolia.com.br/auth/link?token_hash=...&type=...`, a partir do `hashed_token` que o `generateLink` já devolve.
3. **E-mails que o Supabase manda sozinho** (confirmação de cadastro, recuperação de senha, troca de e-mail): os modelos moram no painel do Supabase. O link deles passa a ser `{{ .SiteURL }}/auth/link?token_hash={{ .TokenHash }}&type=...`. Eu escrevo os três modelos prontos pra colar.
4. **App Links (Android):** arquivo `https://one.usepolia.com.br/.well-known/assetlinks.json` (servido pelo Worker) com o pacote `br.com.usepolia.app` e a impressão digital SHA-256 da chave que assina o app; filtro `https` com verificação automática no `AndroidManifest.xml` pra `/auth/link`. O ouvinte da Parte 1 recebe esse link e manda a WebView pra ele.

Hoje o app é assinado com a chave de teste desta máquina (`debug.keystore`). A impressão digital dela entra agora no `assetlinks.json`. Quando o app for pra Play Store, entra também a da chave de publicação (Play Console → Integridade do app), e as duas convivem no arquivo.

## O que depende de você

| # | O quê | Onde | Quando |
|---|---|---|---|
| S1 | Adicionar `br.com.usepolia.app://**` em **Redirect URLs** | Supabase → Authentication → URL Configuration | antes de testar o Google no app |
| S2 | Colar os 3 modelos de e-mail novos (eu entrego o texto) | Supabase → Authentication → Email Templates | no mesmo dia do deploy da Parte 2, nem antes nem depois |
| S3 | Instalar o app novo no celular (eu gero o APK) | celular | depois do build |
| S4 | Mais tarde: SHA-256 da chave de publicação | Play Console | quando o app for pra loja |

S2 tem hora certa: modelo novo sem a página `/auth/link` no ar quebra a confirmação de cadastro de todo mundo. Por isso a ordem é: página no ar → você cola os modelos → confere um cadastro de teste.

## Decisões pra você

| # | Decisão | Minha recomendação |
|---|---|---|
| D1 | Fazer as duas partes ou só a 1 agora | **As duas**, nesta ordem: Parte 1 (só depende de S1 e S3) e depois a Parte 2. |
| D2 | Enquanto o app novo não está no celular, esconder o "Entrar com Google" no app antigo | **Não precisa**: hoje só você instala o app. |
| D3 | Os links de e-mail passam pela página `/auth/link` também no computador | **Sim**: uma regra só pros dois, e o link fica no nosso domínio (passa mais confiança que `supabase.co`). |

## Riscos

- **Modelo de e-mail errado no painel** quebra confirmação de cadastro. Mitigação: S2 só depois da página no ar, com cadastro de teste logo em seguida; o texto antigo fica guardado no plano pra voltar em 1 minuto.
- **Link antigo** (e-mail enviado antes da troca) continua apontando pro Supabase e funciona no navegador, como hoje.
- **Chrome do celular desatualizado** sem a aba por cima: o `@capacitor/browser` cai no navegador comum, e a volta pelo esquema `br.com.usepolia.app://` funciona igual.

## Como testar (depois do deploy e do app novo)

1. No app, "Entrar com Google" → escolhe a conta → volta pro app já na aba Hoje.
2. Cadastro de teste com e-mail novo → toca no link do e-mail no Gmail do celular → abre o app, já entrada.
3. "Esqueci a senha" no app → link do e-mail abre o app na tela de nova senha.
4. No computador, os três caminhos continuam iguais.

## Passo a passo dos itens S1 e S2 (pra Sil)

### S1: endereço de volta do Google (pode fazer já)

Supabase → Authentication → URL Configuration → **Redirect URLs** → "Add URL":

```
br.com.usepolia.app://**
```

Não mexa no "Site URL" nem nas outras URLs da lista.

### S2: links dos e-mails (só DEPOIS do deploy, com a página /auth/link no ar)

Supabase → Authentication → Email Templates. Em cada modelo abaixo, troque **todas** as vezes que aparece `{{ .ConfirmationURL }}` (costuma estar no botão e no link de texto) pelo endereço da coluna "Novo". O resto do texto fica igual.

| Modelo no painel | Antigo (pra voltar atrás) | Novo |
|---|---|---|
| Confirm signup | `{{ .ConfirmationURL }}` | `https://one.usepolia.com.br/auth/link?token_hash={{ .TokenHash }}&type=email` |
| Reset Password | `{{ .ConfirmationURL }}` | `https://one.usepolia.com.br/auth/link?token_hash={{ .TokenHash }}&type=recovery` |
| Change Email Address | `{{ .ConfirmationURL }}` | `https://one.usepolia.com.br/auth/link?token_hash={{ .TokenHash }}&type=email_change` |

O modelo "Magic Link" não precisa: a Pólia não usa entrada por link mágico pela tela, e os links desse tipo que ela manda (lembrete de confirmação, ativação de compra) já saem das funções do servidor com o endereço novo.

Logo depois de salvar, um cadastro de teste com e-mail novo: o link do e-mail tem que abrir `one.usepolia.com.br/auth/link...` e cair no Painel já com a conta aberta. Se der errado, volte os três pro `{{ .ConfirmationURL }}`.

## Ordem de execução depois da aprovação

1. Diário de bordo em `docs/script.md`.
2. Parte 1: pacotes, ouvinte, botão do Google no app, filtro no `AndroidManifest`, testes do que for regra pura.
3. Parte 2: `/auth/link` + testes, `assetlinks.json`, filtro `https`, links das edge functions, texto dos 3 modelos.
4. `npm test` inteiro, tipos, lint, build, `npx cap sync` e APK de teste.
5. Commit e deploy só com o seu ok; edge functions publicadas na mesma janela.
