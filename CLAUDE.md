# CLAUDE.md — regras de UI/UX e engenharia de Pólia

> O Claude Code lê este arquivo automaticamente em toda sessão (abra o projeto em `polia-app/`).
> Fonte da verdade visual: `DESIGN.md` + `src/styles.css`. A restrição mora aqui, não na memória.

## Princípio inegociável
Mundo visual **Pólia v3** (escopo `.polia-v3`, em 100% das rotas): pedra/creme neutro, turquesa, pêssego, amarelo pontual, tinta. Parece editorial contemporâneo, não dashboard de SaaS genérico.
Toda tela deve passar os adjetivos-âncora: editorial, artesanal, acolhedora.

## PROIBIDO (nunca gere)
- Cor, sombra ou raio fora dos tokens de `src/styles.css`. Nada de hex hardcoded no componente.
- Recriar um tema alternativo de fundo escuro/noite. O `.cosmic` foi removido do CSS em 2026-07-23; código novo é só Pólia v3.
- Ressuscitar a paleta v1 (Territorial Diurno: terracota `#C96B3E`, musgo `#2D6A4F`, noite `#1A1A2E`, dourado `#C8A96E`, creme `#FDF8F5`) ou o vocabulário territorial (território, trilha, marco, carimbo, bússola). Morreu em 2026-07-23.
- Caveat com `opacity < 1` ou abaixo do piso (18px / 20px mobile). Use as classes canônicas.
- Gradientes e glassmorphism (cards translúcidos com blur).
- Sombras grandes ou coloridas. Separe com borda 1px (`--border`).
- Emoji como ícone; ícones 3D/coloridos. Use lucide outline.
- Ilustração 3D genérica, "blob", foto de banco. A imagem é fotografia real de trabalho e de decisão, na paleta v3 (ver `DESIGN.md` §5).
- Mascote, de qualquer espécie. A raposa morreu em 2026-08-12 (decisão da fundadora) e os prompts dela foram deletados do repo. A copy de `/sobre` nega ter mascote. Não gere raposa nem substituta.
- Copy de marketing: "transforme", "revolucione", "✨", exclamações.
- Centralizar tudo. Alinhe à esquerda por padrão.
- 3 cards idênticos como única forma de mostrar features.

## OBRIGATÓRIO
- Use SOMENTE os design tokens de `src/styles.css` (escopo `.polia-v3`). Cor nova entra como token primeiro.
- Espaçamento só na escala 4/8/12/16/24/32/48/64/96/128.
- Para cada componente interativo, implemente os estados: normal, hover, foco, carregando, vazio, erro, desabilitado.
- Acessibilidade (já é piso no projeto): contraste AA, `:focus-visible` visível, navegação por teclado, labels, skip link.
- Mobile-first e responsivo.
- Copy concreta e sem hype, no tom de conversa de café: duas profissionais adultas, de igual para igual. Voz honesta com dinheiro, acolhedora sem infantilizar. Nunca travessão.

## Vocabulário e persona (fonte: `BRAND.md`)
- Eixo: número-primeiro. Saber se o negócio dá lucro vem na frente; a marca é o porquê de cobrar mais. Copy e feature abrem pelo dinheiro (dá lucro, quanto sobra, parar de cobrar no chute), a marca aprofunda depois, nunca na largada.
- Persona citada no produto é sempre **Ana**. **Aimer** é só a cara da marca (chatbot de suporte e influenciadora), nunca o nome da cliente.
- Palavras e frases proibidas (varrer e reescrever, nunca deixar entrar em copy nova): "marca-primeiro" como eixo ativo (só como registro histórico), "fatura mais" como norte, "Quero faturar", "Começo"/"Alcance"/"Voo" (nomes de plano mortos; os atuais são Confere/Controle/Projete), "margem" fora da calculadora interna (na copy de marketing vira "quanto sobra"), "Dani", "marca clara é marca que fatura", "do seu jeito", "no seu tempo", "no seu ritmo" (vendem ausência; a marca lidera pela ajuda, nunca pelo "faça sozinha"), "planilha por fora" (vira "planilha perdida"), "infoproduto" (vira "produto digital" com exemplo), "turma", "marco/marcos" como jargão de território (mundo territorial morreu; se for referência numérica do Planejamento, chama de "referência", nunca "módulo" nem "meta" a menos que seja literalmente isso).
- Indicativo em 3ª pessoa nas páginas públicas e na área logada: nunca "você" como sujeito da frase. Use imperativo sem pronome ("Confere o @.", "Altere sua senha") ou reestruture a frase. "seu/sua" possessivo e "você" como objeto de preposição não são o alvo da regra.

## Design tokens
Fonte única: `src/styles.css`, escopo `.polia-v3` (`@theme inline` + `.polia-v3`). Não duplicar valores. Principais: ação = `--secondary` (turquesa #7CCBCD; texto de link/CTA usa `--secondary-text` #24696B pra manter AA); fundo = `--bg` (#F2F0ED) e `--surface`; texto = `--ink` (tinta #0A0A0A) / `--ink-soft` / `--muted`; destaque = `--accent` (pêssego #F3B9A9, só fundo/borda/gráfico, nunca texto) e `--highlight` (amarelo #FFC629, indicador pontual, um por tela). Detalhe completo em `DESIGN.md` (reescrito pra v3 em 2026-07-23).

## Referências de qualidade (mire neste nível)
Notion, Linear, Duolingo, Vercel, Framer — ver DESIGN.md §7. NÃO se inspire em dashboards genéricos de template.

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
- Alerta crítico de incidente de produção (webhook Stripe, taxa de erro, health-check externo) vai pro Telegram via edge function `alertas-criticos`, com dedup de 10 min por tipo. Detalhe completo, gatilhos e setup em `docs/observabilidade-alertas.md`.

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
