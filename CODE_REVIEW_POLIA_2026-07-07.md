# Code Review — Pólia v1 (`polia-app`) · 2026-07-07

**Escopo:** toda a base de código do SaaS — 122 arquivos TS/TSX (~26.500 linhas), 29 migrations SQL, 1 edge function, e o estado **real** do banco de produção (`egzwkyqpkexgrhbxwcvb`), verificado via advisors e `pg_policies` (não só o que está versionado).

**Método:** 5 frentes de revisão em paralelo (segurança/banco, lib/hooks, rotas core, rotas secundárias/admin, público/auth) + typecheck, lint e consulta direta ao Postgres.

---

## Veredito: 🟡 REQUEST CHANGES

A base é **bem arquitetada e madura** — o isolamento multi-tenant por RLS é real e foi verificado tabela por tabela no banco; a separação de segredos client/servidor é padrão-ouro; não há nenhum vazamento de leitura cruzada entre usuárias. **Não é Reject nem de longe.**

Mas há **bloqueantes reais** antes de escalar o lançamento: um bug de fuso que distorce receita/meta, mutations otimistas que podem **duplicar lançamento financeiro** silenciosamente, e um punhado de correções de segurança preventiva + anti-spam. São correções pontuais, não reescrita.

---

## 🔴 Bloqueantes (corrigir antes de abrir o lançamento)

### B1 · Bug de fuso: venda do dia 1º não conta no mês (receita/meta subestimadas)
`src/routes/_authenticated/painel.tsx:320,436` e `planejamento.index.tsx:380`

`lancamentos.data` é coluna `DATE` → chega como `"2026-07-01"`. O código faz `new Date("2026-07-01")`, que o JS parseia como **UTC meia-noite**; em GMT-3 (Brasília) `getMonth()`/`getDate()` local voltam para **o último dia do mês anterior**. Resultado: toda venda registrada no **dia 1º** some da receita e da contagem de pedidos do mês — silenciosamente. A headline "Faltam R$ X pra fechar a Meta" fica errada.

O `financeiro.tsx` **já faz certo** (usa `split("-")` em `mesAnoDe`) e `planner.$slug.tsx:153` tem um comentário explicando exatamente por que não usar `new Date("YYYY-MM-DD")`. As outras rotas regrediram.

