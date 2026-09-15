# DESIGN.md · Pólia

> Especificação visual da marca. Mora no repo; a IA é obrigada a seguir.
> Regra-mãe: o "cara de IA" é aditivo (enfeite a mais); o antídoto é subtrativo (tire).
> Hierarquia de fonte da verdade (ver §15): `src/styles.css` → `CLAUDE.md` → `BRAND.md` → este arquivo. O `DESIGN.md` define **uso**, não cria valor: não pode existir aqui cor, raio, espaçamento ou fonte que contradiga o CSS ou as decisões travadas no `BRAND.md`.
>
> **Revisão cirúrgica 2026-09-15:** ajuste de precisão pra subordinar este arquivo às decisões já travadas no `BRAND.md` v4 e no manual de marca atualizado — não é redesign, paleta/espaçamento/raio/direção editorial/fotografia/Lucide/motion continuam os mesmos. Mudou: (1) tipografia — Caveat sai da especificação de manuscrito decorativo, entra **Anzylna** (peso regular obrigatório; piso de tamanho e opacidade ainda em confirmação visual, não travados aqui como número); (2) entrou o princípio visual número-primeiro (§0) e a régua "personalidade dá caráter à clareza, não esconde ela"; (3) seção própria pra Aimer (§7), consolidando que ela é narrativa, não elemento de interface; (4) seção "MORTO" única (§16) reunindo raposa/mascote/territorial/cosmic/Caveat/rosa-cute/3D-genérico num só lugar; (5) seção de logo (§12), escrita a partir do componente real (`src/components/brand/PoliaLogo.tsx`), não de memória; (6) régua por tipo de superfície (§13); (7) a auditoria de código (contagem de ocorrências, exceção de rota) saiu das regras permanentes e virou anexo datado (§18), pra não envelhecer disfarçada de regra.
> **Migração concluída em 2026-09-15:** Caveat → Anzylna migrada no código e nos dois `CLAUDE.md` (raiz e `polia-app/`). Anzylna é fonte paga (Cititype/MyFonts), self-hosted via `@font-face` em `src/styles.css` (`public/fonts/Anzylna-Regular.ttf`, peso único Regular), não vem mais do Google Fonts. `--font-handwritten` e as classes `.anzylna-decorativo`/`.anzylna-informacional` (antigas `.caveat-decorativo`/`.caveat-informacional`) já apontam pra ela. Nenhum componente usava as classes antigas ainda (grep confirmou), então a troca de nome não quebrou tela nenhuma. Piso de tamanho (18/20px) e opacity 1 foram herdados da regra antiga da Caveat — ainda não têm confirmação visual própria pra Anzylna, não tratar como validado.
> Reescrito 2026-07-23 pra refletir a paleta v3, em uso em 100% das rotas do produto (escopo `.polia-v3` em `src/styles.css`). A v1 (Territorial Diurno: creme/terracota/mostarda/marrom) foi removida do código nesta mesma passada, não sobra token, componente nem histórico dela no repo. Verificado no código em 2026-07-30: nenhuma ocorrência de `#C96B3E`, `#FDF8F5`, `oklch` ou `.cosmic` em `src/`.
> **Revisão 2026-07-30:** corrigidas duas afirmações que o código desmentia. (1) A seção de acessibilidade declarava contraste AA garantido; a medição real reprova dois tokens nos fundos do produto (tabela no anexo, §18). (2) A mascote raposa tinha direção "terrosa" (paleta rejeitada); ela não existe no código e a copy de `/sobre` nega ter mascote.

## 0. Princípio mestre — número-primeiro

Tradução visual do eixo travado no `BRAND.md`: **o número abre, a marca aprofunda.** Hierarquia visual de referência:

**número → interpretação → decisão → ação → camada de marca**

Números que podem receber grande destaque visual: quanto sobra, quanto precisa entrar, quanto falta pra meta, preço, custo, lucro, quantidade de vendas, progresso concreto. Isso **não** significa transformar a interface num dashboard financeiro — significa que, quando existe um número que resolve a dúvida da usuária, ele precisa ser visualmente encontrável antes do elemento decorativo. Deriva direto do eixo do `BRAND.md`: headline, primeiro benefício e CTA abrem pelo dinheiro (ver `BRAND.md` §1 e §6).

