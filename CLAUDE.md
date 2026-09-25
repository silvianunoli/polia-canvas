# CLAUDE.md — regras de UI/UX e engenharia de Pólia

> O Claude Code lê este arquivo automaticamente em toda sessão (abra o projeto em `polia-app/`).
> Fonte da verdade visual: `DESIGN.md` + `src/styles.css`. A restrição mora aqui, não na memória.

## Princípio inegociável

Mundo visual **Pólia v3** (escopo `.polia-v3`, em 100% das rotas): pedra/creme neutro, turquesa, pêssego, amarelo pontual, tinta. Parece editorial contemporâneo, não dashboard de SaaS genérico.
Toda tela deve passar os adjetivos-âncora: motivadora, presente, direta, anima-sem-açúcar. Se humilha, infantiliza ou vira hype de coach, está errada. Se é morna e sem direção, também.

## PROIBIDO (nunca gere)

- Cor, sombra ou raio fora dos tokens de `src/styles.css`. Nada de hex hardcoded no componente.
- Recriar um tema alternativo de fundo escuro/noite. O `.cosmic` foi removido do CSS em 2026-07-23; código novo é só Pólia v3.
- Ressuscitar a paleta v1 (Territorial Diurno: terracota `#C96B3E`, musgo `#2D6A4F`, noite `#1A1A2E`, dourado `#C8A96E`, creme `#FDF8F5`) ou o vocabulário territorial (território, trilha, marco, carimbo, bússola, mundo territorial, paleta territorial, narrativa territorial). Morreu em 2026-07-23. Não criar substituto conceitualmente equivalente (2026-09-15).
- Anzylna com `opacity < 1` ou abaixo do piso (18px / 20px mobile). Use as classes canônicas (`.anzylna-decorativo`/`.anzylna-informacional`, antigas `.caveat-*`). Não use Caveat — está morta.
- Gradientes e glassmorphism (cards translúcidos com blur).
- Sombras grandes ou coloridas. Separe com borda 1px (`--border`).
- Emoji como ícone; ícones 3D/coloridos. Use lucide outline.
- Ilustração 3D genérica, "blob", foto de banco. A imagem é fotografia real de trabalho e de decisão, na paleta v3 (ver `DESIGN.md` §5).
- Mascote, de qualquer espécie. A raposa morreu em 2026-08-12 (decisão da fundadora) e os prompts dela foram deletados do repo. A copy de `/sobre` nega ter mascote. Não gere raposa nem substituta.
- Verbo de transformação genérico usado como promessa de marketing (2026-09-15): "transforme", "revolucione", "mude sua vida" — descreva concretamente o que a Pólia mostra, organiza, conecta ou ajuda a decidir. Continuam proibidos hype, promessa milagrosa, "revolucione seu negócio", emoji como recurso de marketing ("✨" incluso), exclamação gratuita e linguagem de coach.
- Centralizar tudo. Alinhe à esquerda por padrão.
- 3 cards idênticos como única forma de mostrar features.

## OBRIGATÓRIO

- Use SOMENTE os design tokens de `src/styles.css` (escopo `.polia-v3`). Cor nova entra como token primeiro.
- Espaçamento só na escala 4/8/12/16/24/32/48/64/96/128.
- Para cada componente interativo, implemente os estados: normal, hover, foco, carregando, vazio, erro, desabilitado.
- Acessibilidade (já é piso no projeto): contraste AA, `:focus-visible` visível, navegação por teclado, labels, skip link.
- Mobile-first e responsivo.
- Copy concreta e sem hype, no tom de conversa de café: duas profissionais adultas, de igual para igual. Voz honesta com dinheiro, acolhedora sem infantilizar. Nunca travessão.

## Vozes e personagens (Pólia v4, 2026-09-15 — substitui a antiga regra "persona é Ana, Aimer é a cara da marca")

