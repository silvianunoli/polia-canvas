# PRD · Quiz "Você está pagando pra trabalhar?"

Isca digital do pré-lançamento da Pólia. Página pública com 8 perguntas, resultado por território e captura de e-mail. Decidido pela Sil em 10/08/2026 (quiz antecipado de setembro; com captura; e-mail capturado = lista da oferta de fundadora de outubro).

## 1. Shaping

**Problema:** o link da bio do @usepolia precisa de uma isca que converta visitante fria em e-mail. A lista de espera pura converte pouco no frio; quiz converte na faixa de 20 a 40% contra ~1% de e-book (pesquisa do artefato polia-estrategia-instagram, 30/07). Sem essa página, o post 5 da fase "Do zero" não pode sair e o pré-lançamento não acumula nada.

**Persona:** Ana. Empreende (comida, roupa, artesanato, beleza, serviço), decide no chute e remói depois. Chega pelo Instagram, no celular, com atenção curta.

**Apetite:** _Sugestão (confirmar):_ 1 semana. A página precisa estar no ar antes do post 5 (sexta da semana 1). O escopo se ajusta ao prazo, não o contrário: se apertar, corta animação e polimento, nunca estados e erros.

**Solução em uma frase:** uma página mobile-first em usepolia.com.br com 8 perguntas de múltipla escolha que diagnostica em qual das 6 perguntas do método a pessoa está mais no chute, mostra a faixa na hora e entrega o diagnóstico completo em troca do e-mail, gravando o lead no Supabase.

**Rabbit holes (evitar):**

- Motor de quiz genérico/configurável. As 8 perguntas são fixas, hardcoded. Não construir CMS de quiz.
- Automação de e-mail. O provedor de disparo não existe ainda (pendência registrada). O v1 só GRAVA o lead; a sequência de 3 e-mails é outra entrega.
- Compartilhamento do resultado (card bonito pra stories). Tentador, fica pro v1.1 se os leads justificarem.
- Perfeccionismo visual. Tokens do `src/styles.css` e pronto.

**No-go's (de propósito):**

- Sem login, sem conta, sem salvar progresso entre visitas.
- Sem A/B de perguntas no v1.
- Sem integração com o produto (não é o Raio-x; o quiz não escreve em nenhuma tabela do app além da de leads).
- Sem disparo de e-mail no v1 (grava o lead; o disparo vem quando o provedor for decidido).
- Sem pop-up de saída, sem contador fake, sem escassez falsa.

## 2. Fluxos

**Caminho feliz:**

1. Ana toca o link da bio → abre `/quiz` (tela de abertura): título "Você está pagando pra trabalhar?", subtítulo "8 perguntas, 2 minutos, sem julgamento", botão "Quero descobrir".
2. Toca "Quero descobrir" → pergunta 1 de 8, com barra de progresso ("1 de 8"). Uma pergunta por tela, 3 alternativas, avança ao tocar.
3. Responde as 8 → tela de faixa: mostra na hora a faixa dela (ex.: "Seu resultado: No escuro nos pontos que doem") + a frase "Seu diagnóstico completo mostra onde está o chute e a primeira conta pra sair dele." + campo de e-mail + checkbox de consentimento + botão "Quero meu diagnóstico".
4. Preenche e-mail válido, marca o consentimento, toca o botão → sistema grava o lead no Supabase → tela de resultado completo: faixa + território mais fraco (com o nome do módulo, ex.: "Quanto vale") + explicação curta + UMA conta pra fazer hoje + "seus próximos passos chegam no seu e-mail" + botão "Seguir @usepolia →".

Fim. Sem redirect automático.

**Alternativos:**

- **Voltar:** em qualquer pergunta, link "voltar" retorna à anterior com a resposta dada ainda selecionada. Na pergunta 1, "voltar" não aparece.
- **Abandonar no meio:** nada é gravado. Se recarregar, começa do zero (estado só em memória). Aceito de propósito no v1.
- **Refazer:** na tela final, link discreto "refazer o teste" reinicia. Se gravar com o mesmo e-mail, o registro é ATUALIZADO (upsert), não duplicado.
- **Acesso direto a `/quiz/resultado`:** essa URL não existe. O resultado é estado da página, não rota. Quem digitar variação de URL cai na abertura do quiz.

**Exceção:**

- Sem conexão ao enviar o e-mail: ver tabela de erros. As respostas ficam em memória; a pessoa corrige a conexão e tenta de novo sem responder tudo outra vez.
- E-mail já cadastrado: não é erro para a usuária. Upsert silencioso (atualiza respostas, faixa e data) e segue pro resultado.
- JavaScript desabilitado: fora de escopo tratar; público vem do app do Instagram (webview com JS). Não construir fallback.

## 3. Estados