**A personalidade visual existe para dar caráter à clareza, não para escondê-la.** A interface primeiro é compreensível; depois a usuária percebe personalidade. Elemento editorial, manuscrito, fotografia, cor ou composição nunca disputa atenção com número, decisão, CTA, informação financeira ou próximo passo.

**Produto e narrativa seguem réguas diferentes** (ver §13 pra detalhe por superfície):
- **Produto:** clareza → leitura → decisão → ação.
- **Narrativa** (social, Reels, novelinha da Aimer): personagem → cena → emoção → história → personalidade → marca.

Não fazer o produto parecer um Reel, nem fazer os Reels parecerem tela de SaaS.

## 1. Tema e atmosfera
- Mundo visual (nome no código): **Pólia v3**, pedra/creme neutro, turquesa, pêssego, amarelo pontual, tinta quase preta.
- Atmosfera visual (tradução da personalidade do `BRAND.md`): editorial contemporâneo, não dashboard de SaaS genérico. Calor humano sem cair em rosa-e-fofo nem em roxo-azulado de ferramenta de produtividade.
- Densidade: média, arejada (respiro e acolhimento; fundos claros com espaço). Alinhe à esquerda por padrão.
- Filosofia em 1 frase: um lugar de trabalho claro e contemporâneo, sem enfeite, onde o número aparece antes do resto (ver §0).

## 2. Cor (tokens semânticos, fonte real: `.polia-v3` em `src/styles.css`)
Base neutra de pedra + turquesa como ação. Regra de contraste: pêssego e turquesa-clara SÓ em fundo/borda/gráfico, nunca em texto corrido. Texto pequeno sempre em `--ink` ou `--ink-soft` (ver o aviso de contraste na seção 11 antes de usar `--muted` ou `--secondary-text`).

| Token | Hex | Uso |
|---|---|---|
| `--bg` | #F2F0ED | fundo de página (pedra) |
| `--surface` | #F9EFEE | superfície de card/painel |
| `--surface-pink` | #F6DAD4 | superfície de destaque pontual |
| `--line` | #E6E6E6 | bordas/divisórias |
| `--ink` | #0A0A0A | texto principal (tinta) |
| `--ink-soft` | #2C2C2C | texto secundário |
| `--muted` | #767676 | metadado, texto apagado. **Reprova AA sobre `--bg`, `--surface` e `--surface-pink`: só texto grande.** Ver seção 11 |
| `--accent` | #F3B9A9 | pêssego, fundo/borda/gráfico, NUNCA texto |
| `--accent-ink` | #2C2C2C | texto sobre `--accent` |
| `--secondary` | #7CCBCD | turquesa, ação principal (fundo de botão/banner) |
| `--secondary-light` | #BFE9EB | turquesa clara, fundo de destaque leve |
| `--secondary-ink` | #0A0A0A | texto sobre `--secondary` |
| `--secondary-text` | #2C7E80 | turquesa escura, TEXTO de link/CTA. **Reprova AA sobre `--bg` e `--secondary-light`.** Ver seção 11 |
| `--highlight` | #FFC629 | amarelo, indicador pontual, no máximo um por tela |
| `--highlight-ink` | #0A0A0A | texto sobre `--highlight` |
| `--danger` | #C0392B | vermelho-tijolo, erro, ação destrutiva (AA em fundo claro) |
| `--danger-soft` | #FBEAE7 | fundo sutil da zona de perigo |
| `--cat-vendas` | #E0A8C0 | categoria "Vendas" do Planner, só fundo/borda/dot |
| `--cat-admin` | #B9B2A6 | categoria "Admin" do Planner, idem |

Proporção de uso: neutro (pedra + superfície) dominando, tinta no texto, turquesa onde se clica, pêssego em apoio, amarelo como acento único.

**Interpretação estratégica dos três tons de acento (2026-09-15), pra não virar linguagem genérica de SaaS:**
- **Turquesa = ação**, não "tecnologia". É onde se clica, nunca um enfeite de marca-tech.
- **Amarelo = interrupção/destaque pontual**, não decoração recorrente. Se aparece mais de uma vez por tela, perdeu a função.
- **Pêssego = calor/apoio**, não hierarquia principal. Segura a composição, não compete com o número nem com o CTA.

