# DESIGN.md — Pólia

> Especificação visual da marca. Mora no repo; a IA é obrigada a seguir.
> Regra-mãe: o "cara de IA" é aditivo (enfeite a mais); o antídoto é subtrativo (tire).
> Extraído por engenharia reversa de `src/styles.css` (fonte da verdade). Onde diz `[PROPOSTO — confirme]`, é leitura de marca a validar, não fato do código.

## 1. Tema e atmosfera
- Mundo visual (nome no código): **Territorial Diurno** — creme + terracota + mostarda + marrom, tudo em oklch.
- Atmosfera visual (tradução da personalidade do `BRAND.md`): **terroso, territorial, artesanal**. A personalidade verbal (acolhedora, direta, autêntica) vira, no visual, calor humano + terra + feito à mão.
- A marca NÃO é (fonte: Branding v2): **rosa e fofa** (clichê feminino), corporativa fria, nem o roxo/azul genérico de ferramenta de produtividade. Também não é o antigo mundo cósmico/noturno (em remoção).
- Densidade: média, arejada (respiro e acolhimento; fundos creme com espaço).
- Filosofia em 1 frase: um território de trabalho que parece papel pautado e carimbo, não um dashboard de SaaS.

## 2. Cor (tokens semânticos — Mundo Territorial, padrão)
Base neutra quente + terracota como ação. Valores reais do `:root`.

| Token | Hex | oklch | Uso |
|---|---|---|---|
| `--background` | #FDF8F5 | 0.976 0.009 60 | fundo da página (creme) |
| `--foreground` | #1A1A2E | 0.196 0.04 280 | texto principal (noite) |
| `--card` | #FFFFFF | 1 0 0 | fundo de cards |
| `--primary` | #C96B3E | 0.652 0.137 45.5 | ação principal, foco, ring (terracota) |
| `--accent` | #C8A96E | 0.733 0.092 80 | destaque secundário (dourado) |
| `--secondary` / `--muted` | #F5F5FA | 0.969 0.005 280 | superfícies neutras |
| `--muted-foreground` | ~#7A7A85 | 0.5 0.02 280 | texto secundário |
| `--border` | ~#E6E1DB | 0.9 0.01 60 | bordas/divisórias |
| `--input` | ~#EBE6E0 | 0.92 0.008 60 | borda de campos |
| `--destructive` | ~#D33A2C | 0.577 0.245 27.325 | erro/perigo |

## 3. Paleta Pólia nomeada (utilitários `bg-polia-*`, `text-polia-*`)
| Token | Hex | Uso |
|---|---|---|
| `--polia-terracota` | #C96B3E | marco preenchido, ação |
| `--polia-terracota-glow` | #E89770 | halo/pulse de marco em curso |
| `--polia-musgo` | #2D6A4F | apoio |
| `--polia-dourado` | #C8A96E | accent, selo |
| `--polia-mostarda` | #D4A574 | highlight de palavra-chave |
| `--polia-mostarda-intenso` | #B8862E | selos cerimoniais |
| `--polia-marrom` | #3A2A1F | texto/marco concluído |
| `--polia-cinza-areia` | #C9BFB2 | marco "a caminho" |
| `--polia-papel-creme` | #F5EFE5 | papel pautado |
| `--polia-creme` | #FDF8F5 | fundo |
| `--polia-noite` | #1A1A2E | texto |

### Cores de fase da jornada (semânticas de domínio, não decorativas)
`--polia-sonho` #C9407A · `--polia-construcao` #1A7FAD · `--polia-venda` #1A8F5C · `--polia-evolucao` #6B50CC.
Use SÓ para diferenciar fase/etapa. Fora disso, a cor de ação é a terracota.

## 4. Tipografia
- Títulos (h1–h4): **DM Serif Display**, `letter-spacing: -0.01em`.
- Corpo/UI: **Inter**.
- Apoio: **DM Sans** (`--font-accent`).
- Manuscrito decorativo: **Caveat** (`--font-handwritten`).
- Regras: máx ~70 caracteres por linha; corpo ≥16px.

### Regras da Caveat (inegociáveis, já no CSS)
- Piso de tamanho 18px (20px no mobile). Nunca menor.
- `opacity` travada em 1 (a Caveat some se rebaixada). Nunca aplique opacity em texto manuscrito.
- Três tamanhos canônicos, use sempre um: `.caveat-decorativo` (18), `.caveat-informacional` (20), `.caveat-cta` (18).
- Contraste AA: sobre fundo claro use `#9A7728` (`.caveat-on-light`); sobre fundo escuro use `#C8A96E` (`.caveat-on-dark`).

## 5. Espaçamento, raio, elevação
- Escala base 4: 4 8 12 16 24 32 48 64 96 128.
- Raio base `--radius: 0.75rem` (12px). Escala: sm (−4px), md (−2px), lg (base), xl (+4), 2xl (+8), 3xl (+12), 4xl (+16).
- Sombra: separe por borda 1px (`--border`). Sombra só onde de fato flutua (popover, dialog). Sem sombra grande/colorida.

## 6. Ícones, imagem, motion
- Ícones: **lucide** (outline, mono). Sem emoji como ícone, sem ícone 3D/colorido.
- Imagem: ilustração própria territorial. A mascote (raposa) tem estados: feliz, curiosa, descansando, orientando, pensativa, comemorando. Direção: terrosa, manuscrita, nada de 3D genérico ou foto de banco.
- Motion: 150–250ms. Animações nomeadas no CSS: `polia-respiracao`, `polia-trilha-desenha`, `polia-carimbo`, `polia-pulse-dot`. Proibido parallax pesado e gradiente animado.

## 7. Acessibilidade (já implementada — manter como piso)
- `:focus-visible` global: outline 2px terracota, offset 2px (dourado sobre fundo escuro).
- Skip link presente (`.skip-link`).
- Contraste AA garantido nos utilitários Caveat.
- Toda nova tela mantém foco visível, navegação por teclado e contraste AA.

## 8. Dívida conhecida: tema `.cosmic` (legacy, em remoção)
O código carrega um segundo mundo, `.cosmic` (fundo noite), da fase anterior. Está sendo aposentado pela "virada terrena" (2026-06) e mantido SÓ para não quebrar `AuthShell` e as telas de Conclusão de etapa.
- NÃO aplique `.cosmic` em containers raiz.
- Código novo usa exclusivamente o Territorial Diurno.
- Meta: zerar o uso de `.cosmic` (item de backlog, ver `plano-de-iteracao`).

## 9. Referências de qualidade (mire neste nível)
Referência de *feeling* (do Branding v2, não copiar): **Notion, Linear, Duolingo, Vercel, Framer** — modernidade, clareza e personalidade sem sacrificar um pelo outro. Some a camada editorial/artesanal (serif + papel + manuscrito) que é só da Pólia.
NÃO se inspire em dashboards genéricos roxo-azulados nem em estética "rosa e fofa".

## 10. Tokens (fonte da verdade: `src/styles.css`)
Não duplicar valores aqui. O `@theme inline` + `:root` do `styles.css` é a fonte. Este DESIGN.md é a régua de uso; o CSS é a implementação. Qualquer cor nova entra primeiro como token no `styles.css`, nunca hardcoded no componente.
