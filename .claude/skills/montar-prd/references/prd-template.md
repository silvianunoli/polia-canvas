# PRD — [FEATURE] · [PRODUTO]

> Instrumento de engenharia, não documentação. Copie um por feature.

## Parte 1 — Shaping
### 1.1 Problema
- Qual problema resolve: [ ]
- O que está quebrado hoje: [ ]
- Quem é impactado: [ ]
- Onde aparece no fluxo: [ ]
### 1.2 Apetite (tempo fixo, escopo variável)
- Tempo: ☐ 1 sem ☐ 2 sem ☐ 4 sem ☐ 6 sem
### 1.3 Solução
- Ideia central (1 frase): [ ]
- Requisitos que não podem faltar: [ ]
- Mínimo aceitável se o prazo estourar: [ ]
### 1.4 Rabbit holes: [ ]
### 1.5 No-go's: [ ]

## Parte 2 — Fluxos (ação → resposta do sistema → próxima ação)
- Principal (happy path): [ ]
- Alternativos (cancelar, voltar, editar, pular): [ ]
- Exceção (sem conexão, sem permissão, limite, dado inválido): [ ]

## Parte 3 — Estados, erros e regras
### 3.1 Estados
| Estado | Existe? | Comportamento |
|---|---|---|
| Vazio | | [ ] |
| Carregando | | [ ] |
| Carregado | | [ ] |
| Erro | | [ ] |
| Desabilitado | | [ ] |
| Parcial | | [ ] |
### 3.2 Erros (mensagem exata + recuperação)
| Tipo | Quando | Mensagem | Recuperação |
|---|---|---|---|
| Validação client-side | [ ] | [ ] | [ ] |
| API (400/401/403/404/500/timeout) | [ ] | [ ] | [ ] |
| Negócio (limite/duplicado/expirado) | [ ] | [ ] | [ ] |
### 3.3 Regras
- Permissões por papel: [ ] · Limites por plano: [ ] · Ao atingir limite: [ ]
- Regras de dados: [ ] · Condições entre campos: [ ]

## Parte 4 — Hipótese e métrica observável
- Acreditamos que [mudança] para [usuário] vai gerar [resultado].
- Vamos construir [o quê].
- Válido quando [evidência observável].
- Critério de sucesso: [ ] · Critério de falha: [ ]

## Parte 5 — Definition of Done + o que testar
- Critérios de aceite: [ ]
- DoD: ☐ todos os estados ☐ erros com mensagem+recuperação ☐ responsivo ☐ a11y AA
- NÃO testar (óbvio): [ ] · PRECISA testar (risco real): [ ]

## Parte 6 — Handoff para o Claude Code
```
Implemente [feature] com base neste PRD e no DESIGN.md/CLAUDE.md do projeto.
Foco: fidelidade à LÓGICA (fluxos, estados, erros, regras). Use só os tokens.
1. Liste os estados que vai implementar e confirme cobertura.
2. Mostre wireframe cinza primeiro para eu validar a estrutura.
Depois revise contra este PRD e o checklist; liste o que faltou.
```