> **Comentário errado no CSS:** a linha de `--muted` em `src/styles.css` diz "AA: ~4.5:1 sobre branco". A medida é verdadeira contra `#FFFFFF` e irrelevante para o produto, que nunca usa branco puro como fundo de página. Corrigir o comentário junto com o token.

### Bridge pra componentes shadcn (Switch, Tooltip, AlertDialog, Popover, Select)
Primitivos shadcn (Radix) usam por padrão `--primary`/`--background`/`--accent`/`--border`/`--input`/`--ring`/`--popover`, que não fazem parte do vocabulário v3 acima. Dois casos:
- **Não portalado** (Switch, Checkbox): herda direto do `.polia-v3`, que já remapeia esses nomes (`--primary: var(--secondary)`, `--background: #ffffff`, etc.), não precisa de nada extra no componente.
- **Portalado** (Tooltip, AlertDialog, Popover, Select, renderizam em `document.body`, fora da árvore `.polia-v3`): aplique `className="polia-v3"` + `style={TOKEN_BRIDGE_V3}` (de `src/lib/uiTokenBridge.ts`) no `Content` do componente. Ver exemplos em `planner.$slug.tsx`, `calendario.tsx`, `Sidebar.tsx`.

Cor nova entra primeiro como token em `src/styles.css` (`@theme inline` + `.polia-v3`), nunca hardcoded no componente.

## 3. Tipografia

| Uso | Fonte |
|---|---|
| H1–H6 | **Cabinet Grotesk** |
| Corpo e interface | **Inter** |
| Acento editorial pontual | **Fraunces Italic** |
| Manuscrito decorativo | **Anzylna** |
| Labels em caixa alta | **DM Sans Bold (700)** |

- Títulos (h1 a h6): **Cabinet Grotesk**, aplicado globalmente por padrão (não precisa da classe `.font-cabinet`, só use a classe quando quiser Cabinet Grotesk num elemento que não é h1-h6, ex.: número decorativo, wordmark).
- Corpo/UI: **Inter** (`--font-sans`).
- Apoio/label em caixa alta: **DM Sans Bold** (`--font-accent`).
- Itálico de acento (pull-quote, saudação tipo "Bom dia, [nome]."): **Fraunces** (`.font-fraunces`), sempre itálico. Cabinet Grotesk não tem peso itálico, então Fraunces fica restrita a esse uso pontual — **nunca título, nunca logo** (o logo é vetor, não texto — ver §12).
- Manuscrito decorativo: **Anzylna**, peso regular (obrigatório). **Piso de tamanho e opacidade ainda não têm confirmação visual** — não travar aqui um número que ainda é hipótese. Até a confirmação, tratar como as regras que já existiam pra manuscrito no produto (nunca abaixo de um piso legível, nunca com opacidade reduzida a ponto de sumir) sem inventar um valor específico de px ou opacity que ninguém decidiu.
- **Caveat está morta como fonte da identidade** (ver §16). Não é intercambiável com Anzylna, não é fallback dela, não volta pra peça nova.
- Regras: máx ~70 caracteres por linha; corpo ≥16px.
- ~~**Peso morto (2026-07-30):** `DM Serif Display` continua sendo baixada no link de fontes do `__root.tsx`.~~ **Resolvido em 2026-08-12:** removida da URL do Google Fonts. O `SerifHeadline` do `AuthShell` renderiza `.font-cabinet`, o nome do componente é que ficou herdado.

## 4. Espaçamento, raio, elevação
- Escala base 4: 4 8 12 16 24 32 48 64 96 128.
- Raio base `--radius: 0.75rem` (12px). Escala: sm (−4px), md (−2px), lg (base), xl (+4), 2xl (+8), 3xl (+12), 4xl (+16).
- Sombra: separe por borda 1px (`--line`). Sombra só onde de fato flutua (popover, dialog). Sem sombra grande/colorida, sem gradiente, sem glassmorphism.
- **Espaço vazio é ferramenta de hierarquia, não falta de conteúdo** (2026-09-15). Ele existe pra ajudar a usuária a, nesta ordem: 1) encontrar o número; 2) entender o que ele significa; 3) perceber a decisão; 4) encontrar a ação.

