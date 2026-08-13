# DESIGN.md · Pólia

> Especificação visual da marca. Mora no repo; a IA é obrigada a seguir.
> Regra-mãe: o "cara de IA" é aditivo (enfeite a mais); o antídoto é subtrativo (tire).
> Reescrito 2026-07-23 pra refletir a paleta v3, em uso em 100% das rotas do produto (escopo `.polia-v3` em `src/styles.css`). A v1 (Territorial Diurno: creme/terracota/mostarda/marrom) foi removida do código nesta mesma passada, não sobra token, componente nem histórico dela no repo. Verificado no código em 2026-07-30: nenhuma ocorrência de `#C96B3E`, `#FDF8F5`, `oklch` ou `.cosmic` em `src/`.
> **Revisão 2026-07-30:** corrigidas duas afirmações que o código desmentia. (1) A seção 6 declarava contraste AA garantido; a medição real reprova dois tokens nos fundos do produto, e a tabela está lá agora. (2) A seção 5 prescrevia a mascote raposa com direção "terrosa", que é a paleta rejeitada; a mascote não existe no código e a copy de `/sobre` nega ter mascote. Ver os avisos nas respectivas seções.

## 1. Tema e atmosfera
- Mundo visual (nome no código): **Pólia v3**, pedra/creme neutro, turquesa, pêssego, amarelo pontual, tinta quase preta.
- Atmosfera visual (tradução da personalidade do `BRAND.md`): editorial contemporâneo, não dashboard de SaaS genérico. Calor humano sem cair em rosa-e-fofo nem em roxo-azulado de ferramenta de produtividade.
- A marca NÃO é: rosa e fofa (clichê feminino), corporativa fria, roxo/azul genérico. O mundo cósmico/noturno (`.cosmic`) e o Territorial Diurno (terracota) foram removidos, não existe mais tema alternativo no CSS. A pasta `src/components/cosmic/` sobrevive como nome de pasta; o conteúdo dela já usa tokens v3.
- Densidade: média, arejada (respiro e acolhimento; fundos claros com espaço). Alinhe à esquerda por padrão.
- Filosofia em 1 frase: um território de trabalho claro e contemporâneo, sem enfeite.

## 2. Cor (tokens semânticos, fonte real: `.polia-v3` em `src/styles.css`)
Base neutra de pedra + turquesa como ação. Regra de contraste: pêssego e turquesa-clara SÓ em fundo/borda/gráfico, nunca em texto corrido. Texto pequeno sempre em `--ink` ou `--ink-soft` (ver o aviso de contraste na seção 6 antes de usar `--muted` ou `--secondary-text`).

| Token | Hex | Uso |
|---|---|---|
| `--bg` | #F2F0ED | fundo de página (pedra) |
| `--surface` | #F9EFEE | superfície de card/painel |
| `--surface-pink` | #F6DAD4 | superfície de destaque pontual |
| `--line` | #E6E6E6 | bordas/divisórias |
| `--ink` | #0A0A0A | texto principal (tinta) |
| `--ink-soft` | #2C2C2C | texto secundário |
| `--muted` | #767676 | metadado, texto apagado. **Reprova AA sobre `--bg`, `--surface` e `--surface-pink`: só texto grande.** Ver seção 6 |
| `--accent` | #F3B9A9 | pêssego, fundo/borda/gráfico, NUNCA texto |
| `--accent-ink` | #2C2C2C | texto sobre `--accent` |
| `--secondary` | #7CCBCD | turquesa, ação principal (fundo de botão/banner) |
| `--secondary-light` | #BFE9EB | turquesa clara, fundo de destaque leve |
| `--secondary-ink` | #0A0A0A | texto sobre `--secondary` |
| `--secondary-text` | #2C7E80 | turquesa escura, TEXTO de link/CTA. **Reprova AA sobre `--bg` e `--secondary-light`.** Ver seção 6 |
| `--highlight` | #FFC629 | amarelo, indicador pontual, no máximo um por tela |
| `--highlight-ink` | #0A0A0A | texto sobre `--highlight` |
| `--danger` | #C0392B | vermelho-tijolo, erro, ação destrutiva (AA em fundo claro) |
| `--danger-soft` | #FBEAE7 | fundo sutil da zona de perigo |
| `--cat-vendas` | #E0A8C0 | categoria "Vendas" do Planner, só fundo/borda/dot |
| `--cat-admin` | #B9B2A6 | categoria "Admin" do Planner, idem |