**PÓLIA** é a marca, empresa e produto. Fala como empresa ao explicar o produto, apresentar funcionalidades, escrever mensagens de interface, responder dúvidas, apresentar benefícios, fazer promessas e escrever páginas institucionais/funcionais. Voz: clara, adulta, inteligente, direta, acolhedora, próxima, honesta com dinheiro, sem tom de coach, sem infantilização, sem hype. Amiga, não guru: organiza, mostra, ajuda a decidir, nunca decide no lugar da empreendedora. Em conteúdo e redes pode usar "a gente" como forma coloquial, sem perder profissionalismo; em mensagem de produto (erro, cobrança, confirmação), o sujeito é sempre "a Pólia" (ver "Voz por zona" abaixo).

**AIMER** é uma personagem fictícia criada com IA: protagonista do universo narrativo da Pólia, personagem dos Reels e conteúdos narrativos, rosto/personagem da marca quando fizer sentido, parte da história pública de construção da Pólia. Aimer NÃO é Ana, NÃO é Sil, NÃO é uma pessoa real, não tem biografia humana real (não inventa experiências humanas como fato) e não deve ser tratada como fundadora da Pólia. **Aimer não é o chatbot de suporte da Pólia** — essa era a regra antiga e está morta; remover qualquer referência remanescente a "Aimer = chatbot de suporte". Sua presença não é automática em toda página da marca; depende do contexto da superfície e das regras do universo narrativo (ver seção própria abaixo). Personalidade: alegre, empolgada, simpática, persuasiva, curiosa, ansiosa, expressiva, energética, otimista, espontânea. Regra central: **Aimer tem pressa emocional, não pressa estratégica** — pode demonstrar entusiasmo e ansiedade com o que está acontecendo, mas isso não pode virar caricatura infantil nem conteúdo de coach.

**SIL** é a fundadora real da Pólia. A primeira pessoa do singular é reservada a ela falando como pessoa real — em `/sobre`, `/lista-de-espera`, no bloco de contato da `/ajuda`, e em relatos pessoais explicitamente assinados por Sil. Não atribuir à Aimer experiências que pertencem à Sil.

**ANA** é a persona da cliente, citada no produto — mas não é personagem do universo narrativo da Aimer. Ana representa a empreendedora que vende, toma decisões, nem sempre sabe quanto realmente sobra, pode cobrar no chute, pode misturar decisão de negócio com insegurança e precisa de clareza pra decidir. A Pólia trata Ana como uma adulta inteligente.

## Papel da Pólia na decisão (2026-09-15)

A Pólia não decide pela empreendedora. Ela organiza os números, mostra o cenário e conecta as informações pra que a decisão tenha chão — a decisão continua nas mãos da empreendedora. A Pólia organiza, mostra, conecta, compara, ajuda a entender, dá contexto, ajuda a decidir. Evitar copy que sugira que a Pólia sabe o que é melhor pra cliente, decide por ela, determina o preço ideal, garante o resultado ou sabe qual caminho ela deve seguir.

## O que a Pólia não é (2026-09-15)

Não é coach, guru, professora que sabe mais sobre a vida da empreendedora, sistema de cobrança emocional, nem discurso motivacional disfarçado de gestão. A Pólia explica, organiza, mostra relações e ajuda a decidir. Não cria culpa, não humilha, não infantiliza, não promete sucesso, não trata a empreendedora como incapaz de decidir.

## Vocabulário e persona (fonte: `BRAND.md`)

