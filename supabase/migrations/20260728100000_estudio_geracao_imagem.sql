-- Estúdio (Feature D): suporte à geração de imagem/arte por IA.
-- A ação "imagem" da Edge Function social-ia passa a preencher slides[i].imagem
-- e o client (polia-admin) renderiza os slides e grava social_posts.midias.

alter table social_posts
  add column midias_geradas_em timestamptz;
comment on column social_posts.midias_geradas_em is
  'Timestamp da última renderização client-side que populou midias. Usado pra avisar quando versoes mudou depois (arte desatualizada).';

alter table social_geracoes
  add column custo_creditos numeric;
comment on column social_geracoes.custo_creditos is
  'Créditos gastos na chamada (Freepik/Magnific), quando o provedor devolve essa informação. Nulo para ações de texto (Claude já é rastreado por tokens).';