Proporção de uso: neutro (pedra + superfície) dominando, tinta no texto, turquesa onde se clica, pêssego em apoio, amarelo como acento único.

> **Comentário errado no CSS:** a linha de `--muted` em `src/styles.css` diz "AA: ~4.5:1 sobre branco". A medida é verdadeira contra `#FFFFFF` e irrelevante para o produto, que nunca usa branco puro como fundo de página. Corrigir o comentário junto com o token.

### Bridge pra componentes shadcn (Switch, Tooltip, AlertDialog, Popover, Select)
Primitivos shadcn (Radix) usam por padrão `--primary`/`--background`/`--accent`/`--border`/`--input`/`--ring`/`--popover`, que não fazem parte do vocabulário v3 acima. Dois casos:
- **Não portalado** (Switch, Checkbox): herda direto do `.polia-v3`, que já remapeia esses nomes (`--primary: var(--secondary)`, `--background: #ffffff`, etc.), não precisa de nada extra no componente.
- **Portalado** (Tooltip, AlertDialog, Popover, Select, renderizam em `document.body`, fora da árvore `.polia-v3`): aplique `className="polia-v3"` + `style={TOKEN_BRIDGE_V3}` (de `src/lib/uiTokenBridge.ts`) no `Content` do componente. Ver exemplos em `planner.$slug.tsx`, `calendario.tsx`, `Sidebar.tsx`.

Cor nova entra primeiro como token em `src/styles.css` (`@theme inline` + `.polia-v3`), nunca hardcoded no componente.

## 3. Tipografia
- Títulos (h1 a h6): **Cabinet Grotesk**, aplicado globalmente por padrão (não precisa da classe `.font-cabinet`, só use a classe quando quiser Cabinet Grotesk num elemento que não é h1-h6, ex.: número decorativo, wordmark).
- Corpo/UI: **Inter** (`--font-sans`).
- Apoio/label em caixa alta: **DM Sans** (`--font-accent`).
- Itálico de acento (pull-quote, saudação tipo "Bom dia, [nome]."): **Fraunces** (`.font-fraunces`). Cabinet Grotesk não tem peso itálico, então Fraunces fica restrita a esse uso pontual, nunca título e nunca no logo.
- Manuscrito decorativo: **Caveat** (`--font-handwritten`, classes `.caveat-decorativo`/`.caveat-informacional`).
- Regras: máx ~70 caracteres por linha; corpo ≥16px.
- ~~**Peso morto (2026-07-30):** `DM Serif Display` continua sendo baixada no link de fontes do `__root.tsx`.~~ **Resolvido em 2026-08-12:** removida da URL do Google Fonts. O `SerifHeadline` do `AuthShell` renderiza `.font-cabinet`, o nome do componente é que ficou herdado.

### Regras da Caveat (inegociáveis, já no CSS)
- Piso de tamanho 18px (20px no mobile). Nunca menor.
- `opacity` travada em 1 (a Caveat some se rebaixada). Nunca aplique opacity em texto manuscrito.
- Dois tamanhos canônicos, use sempre um: `.caveat-decorativo` (18), `.caveat-informacional` (20).
- Contraste: a cor vem de onde a Caveat está (ex.: `text-[var(--secondary-text)]`), não de token próprio de Caveat.

## 4. Espaçamento, raio, elevação
- Escala base 4: 4 8 12 16 24 32 48 64 96 128.
- Raio base `--radius: 0.75rem` (12px). Escala: sm (−4px), md (−2px), lg (base), xl (+4), 2xl (+8), 3xl (+12), 4xl (+16).
- Sombra: separe por borda 1px (`--line`). Sombra só onde de fato flutua (popover, dialog). Sem sombra grande/colorida, sem gradiente, sem glassmorphism.

## 5. Ícones, imagem, motion
- Ícones: **lucide** (outline, mono). Sem emoji como ícone, sem ícone 3D/colorido.
- Imagem: **fotografia real de trabalho e de decisão**, na paleta v3. A direção que está no ar (moodboard de 24/07) é concreta: a conta sendo feita com caneca turquesa ao lado, a costura, a etiqueta de preço, os produtos prontos, a mesa vista de cima, os materiais. Nada de 3D genérico, "blob", nem foto de banco óbvia ("empreendedora sorrindo para o notebook").
- Motion: 150 a 250ms. Proibido parallax pesado e gradiente animado.