- **Marca primeiro, número depois** (eixo, revertido 2026-09-25, substitui "número primeiro, marca depois" mesmo com o reforço de 2026-09-15): cuidar da marca, torná-la memorável e mostrar que ela tem valor vem na frente. É isso que sustenta cobrar o que ela merece. Preço vem de cálculo próprio, custo real da marca, nunca de copiar o preço da concorrente. O número entra depois, como ferramenta estratégica: a visão dos números que a marca gera é o que orienta decisões mais assertivas. Não reintroduzir "número primeiro" sem decisão explícita da Sil. Fonte completa da mudança: `../human-output/dna/polia/resultado/DNA.md` (fora deste repo, na raiz do workspace).
- A lógica do produto (2026-09-15): Planejamento → decisões → ferramentas → operação → números → Painel. O Planejamento não é formulário isolado — as respostas dele alimentam outras partes do sistema. Comunicar a Pólia como "um documento vivo do negócio que vira preço, lucro e meta, ligados entre si", nunca como apenas calculadora, planner, financeiro, CRM ou formulário isolado — ela integra essas partes.
- Palavras e frases proibidas (varrer e reescrever, nunca deixar entrar em copy nova): "marca-primeiro" como eixo ativo (só como registro histórico), "fatura mais" como norte (faturar mais não é o norte central da Pólia — priorizar quanto custa/quanto cobra/quanto sobra/dá lucro/quanto precisa entrar/quanto falta/preço/meta/decisão), "Quero faturar", "Começo"/"Alcance"/"Voo" (nomes de plano mortos, assim como "Confere/Controle/Projete" desde 14/09/2026; os atuais são Grátis/Premium/Pro, com chave interna confere/controle/projete — nunca exibir os nomes antigos ao usuário; progressão estratégica de referência: Eu descubro → Eu acompanho → Eu projeto, sem precisar aparecer literalmente em toda interface), "margem" fora da calculadora interna (na copy de marketing vira "quanto sobra"), "Dani", "marca clara é marca que fatura", "do seu jeito", "no seu tempo", "no seu ritmo" (vendem ausência; a marca lidera pela ajuda, nunca pelo "faça sozinha"), "planilha por fora" (vira "planilha perdida"), "infoproduto" (vira "produto digital" com exemplo), "turma", "etapa", "trilha", "jornada" (vocabulário morto; o produto chama de "módulo"), "marco/marcos" como jargão de território (mundo territorial morreu; se for referência numérica do Planejamento, chama de "referência", nunca "módulo" nem "meta" a menos que seja literalmente isso). A proibição vale para TEXTO VISÍVEL ao usuário; identificador de código pode ficar (ex.: `etapaInfo`, `jornada_cliente`, o token CSS `--marco`, a coluna `etapa_atual`).
- Trava de pessoa gramatical (2026-08-17, substitui a regra de 3ª pessoa de 2026-07-08): **a Pólia é o sujeito das promessas de produto; "você" pode ser sujeito quando descreve situação, comportamento ou decisão que a empreendedora reconhece.** Liberado: "Você fecha o preço no chute e passa o resto do dia torcendo.", "Você olha para os números e entende o cenário." Proibido quando "você" funciona como promessa de resultado, merecimento ou discurso motivacional: "você consegue", "você merece", "você vai longe", "você vai transformar seu negócio", "acredita no seu potencial". Preferir a Pólia, o módulo ou o número como sujeito da promessa: "a Pólia mostra quanto sobra", "o Painel organiza", "o Planejamento conecta", "o número mostra", "a marca sustenta". Em CTA, "você" como sujeito segue proibido; preferir "Quero descobrir...", "Quero entrar...", "Conhecer a Pólia...". Blog assinado mantém o ensaio pessoal em 2ª pessoa (sem mudança).
- **Voz por zona (2026-09-25, substitui "quem fala em mensagem de sistema" de 2026-08-17).** Conteúdo e redes (Instagram, blog, newsletter) liberam "a gente": é onde a energia de amiga vive. Produto (mensagem de sistema, erro, cobrança, confirmação) usa a Pólia como sujeito direto, nunca "a gente" nem "eu": "A Pólia não conseguiu salvar. Tenta de novo, os dados continuam guardados." em vez de "Não conseguimos salvar" ou "a gente guarda tudo". A primeira pessoa do singular não deve ser usada pela Pólia como empresa nem pela Aimer como se fosse pessoa real — é reservada à Sil falando como pessoa, e só existe em `/sobre`, `/lista-de-espera` e no bloco de contato da `/ajuda` (quando a comunicação estiver explicitamente em nome da Sil), além de relatos pessoais assinados por ela. Não varrer esses lugares para o plural.
- Camada de humor (2026-08-17, reforçada 2026-09-15): voz próxima e cotidiana, divertida por observação (o riso vem do reconhecimento da cena, nunca do prejuízo dela) e espontânea (ritmo de fala, pode abrir com "E", "Aí", "Olha"), feminina sem estereótipo (fora "poderosa", "girlboss", empoderamento de caneca). Teste de toda peça: "isso sou eu". Dose por superfície: produto = leve. O microcopy pode sorrir, mas estado de erro, cobrança e tela de dinheiro sensível não fazem piada, nunca. Humor é reconhecimento, não humilhação: nunca rir de falta de dinheiro, prejuízo, dívida, erro financeiro sensível ou insegurança real da cliente.
- Não transformar característica circunstancial da operação em promessa permanente de marca (2026-09-15): evitar "você fala diretamente comigo", "sem departamento", "eu respondo pessoalmente", "sem equipe", "sem intermediários" — essas características podem mudar conforme a Pólia cresce. A proximidade aparece no tom, não em promessa operacional que pode deixar de ser verdade.
- Aimer não aparece automaticamente em superfície institucional (2026-09-15): não adicionar Aimer a Home, Sobre, Ajuda, páginas de produto, checkout ou outra superfície funcional só por ser o rosto da narrativa. Usar Aimer principalmente quando houver narrativa, Reels, storytelling, construção pública da Pólia ou conteúdo em que a personagem tenha função. Em página institucional, prioridade é a voz da Pólia; na história da fundadora, prioridade é Sil.
- Continuidade do universo narrativo da Aimer (2026-09-15): controlar estágio de construção da Pólia, o que já aconteceu, o que Aimer já sabe, quais ambientes/objetos já apareceram, quais decisões já foram tomadas e o estado visual da construção. Cada episódio avança a história; Aimer não "descobre" de novo algo já estabelecido antes.
- Contexto de pré-lançamento (2026-09-15): a Pólia está em fase de construção e preparação pra lançamento, mas a narrativa trabalha a ideia de que ela está avançada, não começando do zero. "Estamos construindo a Pólia" pode significar finalizando, refinando, testando, preparando, ajustando ou chegando à versão que será lançada — não interpretar automaticamente como "acabamos de começar".