| Tela / componente | Estado | Existe? | Comportamento |
| --- | --- | --- | --- |
| Abertura | Carregado | Sim | Título, subtítulo, botão "Quero descobrir". Nada de carregando: página estática. |
| Pergunta | Carregado | Sim | Pergunta, 3 alternativas, progresso "N de 8", "voltar" (exceto na 1ª). |
| Pergunta | Sem resposta | Sim | Avanço só acontece ao tocar uma alternativa; não existe botão "próxima" solto pra tocar sem responder. |
| Gate de e-mail | Vazio | Sim | Faixa visível + campo de e-mail vazio + checkbox desmarcado + botão desabilitado. |
| Gate de e-mail | Preenchido inválido | Sim | Botão habilita só com e-mail em formato válido E checkbox marcado. |
| Gate de e-mail | Enviando | Sim | Botão vira "Enviando..." e desabilita (evita toque duplo). |
| Gate de e-mail | Erro | Sim | Ver tabela de erros; respostas preservadas. |
| Resultado | Carregado | Sim | Faixa + território fraco + conta do dia + CTA de seguir. |
| Resultado | Parcial | Não | Não existe: ou gravou e mostra tudo, ou ficou no gate com erro. |
| Qualquer | Desabilitado por plano/permissão | Não | Página pública, sem papéis. |

Atenção ao mais esquecido aqui: o estado "enviando" do gate. Toque duplo no botão em 4G lenta é o caso real de duplicação; o botão desabilita no primeiro toque.

## 4. Erros

| Tipo | Quando | Mensagem exata | Recuperação |
| --- | --- | --- | --- |
| Validação | E-mail em formato inválido | "Esse e-mail não parece completo. Confere pra gente?" | Campo em foco, borda de erro, botão desabilitado até corrigir. |
| Validação | Checkbox desmarcado com e-mail ok | (sem mensagem; botão segue desabilitado) | Marcar o checkbox habilita o botão. |
| Rede | Falha ou timeout ao gravar (sem resposta em 8s) | "Não conseguimos salvar agora. Suas respostas estão guardadas aqui, é só tentar de novo." | Botão volta pra "Quero meu diagnóstico"; respostas preservadas em memória. |
| API | Supabase retorna erro (4xx/5xx) | Mesma mensagem de rede acima. | Mesmo comportamento. Logar o erro no console com contexto. |
| Negócio | E-mail já existe na tabela | Nenhuma. Upsert e segue pro resultado. | Não aplicável. |

Regra das mensagens: secas, específicas, nunca culpam a usuária, sem travessão, sem emoji, sem "ops!".

## 5. Regras

As 8 perguntas (fixas, nesta ordem), alternativas e pontos. Formato: alternativa A = 2 pontos, B = 1, C = 0. Linguagem da Ana, sem jargão. Perguntas 1 a 6 mapeiam os 6 territórios; 7 e 8 são de comportamento (pontuam a faixa, não o território).

1. **Quanto vale** · "Uma cliente pede desconto agora. Você sabe até onde pode ir sem sair no prejuízo?" A: Sei na hora. · B: Tenho uma noção. · C: Decido no chute e depois fico remoendo.
2. **O que você vende** · "Qual produto seu deixa mais dinheiro no fim do mês? (não o que mais vende)" A: Sei qual é. · B: Acho que sei. · C: Nunca fiz essa conta.
3. **Razão de existir** · "Te pedem pra explicar seu negócio em uma frase. Sai na hora?" A: Sai. · B: Sai na terceira tentativa. · C: Eu travo.
4. **Quem você serve** · "De 10 clientes, quantas voltam pra comprar de novo?" A: Sei o número. · B: Tenho uma impressão. · C: Não faço ideia.
5. **Como te acharem** · "Sua última cliente nova chegou até você por onde?" A: Sei exatamente. · B: Acho que sei. · C: Não sei dizer.
6. **Onde você vai** · "Quanto precisa entrar esse mês pra você fechar no azul?" A: Sei o número. · B: Sei mais ou menos. · C: Descubro quando o mês acaba.
7. **Comportamento** · "Suas decisões de dinheiro (preço, compra, desconto) saem como?" A: Com conta feita. · B: Metade conta, metade sentimento. · C: No chute, na pressão.
8. **Comportamento** · "Depois de uma decisão difícil, você fica remoendo se acertou?" A: Quase nunca. · B: Às vezes. · C: Sempre.

**Pontuação e resultado:**

- Total: 0 a 16 pontos. Faixas: 13-16 "Quase lá, falta amarrar" · 9-12 "Meio caminho" · 5-8 "No escuro nos pontos que doem" · 0-4 "No chute total". Tom das faixas: direto e sem humilhar; a faixa mais baixa não ridiculariza, constata.
- Território fraco: a menor pontuação entre as perguntas 1 a 6. Empate: vale o que vem primeiro na ordem dos módulos (Razão de existir > Quem você serve > O que você vende > Quanto vale > Como te acharem > Onde você vai). _Sugestão (confirmar)._
- O resultado nomeia o território com o NOME DO MÓDULO do produto (ensina o vocabulário antes do cadastro) e entrega UMA conta pra fazer hoje, específica do território. As 6 contas estão escritas em `src/lib/quiz/perguntas.ts` (campo `conta`), na base combinada: desconto x quanto sobra (Quanto vale), o que cada produto deixa (O que você vende), orçamentos perdidos no mês (Razão de existir), quantas de 10 voltam (Quem você serve), posts x pedidos (Como te acharem), quanto falta pro azul (Onde você vai).

