# DESIGN.md — Pólia

> Especificação visual da marca. Mora no repo; a IA é obrigada a seguir.
> Regra-mãe: o "cara de IA" é aditivo (enfeite a mais); o antídoto é subtrativo (tire).
> Reescrito 2026-07-23 pra refletir a paleta v3, em uso em 100% das rotas do produto (escopo `.polia-v3` em `src/styles.css`). A v1 (Territorial Diurno: creme/terracota/mostarda/marrom) foi removida do código nesta mesma passada — não sobra token, componente nem histórico dela no repo.

## 1. Tema e atmosfera
- Mundo visual (nome no código): **Pólia v3** — pedra/creme neutro, turquesa, pêssego, amarelo pontual, tinta quase preta.
- Atmosfera visual (tradução da personalidade do `BRAND.md`): editorial contemporâneo, não dashboard de SaaS genérico. Calor humano sem cair em rosa-e-fofo nem em roxo-azulado de ferramenta de produtividade.
- A marca NÃO é: rosa e fofa (clichê feminino), corporativa fria, roxo/azul genérico. O mundo cósmico/noturno (`.cosmic`) e o Territorial Diurno (terracota) foram removidos — não existe mais tema alternativo no CSS.
- Densidade: média, arejada (respiro e acolhimento; fundos claros com espaço).
- Filosofia em 1 frase: um território de trabalho claro e contemporâneo, sem enfeite.

## 2. Cor (tokens semânticos — fonte real: `.polia-v3` em `src/styles.css`)
Base neutra de pedra + turquesa como ação. Regra de contraste: pêssego e turquesa-clara SÓ em fundo/borda/gráfico, nunca em texto corrido — texto sempre em `--ink`/`--ink-soft`/`--muted` (ou `--secondary-text` pra link/CTA que precisa de AA).

| Token | Hex | Uso |
|---|---|---|
| `--bg` | #F2F0ED | fundo de página (pedra) |
| `--surface` | #F9EFEE | superfície de card/painel |
| `--surface-pink` | #F6DAD4 | superfície de destaque pontual |
| `--line` | #E6E6E6 | bordas/divisórias |
| `--ink` | #0A0A0A | texto principal (tinta) |
| `--ink-soft` | #2C2C2C | texto secundário |
| `--muted` | #767676 | metadado, texto apagado (AA ~4.5:1 sobre branco) |
| `--accent` | #F3B9A9 | pêssego — fundo/borda/gráfico, NUNCA texto |
| `--accent-ink` | #2C2C2C | texto sobre `--accent` |
| `--secondary` | #7CCBCD | turquesa — ação principal (fundo de botão/banner) |
| `--secondary-light` | #BFE9EB | turquesa clara — fundo de destaque leve |
| `--secondary-ink` | #0A0A0A | texto sobre `--secondary` |
| `--secondary-text` | #2C7E80 | turquesa escura — TEXTO de link/CTA (AA ok) |
| `--highlight` | #FFC629 | amarelo — indicador pontual, no máximo um por tela |
| `--highlight-ink` | #0A0A0A | texto sobre `--highlight` |
| `--danger` | #C0392B | vermelho-tijolo — erro, ação destrutiva (AA em fundo claro) |
| `--danger-soft` | #FBEAE7 | fundo sutil da zona de perigo |
| `--cat-vendas` | #E0A8C0 | categoria "Vendas" do Planner — só fundo/borda/dot |
| `--cat-admin` | #B9B2A6 | categoria "Admin" do Planner — idem |

### Bridge pra componentes shadcn (Switch, Tooltip, AlertDialog, Popover, Select)
Primitivos shadcn (Radix) usam por padrão `--primary`/`--background`/`--accent`/`--border`/`--input`/`--ring`/`--popover`, que não fazem parte do vocabulário v3 acima. Dois casos:
- **Não portalado** (Switch, Checkbox): herda direto do `.polia-v3`, que já remapeia esses nomes (`--primary: var(--secondary)`, `--background: #ffffff`, etc.) — não precisa de nada extra no componente.
- **Portalado** (Tooltip, AlertDialog, Popover, Select — renderizam em `document.body`, fora da árvore `.polia-v3`): aplique `className="polia-v3"` + `style={TOKEN_BRIDGE_V3}` (de `src/lib/uiTokenBridge.ts`) no `Content` do componente. Ver exemplos em `planner.$slug.tsx`, `calendario.tsx`, `Sidebar.tsx`.