## Tipografia

Títulos (h1-h6) em **Cabinet Grotesk** (`letter-spacing:-0.02em`, classe `.font-cabinet`; restrita a texto grande e curto). Corpo e UI em **Inter**. **Fraunces só como itálico de acento pontual** (pull-quote, saudação "Bom dia, [nome]."; nunca título, nunca logo). **Anzylna** manuscrito pontual (piso 18px, opacity 1; peso único Regular — a fundição não publica outro peso). Migrada de Caveat em 2026-09-15 (fonte paga, self-hosted via `@font-face` em `src/styles.css`, arquivo em `public/fonts/Anzylna-Regular.ttf`); Caveat está morta, não é fallback nem alternativa dela. Label em caixa alta = DM Sans 700.

## Design tokens

Fonte única: `src/styles.css`, escopo `.polia-v3` (`@theme inline` + `.polia-v3`). Não duplicar valores. Principais: ação = `--secondary` (turquesa #7CCBCD; texto de link/CTA usa `--secondary-text` #24696B pra manter AA); fundo = `--bg` (#F2F0ED) e `--surface`; texto = `--ink` (tinta #0A0A0A) / `--ink-soft` / `--muted`; destaque = `--accent` (pêssego #F3B9A9, só fundo/borda/gráfico, nunca texto) e `--highlight` (amarelo #FFC629, indicador pontual, um por tela). Detalhe completo em `DESIGN.md` (reescrito pra v3 em 2026-07-23).

## Referências de qualidade (mire neste nível)

Notion, Linear, Duolingo, Vercel, Framer — ver DESIGN.md §7. NÃO se inspire em dashboards genéricos de template.

## Antes de criar ou alterar estruturalmente uma tela

1. Confirme qual é a UMA ação principal.
2. Descreva o fluxo em 1 frase.
3. Mostre wireframe em cinza (sem cor) para validar a estrutura.
4. Só então aplique os tokens.

Não exigir esse processo para: correção de copy, pequenos ajustes de texto, correção de bug, ajustes de acessibilidade, pequenos ajustes de componente sem mudança estrutural (2026-09-15).

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