> **Mascote raposa: morta. Decisão fechada pela fundadora em 2026-08-12.**
> A raposa não volta. `docs/fox-prompts-virada-terrena.md` (os 7 prompts de geração, na paleta v1 terracota + creme) foi **deletado do repo** nesta data — não existe mais material de referência dela, de propósito.
> Contexto: não existe raposa em `src/` nem em `public/`, ela já tinha saído do onboarding e das páginas de erro, e a copy de `/sobre` diz "sem tutorial bobo, sem explicar o óbvio, sem mascote fazendo graça".
> **Não gerar mascote nova, de nenhuma espécie.** A imagem da marca é a fotografia real descrita acima. O `CLAUDE.md` foi corrigido na mesma passada.

## 6. Acessibilidade
Piso implementado e a manter:
- `:focus-visible` global: outline 2px turquesa (`#7CCBCD`), offset 2px.
- Skip link presente (`.skip-link`), fundo turquesa/texto tinta ao focar.
- Navegação por teclado e label em todo campo; `FieldError` ligado por `aria-describedby`.
- Toda nova tela mantém foco visível, navegação por teclado e contraste AA.

> **Contraste: dois tokens reprovam nos fundos reais (medido em 2026-07-30).**
> A afirmação anterior ("contraste AA garantido") não se sustenta: a medida de `--muted` era contra branco puro, e nenhuma tela do produto usa branco puro como fundo de página. O fundo real é `--bg`.
>
> | par | contraste | AA texto pequeno (4,5:1) |
> |---|---|---|
> | `--muted` #767676 sobre `--bg` #F2F0ED | 3,99:1 | reprova |
> | `--muted` sobre `--surface` #F9EFEE | 4,03:1 | reprova |
> | `--muted` sobre `--surface-pink` #F6DAD4 | 3,44:1 | reprova |
> | `--secondary-text` #2C7E80 sobre `--bg` | 4,19:1 | reprova |
> | `--secondary-text` sobre `--secondary-light` #BFE9EB | 3,65:1 | reprova |
>
> Passam com folga: `--ink` sobre qualquer fundo claro (15:1 a 17,5:1), `--ink-soft` sobre `--secondary-light` (10,7:1) e sobre `--accent` (8,2:1), `--ink` sobre `--highlight` (12,6:1) e sobre `--secondary` (10,6:1).
>
> Em texto grande (≥24px, ou ≥18,66px bold) o piso é 3:1 e os dois tokens passam. O problema é metadado, label e link em tamanho de corpo.
> Duas saídas: escurecer `--muted` (perto de #6B6B6B) e `--secondary-text` (perto de #24696B), ou restringir esses tokens a texto grande. **Enquanto não resolver, peça nova usa `--ink` e `--ink-soft` para texto pequeno.**

## 7. Referências de qualidade (mire neste nível)
Referência de *feeling* (não copiar): **Notion, Linear, Duolingo, Vercel, Framer**, por modernidade, clareza e personalidade sem sacrificar um pelo outro. Some a camada editorial/artesanal (serif pontual + manuscrito) que é só da Pólia.
NÃO se inspire em dashboards genéricos roxo-azulados nem em estética "rosa e fofa".

## 8. Tokens (fonte da verdade: `src/styles.css`)
Não duplicar valores aqui. `@theme inline` + `.polia-v3` do `styles.css` são a fonte. Este DESIGN.md é a régua de uso; o CSS é a implementação. Qualquer cor nova entra primeiro como token no `styles.css`, nunca hardcoded no componente.

## 9. Cobertura da identidade (verificado em 2026-07-30)
`.polia-v3` aparece 86 vezes em 50 arquivos de `src/`, cobrindo todas as rotas públicas e as 22 telas logadas. As rotas de `auth/` herdam de `AuthShell`.
**Exceção conhecida:** `src/routes/auth/link-expirado.tsx` não tem `polia-v3` nem importa `AuthShell`, é a única rota renderizável fora do escopo da identidade. Corrigir.
