# CLAUDE.md — regras de UI/UX e engenharia de Pólia

> O Claude Code lê este arquivo automaticamente em toda sessão (abra o projeto em `polia-app/`).
> Fonte da verdade visual: `DESIGN.md` + `src/styles.css`. A restrição mora aqui, não na memória.

## Princípio inegociável
Mundo visual **Territorial Diurno**: creme, terracota, mostarda, marrom. Parece papel pautado e carimbo, não dashboard de SaaS.
Toda tela deve passar os adjetivos-âncora: territorial, artesanal, acolhedora.

## PROIBIDO (nunca gere)
- Cor, sombra ou raio fora dos tokens de `src/styles.css`. Nada de hex hardcoded no componente.
- Aplicar o tema `.cosmic` (legacy/noite) em containers raiz. Ele está em remoção; código novo é só Territorial Diurno.
- Caveat com `opacity < 1` ou abaixo do piso (18px / 20px mobile). Use as classes canônicas.
- Gradientes e glassmorphism (cards translúcidos com blur).
- Sombras grandes ou coloridas. Separe com borda 1px (`--border`).
- Emoji como ícone; ícones 3D/coloridos. Use lucide outline.
- Ilustração 3D genérica, "blob", foto de banco. A ilustração é territorial (mascote raposa).
- Copy de marketing: "transforme", "revolucione", "✨", exclamações.
- Centralizar tudo. Alinhe à esquerda por padrão.
- 3 cards idênticos como única forma de mostrar features.

## OBRIGATÓRIO
- Use SOMENTE os design tokens de `src/styles.css` (semânticos e `--polia-*`). Cor nova entra como token primeiro.
- Espaçamento só na escala 4/8/12/16/24/32/48/64/96/128.
- Para cada componente interativo, implemente os estados: normal, hover, foco, carregando, vazio, erro, desabilitado.
- Acessibilidade (já é piso no projeto): contraste AA, `:focus-visible` visível, navegação por teclado, labels, skip link.
- Cores de fase (`--polia-sonho/construcao/venda/evolucao`) só para diferenciar etapa da jornada, nunca como enfeite.
- Mobile-first e responsivo.
- Copy seca, concreta, sem hype. Verbo no comando. (Use a skill `copy-sem-positividade`.)

## Design tokens
Fonte única: `src/styles.css` (`@theme inline` + `:root`). Não duplicar valores. Principais: ação = `--primary` (terracota #C96B3E); fundo = `--background` (creme #FDF8F5); texto = `--foreground` (noite #1A1A2E); destaque = `--accent` (dourado #C8A96E). Detalhe completo em `DESIGN.md`.

## Referências de qualidade (mire neste nível)
[Liste 3–5 produtos padrão-ouro pra Pólia — ver DESIGN.md §9.] NÃO se inspire em dashboards genéricos de template.

## Antes de gerar qualquer tela
1. Confirme qual é a UMA ação principal.
2. Descreva o fluxo em 1 frase.
3. Mostre wireframe em cinza (sem cor) para validar a estrutura.
4. Só então aplique os tokens.

## Depois de gerar
Revise contra este arquivo, contra o `DESIGN.md` e contra os checklists em `docs/`; liste o que faltou. Rode os agentes `revisor-anti-ia` e `revisor-de-usabilidade`.

## Segurança (inegociável)
- Nunca segredo hardcoded nem versionado (chave, token, senha, connection string). `.env` fica fora do git (já no `.gitignore`); use variável de ambiente / `.dev.vars` (Cloudflare) / secrets do Supabase. Não logue dado sensível.
- Supabase: a **service role key** só no servidor (`client.server.ts`), nunca no client. RLS ligado em toda tabela com dado de usuário. Edge functions validam o JWT e os papéis.
- Toda entrada é não confiável: valide (allowlist) e sanitize. Sem concatenar SQL. Escape de output (XSS).
- Autorização por objeto em toda requisição (sem BOLA) e por papel em funções sensíveis (rotas `admin.*`). Negue por padrão. IDs expostos imprevisíveis (UUID).
- Não reinvente autenticação: use o IdP/Supabase Auth. Valide e assine tokens. Reautentique operações sensíveis. MFA onde der.
- Retorne só campos autorizados (sem serialização genérica). Sem mass assignment. Payload mínimo.
- Erro sem stack trace pro cliente. TLS sempre. CORS restrito. Rate limiting em login e operações caras.
- Dependências sem vulnerabilidade conhecida (rode SCA). LGPD: minimize coleta, mascare dado em dev/qa, criptografe dado sensível.
- Depois de codar, rode o agente `revisor-de-seguranca`.

## Arquitetura (regras)
- SOLID: responsabilidade única; aberto/fechado (polimorfismo, não if por tipo); Liskov; interfaces pequenas; inversão de dependência (injeção, não instanciar concreto na regra).
- A lógica de domínio vive em `src/lib/*.functions.ts` e NÃO depende de UI nem de detalhe de transporte. Acesso a dados isolado em `src/integrations/supabase`. A regra não conhece o componente React.
- Baixo acoplamento, alta coesão. Nomes claros, funções curtas, erros tratados (sem exceção silenciosa).
- KISS/YAGNI: simples primeiro, sem over-engineering. Padrão só quando o problema dele aparecer.
- Domínio coberto por testes. Decisões relevantes em ADR (`docs/adr/`, use `docs/templates/ADR.template.md`).
- Depois de codar, rode o agente `revisor-de-arquitetura`.

## App pronta pra nuvem (12 fatores) — deploy Cloudflare Workers
- Config no ambiente: credenciais, URLs e chaves vêm de variável de ambiente / secret, NUNCA do código.
- Dependências declaradas no manifesto (`package.json`/`bun.lock`); nada depende do que está instalado na máquina.
- Processo stateless: estado vai para backing service (Supabase), não para a memória do worker.
- Backing services plugáveis por URL configurável. Logs como stream.
- Startup rápido, shutdown limpo. Menor privilégio em toda permissão (chaves, RLS, CORS).

## Pilotagem (como dirigir a IA)
- Plano antes de implementar (arquivos, componentes, justificativa) e APROVE antes de codar.
- Uma fase por vez; nunca "construa tudo". Diário de bordo em `docs/script.md` antes de mexer no código.
- Comentário como contexto pra IA. Regras curtas e por tema.
- ANÁLISE DE CONFIANÇA antes do deploy: a IA revisa o próprio código, dá nota (0–100) e aponta o bug mais provável.