**Dados (Supabase, mesmo projeto do app):**

- Tabela `quiz_leads`: `id` uuid pk default, `email` text UNIQUE not null (normalizado: trim + minúsculas), `faixa` text, `territorio_fraco` text, `pontos` int, `respostas` jsonb (as 8 escolhas), `origem` text default 'instagram_bio', `consentimento` boolean not null, `consent_texto` text (a frase exata exibida, pra auditoria), `created_at` timestamptz default now(), `updated_at` timestamptz.
- Duplicado: UPSERT por `email` (atualiza respostas, faixa, pontos, `updated_at`). Nunca duas linhas pro mesmo e-mail.
- Segurança: gravação via **server function** (`src/lib/quiz.functions.ts`), que valida formato e faz o upsert com service role. RLS na tabela com policy deny-all: nenhum acesso anon direto (sem select, sem insert). Decisão de implementação: o PRD sugeria Edge Function, mas o projeto já resolve exatamente esse caso com server function do TanStack Start (mesmo padrão de `lista-espera.functions.ts` e `pesquisa.functions.ts`), com a mesma fronteira de segurança e sem deploy separado.

**LGPD:**

- Checkbox obrigatório, desmarcado por padrão. Texto exato: "Aceito receber meu diagnóstico e conteúdos da Pólia por e-mail. Sem spam, e você sai quando quiser." + link "Política de privacidade".
- URL da política de privacidade: `/privacidade` (já existe no site). Dependência resolvida.

**Voz e visual (não negociável):**

- Tokens e fontes do `src/styles.css` (fonte de verdade). Contraste AA (usar os valores corrigidos de `--muted`/`--secondary-text` registrados).
- Léxico banido: sem travessão, margem, etapa, trilha, marco, tom de coach, promessa com prazo ou cifra. Palavras do público entram: no chute, no escuro, quanto sobra, remoendo.
- CTAs na gramática da marca: 1ª pessoa do desejo ("Quero descobrir", "Quero meu diagnóstico"), navegação com seta →.
- Mobile-first (o tráfego vem do webview do Instagram). Testar NO webview.

**Métrica e instrumentação:**

- 3 eventos: `quiz_iniciado`, `quiz_concluido` (8 respostas), `lead_gravado`. Disparados no analytics próprio (`src/lib/analytics.ts` → tabela `eventos_analytics`) e, quando o GA estiver configurado, também no GA4 via `gtagEvent` (o componente já existe; falta o `VITE_GA_MEASUREMENT_ID`). Sem GA no ar, os três eventos já ficam medidos pelo analytics próprio.

## 6. Hipótese e métrica observável

**Hipótese:** acreditamos que trocar o link da bio de lista de espera fria por um quiz diagnóstico vai fazer a visitante do perfil virar e-mail numa taxa muito maior, construindo a lista da oferta de fundadora antes de outubro.

**Métrica observável:** taxa e-mails gravados / quizzes iniciados (proxy no v1: leads por semana no Supabase).

**Sucesso:** _Sugestão (confirmar):_ 20% ou mais dos que iniciam deixam e-mail nas primeiras 2 semanas com tráfego dos posts. **Falha:** menos de 8%: rever o gate (talvez a faixa esteja entregando demais de graça) ou a promessa do post que manda pro link.

## 7. Definition of Done + o que testar

**Aceite:**

- [ ] As 8 perguntas na ordem, com os textos exatos deste PRD.
- [ ] Pontuação, faixas e território fraco batendo com a régua da Seção 5 (incluindo o desempate).
- [ ] Gate: botão só habilita com e-mail válido + checkbox; estado "Enviando..." desabilita o botão.
- [ ] Upsert por e-mail (testar enviando 2x com o mesmo e-mail: 1 linha).
- [ ] Erro de rede preserva as respostas e permite reenvio.
- [ ] Voltar preserva a resposta selecionada.
- [ ] Sem travessão e sem palavra banida em nenhum texto da página.
- [ ] AA de contraste; testado em viewport 390px e no webview do Instagram.

**Testar de verdade (o risco real):** a matriz de pontuação (16 combinações de borda: tudo A, tudo C, empates de território), o toque duplo no envio, e o upsert. Não gastar teste com: renderização das alternativas, navegação linear simples.

## 8. Pendências fora deste PRD

Registradas na fase "Do zero": provedor dos 3 e-mails da sequência; tagueamento GA (`VITE_GA_MEASUREMENT_ID`).