**Correção** — comparar por prefixo de string, sem `Date`:
```ts
const agora = new Date();
const prefixoMes = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}`;
for (const l of dados?.lancamentos ?? []) {
  if (l.tipo !== "entrada") continue;
  if (!l.data.startsWith(prefixoMes)) continue; // "2026-07-01".startsWith("2026-07")
  receita += Number(l.valor);
  pedidos += 1;
}
```

### B2 · `clientes.tsx`: falha parcial pode DUPLICAR lançamento financeiro
`src/routes/_authenticated/clientes.tsx:236-261`

`registrar` insere em `lancamentos` e depois marca `clientes.venda_registrada = true`. Se o insert der certo mas o `update` de `clientes` falhar (rede/RLS), ninguém sabe — fecha o popover e chama `onRegistrado()` como sucesso. Na próxima tentativa, o insert roda de novo → **lançamento duplicado**, inflando a receita da usuária. O guard de duplicata é só um aviso ("registrar mesmo assim"), não bloqueia.

**Correção:** tratar o `error` do update como falha visível, ou (melhor) uma RPC transacional que faz insert + update atômico.

### B3 · Mutations otimistas engolem o erro do banco — a UI mente
`tarefas.tsx:109-120` (`moverTarefa`, `deletarTarefa`), `equipe.tsx:70-121`, `caderno.tsx` (salvar/fixar/remover)

Fazem `updateLocal(...)` otimista e depois `await supabase...` **sem checar `error` nem reverter**. Se a rede cair ou o RLS negar, o card fica movido/apagado na tela mas o banco não mudou. No próximo refetch, "pula" de volta sem explicação.

**Correção** — capturar `error` e reverter o cache:
```ts
const moverTarefa = async (id: string, novoStatus: Status) => {
  const anterior = qc.getQueryData<Tarefa[]>(["tarefas", userId]);
  updateLocal((list) => list.map((t) => (t.id === id ? { ...t, status: novoStatus } : t)));
  const { error } = await supabase.from("tarefas")
    .update({ status: novoStatus, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) {
    qc.setQueryData(["tarefas", userId], anterior); // reverte
    toastErro("Não consegui mover a tarefa. Tenta de novo.");
  }
};
```

### B4 · `fecharDetalhe` grava data em cartão só de leitura (corrompe cartões legados)
`src/routes/_authenticated/planner.$slug.tsx:432-498`

`fecharDetalhe` faz um `UPDATE` completo de todos os campos sempre que o painel de detalhe fecha, mesmo sem edição. Nas linhas 449-451, se um cartão legado tem `data_inicio = null`, **abrir e fechar o painel sem tocar em nada** grava `data_inicio = hoje` e `prazo = hoje`. A usuária só "visitou" o cartão e ele ganhou prazo hoje → passa a aparecer como vencido/hoje nos filtros e no Painel.

**Correção:** só persistir se algo mudou (snapshot no `abrirDetalhe` + flag `dirty`; se `!dirty`, fechar sem `UPDATE`).

### B5 · `google_calendar_conexoes`: RLS ligado, ZERO policies (guarda tokens OAuth do Google)
Banco de produção · advisor `rls_enabled_no_policy`

A tabela mais sensível do sistema (`access_token`, `refresh_token` de longa duração do Google Calendar) tem RLS habilitado mas **nenhuma policy**. Hoje isso é *seguro na prática* — RLS + zero policies = default-deny, e só o `service_role` (server functions) acessa. **Mas** a segurança depende 100% de "ninguém nunca escrever uma query client-side contra ela". Basta uma policy "de conveniência" futura para expor refresh tokens de todas as usuárias. Defense-in-depth exige tornar a intenção explícita.

**Correção** — policy explícita por dono (o service_role ignora RLS, então o fluxo atual não quebra):
```sql
CREATE POLICY "GCal: dono seleciona" ON public.google_calendar_conexoes
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "GCal: dono insere" ON public.google_calendar_conexoes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "GCal: dono atualiza" ON public.google_calendar_conexoes
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "GCal: dono apaga" ON public.google_calendar_conexoes
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
```
Alternativa mais rígida: não criar SELECT de cliente e **documentar** o default-deny na migration, para ser intencional e não acidental.

### B6 · Parser de Markdown do blog: recursão sem teto (DoS de cliente)
`src/lib/blogMarkdown.ts:113-146`

`parseInline` é recursivo e reprocessa `before`/`after` a cada match sem memoização. Um parágrafo patológico salvo no banco (centenas de `*`/`[` desbalanceados) pode explodir em tempo/stack e travar a aba do editor.

**Correção** — teto de profundidade barato:
```ts
function parseInline(text: string, marks: DocMark[] = [], depth = 0): DocNode[] {
  if (!text) return [];
  if (depth > 200) return [{ type: "text", text, ...(marks.length ? { marks } : {}) }];
  // ...depth+1 nas 3 chamadas recursivas
}
```

### B7 · `useUserMeta` escreve presença dentro do `queryFn` (write escondido num read)
`src/hooks/useUserMeta.ts:33-41`

O `queryFn` de leitura faz `upsert` em `presencas`. React Query reexecuta `queryFn` em refetch (foco de janela, reconnect, retry) → writes repetidos, e o `await` serializa a leitura do header atrás do round-trip de escrita. Idempotente por dia (não corrompe), mas é comando escondido num read.

**Correção:** mover o registro de presença para um `useEffect` único por sessão (mutation dedicada); o `queryFn` só lê.

---

## 🟡 Importantes

### Segurança de banco / infra
- **UPDATE sem `WITH CHECK` permite "roubar posse" de linha.** `tarefas`, `metas`, `notas`, `financeiro_mensal`, `etapa1_*`, `user_profile`, `user_progress`, `quadro_colunas` têm policy de UPDATE só com `USING`. Sem `WITH CHECK`, a usuária A pode `UPDATE ... SET user_id = <B>` numa linha própria e migrá-la para a conta de B (spoofing/poluição, perda de acesso, conflito de `UNIQUE`). As fases recentes (`produtos`, `lancamentos`, `planejamento_*`) **já fazem certo** — é retrofit das antigas. Correção: adicionar `WITH CHECK (auth.uid() = user_id)` idêntico ao `USING` em cada policy de UPDATE.
- **Drift de schema: ~12 tabelas de produção não têm migration no repo** (`google_calendar_conexoes`, `intencoes_dia`, `lancamentos`, `planejamento_*`, `presencas`, `produtos`, `profiles`, `quadro_colunas`, `user_profile`, `user_progress`, `etapa1_*`). O próprio `profiles` só tem `ALTER`s versionados, não o `CREATE`. Um `db reset`/rebuild **não reproduz** essas policies — inclusive as boas (anti-escalação de `is_admin`, default-deny dos tokens). Correção: `supabase db pull`, versionar tudo, e proibir DDL direto via MCP sem migration.
- **`enviar-contato` (edge function):** CORS `*`, sem rate limiting numa operação cara (envia e-mail via Resend), e valida e-mail só por comprimento (`\r\n` → possível header injection no `reply_to`). Aponta para `connector-gateway.lovable.dev` (gateway Lovable, cortado). **Confirmar se ainda está em uso** — se o form hoje insere direto em `contatos` via RLS, a função pode estar morta e deve ser removida.
- **Forms públicos sem anti-spam.** `contatos` e `lista_espera` têm INSERT `WITH CHECK (true)` para `anon`, sem CAPTCHA/honeypot/rate-limit. Um bot enche as tabelas (e dispara e-mails) em minutos — alvo clássico de spam de waitlist pré-lançamento. Correção: honeypot (5 min) agora + Turnstile depois (há a skill `turnstile-spin`). No banco dá pra reforçar formato: `WITH CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')`.
- **Leaked Password Protection desligada** (advisor). Ativar no painel Supabase (Auth → Password) — checagem HaveIBeenPwned, um clique.
- **Bucket `blog-media` permite listar** todos os arquivos (não só acessar por URL) — rascunhos de posts não publicados ficam enumeráveis. Restringir a policy SELECT a acesso por objeto.

### Bugs / robustez
- **Tokens do Google sem validação de shape.** `calendarGoogle.functions.ts:67,107` faz `as TokensGoogle` sem validar; se o Google devolver corpo sem `expires_in`, `Date.now() + NaN` → `new Date(NaN).toISOString()` lança `RangeError` → 500 genérico. Validar com zod (`safeParse`) antes de usar.
- **`useSupabaseSession` sem `.catch` no `getSession()`** (`useSupabaseSession.ts:22-27`) → se rejeitar, `loading` fica `true` pra sempre (tela de carregando eterna). Adicionar `.catch(() => setLoading(false))`.
- **`resolvePostLoginPath` engole erro e manda pro onboarding** (`useSupabaseSession.ts:43-55`). Erro de rede transitório joga usuária já onboardada de volta ao onboarding. `error` do PostgREST é ignorado (viola "sem exceção silenciosa" do CLAUDE.md). Default para `/painel` no erro.
- **Redirect do Google perde o `next`** (`login.tsx:152`, `cadastro.tsx:127`). `redirectTo` é sempre `/`. Entrar com Google via deep-link (`?next=/financeiro`) descarta o destino. Propagar `destinoSeguro(search.next)`.
- **`redefinir-senha.tsx:47-52`:** timeout de 3s lê `hasRecovery` em stale closure → em conexão lenta pode mandar link válido para `/auth/link-expirado`. Usar `useRef`.
- **Meta: `concluir` sem trava de double-click** (`metas.tsx:143-156`) — dois cliques rápidos disparam dois updates + toasts sobrepostos com "Desfazer" apontando errado. `disabled={atualizar.isPending}`.
- **`produtos.tsx:181` `arquivar` não trata erro** — invalida a query mesmo se o update falhou; o produto "volta" sem explicação.
- **Iframe de vídeo do blog montado por concatenação de string** (`blogMarkdown.ts`) — hoje não é injetável (ID casa `[\w-]{6,}`), mas é invariante frágil num caminho que renderiza no site público. Considerar DOMPurify/sanitizador na saída como defesa em profundidade.
- **Gate de onboarding só em `clientes.tsx`** — `tarefas`, `caderno`, `equipe`, `calendario` não checam `onboarding_completed`. Centralizar no layout `_authenticated.tsx`.

### Auth / conformidade / UX
- **Links de Termos e Privacidade mortos no cadastro** (`cadastro.tsx:200-206` — `href="#"`). A usuária "concorda" com termos que não abrem — questão de LGPD. As páginas `/termos` e `/privacidade` já existem. Trocar por `<Link>`.
- **Lockout de login é só client-side** (`login.tsx:26-27`) e reseta no F5 — não protege contra brute-force real (o CLAUDE.md pede rate-limit em login). O rate-limit real é do Supabase Auth; confirmar que está ligado no painel. Manter o lockout de UI como UX, mas documentar que não é o controle.
- **Enumeração de usuário inconsistente:** o login é cuidadosamente anti-enumeração, mas o cadastro entrega "esse e-mail já tem conta". Decisão consciente de UX (aceitável pro público), mas decida: fecha nas duas telas ou aceita nas duas.
- **Validade de link (1h/24h) na copy é config do painel, não código** (`esqueci-senha.tsx:126`, `link-expirado.tsx:20`). Alinhar copy com a config real do Supabase (já é pendência conhecida).

### Consistência / dinheiro
- **Formatação de dinheiro perde centavos** (`financeiro.tsx:91`, `produtos.tsx:87`, `planejamento.index.tsx:850`). `toLocaleString("pt-BR")` sem `minimumFractionDigits: 2` → `1500.5` vira `"R$ 1.500,5"`. Fixar 2 casas para moeda.

---

## 🔵 Menores (higiene, quando sobrar tempo)

- **4 erros de TypeScript** reais (`financeiro.tsx:680-681` event listener, `planejamento.index.tsx:436` e `etapa.$n.tsx:9` faltando `search` no `navigate`). Build passa só porque o Vite não faz typecheck — são bugs latentes.
- **1.649 erros de lint** — quase todos formatação (Prettier), auto-corrigíveis com `npx eslint . --fix`. Sinal de que o formatador não roda no commit.
- **Mensagem "Connect Supabase in Lovable Cloud"** em `client.ts:17`, `client.server.ts:17`, `auth-middleware.ts:17` — resíduo do Lovable (cortado). Trocar por instrução real.
- **OG image aponta para URL de preview do Lovable** (`__root.tsx:83-91`) — todo compartilhamento social usa asset em infra que pode sumir.
- **`admin.index.tsx:36-150`:** ~11 queries num `useEffect` sem loading/erro/cleanup (única rota admin fora do padrão `useQuery`). Migrar para `useQuery` com `Promise.all` dentro do `queryFn`.
- **`PostEditor.tsx:414-424`:** auto-retry recursivo que **republica** sozinho após erro. Limitar o auto-retry a `salvar(null)` (rascunho), não à publicação.
- **`is_admin(_uid)` chamável por qualquer autenticada via RPC** — oráculo booleano pequeno (precisa saber o UUID), `anon` já revogado. Baixo risco; fechar criando variante sem argumento se quiser.
- **`equipe.tsx:322` usa `window.confirm`** nativo (destoa da linguagem visual territorial; o resto usa `AlertDialog`).
- **Botão "olho" de senha com `tabIndex={-1}`** (`CosmicInput.tsx:74`) — inacessível por teclado.
- **`<img src={produto.foto_url}>` sem validar esquema** (`produtos.tsx:375`) — validar `https?:` no submit.
- **`renderErrorPage` em inglês** num app 100% pt-BR (`error-page.ts`).
- **Duplicação:** `usePrefersReducedMotion` (6 arquivos), `hojeISO`/`hojeISODate` (3 impls), `validarEmail` (5 telas, com `.max(255)` inconsistente), `numeroDe`/parse pt-BR (3 cópias divergentes). Extrair para `src/lib/*`.
- **Componentes gigantes:** `planner.$slug.tsx` (1247), `planejamento.index.tsx` (1046), `PostEditor.tsx` (1038) misturam data-fetching + mutations + ~10 subcomponentes. Quebrar melhora testabilidade (CLAUDE.md).

---

## ✅ O que está BEM feito (não mexer)

- **Isolamento multi-tenant real e verificado.** As 36 tabelas do `public` têm RLS habilitado; toda tabela com dado de usuária filtra por `auth.uid()` de fato (checado policy por policy no banco). Nenhuma leitura cruzada entre usuárias. Os únicos `USING(true)` são `feature_flags` (público, correto) e os `WITH CHECK(true)` dos forms públicos (uso legítimo).
- **Anti-escalação de privilégio.** O UPDATE de `profiles` ancora `is_admin` no valor atual via `WITH CHECK` — a usuária não consegue se auto-promover a admin. Detalhe que muita gente esquece.
- **Separação de segredos padrão-ouro.** `client.server.ts` (service_role, só servidor, Proxy lazy, `persistSession: false`) vs `client.ts` (anon key). A service_role só é consumida por server functions, nunca importada em componente React.
- **Middleware de auth robusto.** Valida o Bearer com `getClaims`, exige `sub`, cria cliente RLS-scoped por request com o JWT da usuária. Server functions usam `context.userId` (do token), nunca id do body — sem BOLA.
- **Todas as 6 funções `SECURITY DEFINER` com `search_path=public` fixado** — fecha o hijack clássico de search_path. Triggers de conquista com EXECUTE revogado de `anon`/`authenticated`.
- **Gate de admin respaldado por RLS** — client-side é só UX; forçar `/admin` renderiza a casca mas toda query volta vazia.
- **Pipeline de Markdown seguro contra XSS por construção** — HTML cru descartado (`renderer.html = () => ""`), allowlist de protocolo (`javascript:`/`data:` bloqueados), embeds por allowlist de host. Um único pipeline para preview e produção.
- **Path traversal no upload prevenido** (`PostEditor.tsx:71` usa extensão via allowlist, nunca `file.name` cru).
- **Race conditions de autosave tratadas com cuidado** (`caderno.tsx` `idCarregadoRef`, `PostEditor` `publicacaoDecididaRef`).
- **Anti-enumeração no login + open-redirect fechado** (`login.tsx:19-24` rejeita `//` e destinos externos).
- **A11y acima da média:** `aria-invalid`/`aria-describedby`, foco no 1º erro, skip-link, `aria-live` separado para erros, Caps Lock, `prefers-reduced-motion` respeitado.
- **Calculadora de preço robusta** (`produtos.tsx`) — guard de `pctTotal >= 100`, `Math.max(qtd,1)`, mensagem clara. `metas.tsx` é a rota mais bem estruturada (useMutation com onError/onSuccess, undo, cleanup de timer).
- **A qualidade das policies melhorou ao longo do tempo** — as fases recentes já usam `WITH CHECK` corretamente. O time já sabe fazer certo; o débito é só nas tabelas antigas.

---

## Perguntas em aberto

1. **Camada de IA/Gemini:** não existe `src/lib/gemini.ts` neste repo (só menção no `.env.example`). A integração deve viver nas edge functions/Worker, fora do `src/`. Quer que eu revise essa parte (prompt injection, parse da resposta, chave exposta)? Se sim, me aponta onde está.
2. **`enviar-contato` está viva ou morta?** Aponta para o gateway Lovable (cortado). Se o form de contato hoje insere direto em `contatos`, a função é resíduo e deve sair.
3. **Rate-limit de login no Supabase Auth:** está ligado no painel? (o lockout do código não conta).

---

## Ordem de ataque sugerida

1. **B1** (fuso no mês) — distorce receita/meta todo dia 1º. ~5 linhas em 2 arquivos.
2. **B2 + B3** (mutations sem tratar erro) — B2 pode duplicar dinheiro. Rápidos.
3. **B5 + drift de schema** (policy dos tokens OAuth + `db pull`) — antes de qualquer coisa ir a produção.
4. **B4, B6, B7** (fecharDetalhe, parser, useUserMeta).
5. **Anti-spam nos forms + WITH CHECK nas UPDATE antigas + leaked-password + bucket** — lote de segurança.
6. Menores + higiene (`--fix`, tsc, resíduos Lovable).
