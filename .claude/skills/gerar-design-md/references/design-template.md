# DESIGN.md — [NOME DO PRODUTO]

> Especificação visual da marca. Mora no repo; a IA é obrigada a seguir.
> Regra-mãe: o "cara de IA" é aditivo (enfeite a mais); o antídoto é subtrativo (tire).

## 1. Tema e atmosfera
- Três adjetivos-âncora: [ ], [ ], [ ]
- A marca NÃO é: [ ]
- Densidade: ☐ muito espaço ☐ média ☐ densa
- Filosofia em 1 frase: [ ]

## 2. Cor (base neutra + 1 acento)
| Token | Hex | Uso |
|---|---|---|
| `--ink` | [ ] | texto principal |
| `--ink-soft` | [ ] | texto secundário |
| `--muted` | [ ] | legendas/placeholder |
| `--line` | [ ] | bordas/divisórias |
| `--surface` | [ ] | fundo de cards |
| `--bg` | [ ] | fundo da página (off-white quente) |
| `--accent` | [ ] | ação principal, foco |
| `--accent-ink` | [ ] | hover do acento |
| `--success` / `--warning` / `--danger` | [ ] | funcionais, dessaturadas |

## 3. Tipografia
- Display/títulos: [ ]
- Corpo/UI: [ ]
- Escala (px/line-height/peso): display [ ] · h1 [ ] · h2 [ ] · h3 [ ] · corpo [ ] · legenda [ ]
- Regras: máx ~70 caracteres por linha; corpo ≥16px.

## 4. Espaçamento, raio, elevação
- Escala base 4: 4 8 12 16 24 32 48 64 96 128
- Raio: sm [ ] · md [ ] · lg [ ]
- Sombra: separe por borda 1px; sombra só onde flutua: [ ]

## 5. Grid e layout
- Colunas: 12 · container máx: [ ] · gutter: [ ]
- Alinhamento padrão: esquerda. Centralizar só em: [ ]

## 6. Ícones, imagem, motion
- Ícones: [ ] (outline, mono).
- Imagem: ☐ foto dirigida ☐ ilustração própria. Direção: [ ]
- Motion: [150-250ms], easing [ ]. Proibido: parallax pesado, gradiente animado.

## 7. Do's & Don'ts (proibições)
- NUNCA: [ ]
- SEMPRE: [ ]

## 8. Tokens (cole no projeto)
```css
:root {
  --ink:[ ]; --ink-soft:[ ]; --muted:[ ]; --line:[ ]; --surface:[ ]; --bg:[ ];
  --accent:[ ]; --accent-ink:[ ];
  --success:[ ]; --warning:[ ]; --danger:[ ];
  --font-display:"[ ]", serif; --font-sans:"[ ]", system-ui, sans-serif;
  --sp-1:4px; --sp-2:8px; --sp-3:12px; --sp-4:16px; --sp-5:24px;
  --sp-6:32px; --sp-7:48px; --sp-8:64px; --sp-9:96px; --sp-10:128px;
  --radius-sm:[ ]; --radius-md:[ ]; --radius-lg:[ ];
  --shadow-pop:[ ];
}
```
