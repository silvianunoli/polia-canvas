# Plano · 25 ajustes UI/UX Pólia

Antes de começar, alguns pontos que precisam de decisão sua, mais o roteiro de execução.

## Decisões pendentes (preciso de resposta sua antes de codar)

1. **Storage de assets ([F0.A])** — o `PlaceholderImage` faz upload pra onde?
   - (a) Supabase Storage em bucket `polia-assets` (público, lookup por slot)
   - (b) localStorage só (igual o `UploadablePlaceholder` que já existe)
   - O texto diz "Supabase Storage", mas o componente atual usa localStorage. Confirma se crio bucket novo + migration de RLS?

2. **Store global ([F0.B])** — instalo `zustand` ou uso React Query com `queryKey: ["user-meta"]`? Hoje não tem nenhum dos dois pra isso. Recomendo **React Query** (já está no projeto) pra evitar nova dep.

3. **[P1.11] URL `/clientes`** — mantém `/clientes` ou renomeia pra `/vendas-e-clientes`? Renomear quebra links salvos.

4. **[P2.25] CTA Etapa 4** — confirma `"Vamos preencher os 3 espaços →"` ou prefere outra opção?

5. **Estados da Raposinha ([F0.C])** — o mapa de erros pede estados `confusa` e `esperando` que não estavam na lista original (`feliz, animada, curiosa, amparando, dormindo`). Adiciono os slots vazios pra você subir SVG depois?

## Roteiro de execução

Vou fazer em 3 PRs lógicos (mas tudo no mesmo turno, sem você precisar aprovar entre eles):

### Bloco 1 · Fundação (F0 + P0)
- `src/components/PlaceholderImage.tsx` (substitui/estende `UploadablePlaceholder`)
- `src/components/layout/Header.tsx` global + hook `useUserMeta` (React Query)
- `src/components/layout/ErrorPage.tsx` + mapa de copy
- `src/hooks/useDocumentTitle.ts`
- Wire `__root.tsx` `notFoundComponent` + `errorComponent` em `ErrorPage`
- Aplicar Header em todas rotas `_authenticated`, remover headers locais
- [P0.1] fix card biblioteca de marcos no Painel (usar `BibliotecaCard` real)
- [P0.4] grep + replace Ana → Aimer (só persona, preservando dados reais)
- [P0.5] regra global de cor KPI + fix Retenção D30

### Bloco 2 · P1 pré-launch (P1.7 → P1.18)
- Layouts 2-col com sidebar contextual em clientes/vitrine/biblioteca
- Container 880px em config + biblioteca/[id]
- Kanban min-height + empty states
- Constelação clicável (3 estados)
- H1/nav alignment + sentence case
- Vitrine: 1 chip único colorido por fase + ícone Lock/Check
- `pluralizeKanban()` util
- Conquista da semana com 3 estados (vazio/atual/anterior)
- Filtros Tarefas com chip ativo
- Botão "voltar ao painel" no `EtapaLayout`
- Jornada: remover barra 3/11, substituir por frase Caveat
- Upload foto perfil em Config

### Bloco 3 · P2 refinamento (P2.19 → P2.25)
- Tooltips siglas Admin
- Audit Caveat ≥ 14px
- Fix campo Nome do negócio
- Util `getFaseByEtapa()` aplicado em chips
- Array de mantras rotativo (rotação por dia da semana)
- CTA Etapa 4

### Smoke test final
Rodar checklist nas 9 rotas listadas, reportar findings.

## Escopo estimado
~30-35 arquivos editados/criados. Sem migration de DB exceto se você confirmar (a) na decisão 1.

---

**Me responde as 5 decisões acima e eu executo tudo de uma vez.** Se quiser que eu assuma defaults (React Query, manter `/clientes`, localStorage por enquanto, CTA proposto, adicionar slots novos da Raposa), só dizer "vai com os defaults" que eu sigo.