Cor nova entra primeiro como token em `src/styles.css` (`@theme inline` + `.polia-v3`), nunca hardcoded no componente.

## 3. Tipografia
- Títulos (h1–h6): **Cabinet Grotesk**, aplicado globalmente por padrão (não precisa da classe `.font-cabinet` — só use a classe quando quiser Cabinet Grotesk num elemento que não é h1-h6, ex.: número decorativo, wordmark).
- Corpo/UI: **Inter** (`--font-sans`).
- Apoio/label em caixa alta: **DM Sans** (`--font-accent`).
- Itálico de acento (pull-quote, saudação tipo "Bom dia, [nome]."): **Fraunces** (`.font-fraunces`). Cabinet Grotesk não tem peso itálico — Fraunces fica restrita a esse uso pontual, nunca título.
- Manuscrito decorativo: **Caveat** (`--font-handwritten`, classes `.caveat-decorativo`/`.caveat-informacional`).
- Regras: máx ~70 caracteres por linha; corpo ≥16px.

### Regras da Caveat (inegociáveis, já no CSS)
- Piso de tamanho 18px (20px no mobile). Nunca menor.
- `opacity` travada em 1 (a Caveat some se rebaixada). Nunca aplique opacity em texto manuscrito.
- Dois tamanhos canônicos, use sempre um: `.caveat-decorativo` (18), `.caveat-informacional` (20).
- Contraste: a cor vem de onde a Caveat está (ex.: `text-[var(--secondary-text)]`), não de token próprio de Caveat.

## 4. Espaçamento, raio, elevação
- Escala base 4: 4 8 12 16 24 32 48 64 96 128.
- Raio base `--radius: 0.75rem` (12px). Escala: sm (−4px), md (−2px), lg (base), xl (+4), 2xl (+8), 3xl (+12), 4xl (+16).
- Sombra: separe por borda 1px (`--line`). Sombra só onde de fato flutua (popover, dialog). Sem sombra grande/colorida.

## 5. Ícones, imagem, motion
- Ícones: **lucide** (outline, mono). Sem emoji como ícone, sem ícone 3D/colorido.
- Imagem: ilustração própria territorial. A mascote (raposa) tem estados: feliz, curiosa, descansando, orientando, pensativa, comemorando. Direção: terrosa, manuscrita, nada de 3D genérico ou foto de banco.
- Motion: 150–250ms. Proibido parallax pesado e gradiente animado.

## 6. Acessibilidade (já implementada — manter como piso)
- `:focus-visible` global: outline 2px turquesa (`#7CCBCD`), offset 2px.
- Skip link presente (`.skip-link`), fundo turquesa/texto tinta ao focar.
- Contraste AA garantido nos utilitários Caveat e no par `--secondary`/`--secondary-text`.
- Toda nova tela mantém foco visível, navegação por teclado e contraste AA.

## 7. Referências de qualidade (mire neste nível)
Referência de *feeling* (do Branding v2, não copiar): **Notion, Linear, Duolingo, Vercel, Framer** — modernidade, clareza e personalidade sem sacrificar um pelo outro. Some a camada editorial/artesanal (serif pontual + manuscrito) que é só da Pólia.
NÃO se inspire em dashboards genéricos roxo-azulados nem em estética "rosa e fofa".

## 8. Tokens (fonte da verdade: `src/styles.css`)
Não duplicar valores aqui. `@theme inline` + `.polia-v3` do `styles.css` são a fonte. Este DESIGN.md é a régua de uso; o CSS é a implementação. Qualquer cor nova entra primeiro como token no `styles.css`, nunca hardcoded no componente.