## 5. Cards e composição (2026-09-15)
- Card existe para agrupar informação ou decisão — nunca só pra "embelezar" a tela.
- Evite card dentro de card.
- Evite 3 cards visualmente idênticos quando uma composição editorial resolve melhor (ex.: lista, tabela, texto corrido com números destacados).
- Não transforme cada informação isolada num bloco separado — volta a régua subtrativa do topo: "cara de IA é aditiva; o antídoto é subtrativo."

## 6. Ícones, imagem, motion
- Ícones: **lucide** (outline, mono). Sem emoji como ícone, sem ícone 3D/colorido.
- **Fotografia — trabalho real + decisão real.** Direção que está no ar (moodboard de 24/07): a conta sendo feita com caneca turquesa ao lado, a costura, a etiqueta de preço, os produtos prontos, os materiais, a mesa vista de cima, a embalagem, a organização de pedido — contexto real de trabalho. Evitar: mulher sorrindo genericamente pro notebook, pose corporativa, banco de imagem óbvio, lifestyle sem relação com decisão, dinheiro voando, nota/moeda em composição conceitual, foguete, seta de crescimento, gráfico 3D genérico, imagem de "sucesso fácil".
- **Motion — estado, não espetáculo (2026-09-15).** 150 a 250ms. Movimento existe pra comunicar mudança de estado, relação ou consequência, nunca pra demonstrar tecnologia.
  - **Sim:** botão mudando de estado, número atualizando, item entrando, confirmação, transição funcional.
  - **Não:** parallax pesado, gradiente animado, animação ornamental, elemento flutuando sem função, efeito "futurista de IA".

## 7. Feminino sem clichê

A feminilidade da Pólia vem do repertório e das situações retratadas (ver fotografia em §6 e personalidade no `BRAND.md`), nunca de clichê visual. Proibido:

rosa como representação automática de mulher; corações; flores; ilustração fofa; estética de papelaria; excesso de manuscrito; glitter; "girlboss"; estética infantilizada.

## 8. Aimer — regra visual (2026-09-15)

**Aimer é uma personagem ficcional gerada por IA e presença narrativa da Pólia** (detalhe estratégico completo em `BRAND.md` §11). Ela:

- não é Ana; não é Sil; não é uma pessoa real;
- não é mascote (ver §16 — a raposa morreu e não se substitui por nenhuma outra);
- não deve virar ícone do produto nem ser tratada como avatar genérico de suporte;
- precisa manter continuidade visual quando reaparece (mesma aparência, mesmo estilo, entre episódios).

A ficção assumida é o que resolve a questão de uma personagem fotorrealista gerada por IA existir sem se passar por pessoa real (detalhe da regra em `BRAND.md` §11).

**Uso prioritário:** Reels, novelinha, conteúdo social, campanha, peça narrativa — situação em que a personagem esteja efetivamente vivendo uma cena. **Não inserir Aimer automaticamente** em Dashboard, Home, tela funcional, formulário, mensagem de erro ou componente de interface só porque "precisa humanizar". Aimer é protagonista da narrativa, não decoração da interface.

## 9. Progresso como linguagem visual (2026-09-15)

O valor "progresso real, não vaidade" (`BRAND.md` §9) vira, na tela, prioridade para: percentual real, quantidade concluída, quantidade restante, meta, etapa/módulo real do Planejamento, estado concluído, número concreto.

Evitar: troféu, medalha, foguete, confete, "parabéns!!!", gamificação infantil, barra puramente decorativa.

A ideia: **mostrar avanço, não fabricar sensação de avanço.**

## 10. Referências de qualidade (mire neste nível)
Referência de *feeling* (não copiar): **Notion, Linear, Duolingo, Vercel, Framer**, por modernidade, clareza e personalidade sem sacrificar um pelo outro. Some a camada editorial/artesanal (serif pontual + manuscrito) que é só da Pólia.
NÃO se inspire em dashboards genéricos roxo-azulados nem em estética "rosa e fofa".

## 11. Acessibilidade
Piso implementado e a manter:
- `:focus-visible` global: outline 2px turquesa (`#7CCBCD`), offset 2px.
- Skip link presente (`.skip-link`), fundo turquesa/texto tinta ao focar.
- Navegação por teclado e label em todo campo; `FieldError` ligado por `aria-describedby`.
- Toda nova tela mantém foco visível, navegação por teclado e contraste real conferido — **não** "contraste AA garantido" como promessa geral (ver por quê abaixo).

