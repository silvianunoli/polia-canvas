-- Achado no teste de RLS via curl anônimo: as policies do módulo social foram
-- criadas sem "TO authenticated", então o role anon tenta avaliar is_admin(auth.uid())
-- e esbarra em "permission denied for function is_admin" (42501) em vez do deny
-- limpo ([]) que o resto do projeto usa (ex.: convites_cadastro). Sem vazamento de
-- dado nos dois casos, mas o padrão do projeto é negar via role, não via erro.

drop policy "Social posts: admin" on social_posts;
create policy "Social posts: admin" on social_posts for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

drop policy "Social pauta: admin" on social_pauta;
create policy "Social pauta: admin" on social_pauta for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

drop policy "Social geracoes: admin" on social_geracoes;
create policy "Social geracoes: admin" on social_geracoes for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

drop policy "DM gatilhos: admin" on dm_gatilhos;
create policy "DM gatilhos: admin" on dm_gatilhos for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

drop policy "DM conversas: admin" on dm_conversas;
create policy "DM conversas: admin" on dm_conversas for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

drop policy "Social metricas: admin" on social_metricas;
create policy "Social metricas: admin" on social_metricas for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

drop policy "Social lotes: admin" on social_lotes;
create policy "Social lotes: admin" on social_lotes for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

drop policy "Social media: admin gerencia" on storage.objects;
create policy "Social media: admin gerencia" on storage.objects for all to authenticated
  using (bucket_id = 'social' and public.is_admin(auth.uid()))
  with check (bucket_id = 'social' and public.is_admin(auth.uid()));