**A promessa correta não é "todos os tokens garantem WCAG AA".** Dois tokens reprovam AA em texto pequeno nos fundos reais do produto — `--muted` e `--secondary-text` (medição completa no anexo, §18). Enquanto eles não forem corrigidos (escurecer perto de `#6B6B6B` e `#24696B`, ou restringir a texto grande), **peça nova usa `--ink` ou `--ink-soft` pra texto pequeno**, nunca `--muted` nem `--secondary-text` fora de texto grande (≥24px, ou ≥18,66px bold).

## 12. Logo

Fonte real: `src/components/brand/PoliaLogo.tsx`. Dois exports, os únicos que existem — não criar um terceiro nem redesenhar o logo no código:

- **`PoliaWordmark`** — símbolo + trilha de 3 pontos + a palavra, tudo desenhado como SVG vetorial (não é texto com fonte — não existe questão de Fraunces ou qualquer outra fonte aqui). O traço principal herda `currentColor` (tinta em fundo claro, `--bg` em fundo escuro); os 3 pontos da trilha usam sempre os tokens de acento (`--secondary`/`--accent`/`--highlight`), fixos independente do fundo de cor do traço. Precisa estar dentro do escopo `.polia-v3`.
- **`PoliaIcon`** — símbolo isolado (a marca sem a palavra, com uma versão reduzida da trilha de pontos), para espaço pequeno: sidebar colapsada, avatar, favicon. Mesma regra de cor da wordmark.

**Pendência registrada (não é convite a redesenhar agora):** os três pontos da trilha perdem legibilidade em tamanho muito pequeno, e ainda falta decidir uma versão simplificada pra quando só cabe 1–2 pontos. Isso é uma nota de acompanhamento, não uma instrução pra gerar variação nova sem pedido explícito.

## 13. Régua por tipo de superfície (2026-09-15)

Cada superfície segue uma sequência própria, todas nascendo da divisão produto/narrativa do §0:

| Superfície | Sequência |
|---|---|
| Produto (telas logadas) | clareza → número → decisão → ação |
| Home / conversão | problema → número → benefício → produto → ação |
| `/sobre` | fundadora → história → método → marca → produto |
| Social | cena → reconhecimento → emoção → insight → marca |
| Novelinha da Aimer | personagem → acontecimento → continuidade → Pólia |

## 14. Tokens (fonte da verdade: `src/styles.css`)
Não duplicar valores aqui. `@theme inline` + `.polia-v3` do `styles.css` são a fonte. Este DESIGN.md é a régua de uso; o CSS é a implementação. Qualquer cor nova entra primeiro como token no `styles.css`, nunca hardcoded no componente.

## 15. Hierarquia de fontes da verdade

**Os valores visuais vêm do CSS. O `DESIGN.md` define uso, não cria valor.** Ordem de autoridade, do mais concreto ao mais estratégico:

1. `src/styles.css` — implementação real (hex, raio, espaçamento).
2. `CLAUDE.md` (raiz e `polia-app/`) — restrição de execução e léxico.
3. `BRAND.md` — decisão estratégica de marca (posicionamento, promessa, personalidade, valores).
4. Este `DESIGN.md` — tradução visual das decisões acima em regra de uso.

Este arquivo não pode criar cor, raio ou espaçamento que contradiga o CSS, nem princípio que contradiga o `BRAND.md`. Quando um contradiz o outro (ver a pendência Caveat/Anzylna no topo do arquivo), o conflito fica registrado explicitamente até ser resolvido, nunca escondido.

## 16. MORTO — não usar, não recriar, não substituir por equivalente

- **Caveat** como fonte da identidade. Não é fallback de Anzylna, não é alternativa dela (ver §3).
- **Mascote raposa.** Decisão fechada pela fundadora em 2026-08-12. `docs/fox-prompts-virada-terrena.md` foi deletado do repo nesta data — não existe mais material de referência dela, de propósito. Não existe raposa em `src/` nem em `public/`.
- **Qualquer outra mascote**, de qualquer espécie. Não substituir a raposa por mascote nova.
- **Territorial Diurno** (terracota `#C96B3E`, musgo `#2D6A4F`, dourado `#C8A96E`, creme `#FDF8F5`) e o vocabulário territorial (território, trilha-conceito, marco, carimbo, bússola como mundo visual).
- **Cosmic / tema noturno** (`.cosmic`, fundo escuro alternativo). Removido do CSS em 2026-07-23.
- Estética futurista de IA (gradiente animado, elemento flutuando genérico, glow).
- Rosa/cute como linguagem principal, corações, flores, papelaria, glitter, "girlboss", estética infantilizada (ver §7).
- 3D genérico, "blob", gradiente, glassmorphism, sombra grande/colorida, ícone emoji.
- Dinheiro voando, riqueza fácil, "seis dígitos" como imagem ou copy visual.

## 17. Checklist final — antes de aprovar um visual

- [ ] O número importante aparece antes do enfeite?
- [ ] A hierarquia facilita uma decisão?
- [ ] A identidade visual não compete com a informação?
- [ ] Usa apenas tokens da v3?
- [ ] Não há hex hardcoded?
- [ ] Cabinet está nos títulos?
- [ ] Inter está no corpo/interface?
- [ ] Fraunces está restrita ao acento editorial (itálico, pontual)?
- [ ] O manuscrito, se houver, é Anzylna (nunca Caveat)?
- [ ] DM Sans Bold está restrita aos labels em caixa alta?
- [ ] Não existe raposa nem outra mascote?
- [ ] Não existe Territorial nem Cosmic?
- [ ] A fotografia mostra trabalho/decisão real, não banco de imagem genérico?
- [ ] Aimer só aparece quando há função narrativa (nunca em tela funcional)?
- [ ] O visual trata a usuária como adulta (sem infantilizar, sem clichê feminino)?
- [ ] O movimento comunica estado, não espetáculo?
- [ ] O contraste foi conferido no fundo real (não `--muted`/`--secondary-text` em texto pequeno)?
- [ ] Existe espaço suficiente para leitura?
- [ ] O visual deixa sensação de clareza, não de excesso?

---

## 18. Anexo — auditoria do código (não é regra permanente, é fotografia datada)

> Esta seção registra o estado do código numa data específica. Ela envelhece; as seções acima, não. Reler antes de confiar no número.

**Medição de contraste (2026-07-30).** A afirmação anterior ("contraste AA garantido") não se sustentava: a medida de `--muted` no comentário do CSS era contra branco puro, e nenhuma tela do produto usa branco puro como fundo de página. O fundo real é `--bg`.

| par | contraste | AA texto pequeno (4,5:1) |
|---|---|---|
| `--muted` #767676 sobre `--bg` #F2F0ED | 3,99:1 | reprova |
| `--muted` sobre `--surface` #F9EFEE | 4,03:1 | reprova |
| `--muted` sobre `--surface-pink` #F6DAD4 | 3,44:1 | reprova |
| `--secondary-text` #2C7E80 sobre `--bg` | 4,19:1 | reprova |
| `--secondary-text` sobre `--secondary-light` #BFE9EB | 3,65:1 | reprova |

Passam com folga: `--ink` sobre qualquer fundo claro (15:1 a 17,5:1), `--ink-soft` sobre `--secondary-light` (10,7:1) e sobre `--accent` (8,2:1), `--ink` sobre `--highlight` (12,6:1) e sobre `--secondary` (10,6:1). Em texto grande (≥24px, ou ≥18,66px bold) o piso é 3:1 e os dois tokens passam — o problema é metadado, label e link em tamanho de corpo.

**Cobertura da identidade (verificado em 2026-07-30).** `.polia-v3` aparece 86 vezes em 50 arquivos de `src/`, cobrindo todas as rotas públicas e as 22 telas logadas. As rotas de `auth/` herdam de `AuthShell`. **Exceção conhecida:** `src/routes/auth/link-expirado.tsx` não tem `polia-v3` nem importa `AuthShell` — é a única rota renderizável fora do escopo da identidade. Corrigir.

**Pasta `src/components/cosmic/`** sobrevive como nome de pasta desde a remoção do tema `.cosmic`; o conteúdo dela já usa tokens v3 (não é resíduo funcional, só o nome ficou).
