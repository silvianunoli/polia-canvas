-- Segunda pesquisa: precificação (Van Westendorp) + formalização/tempo de
-- negócio. Outro foco, outro público — não mistura com discovery-negocio.
-- Reaproveita as tabelas pesquisas/pesquisa_respostas já existentes
-- (20260721120000_criar_pesquisa_discovery.sql), só uma linha nova.
--
-- Nasce DESLIGADA (ativa=false): já existe uma pesquisa (discovery-negocio) e
-- só uma fica pública em /pesquisa por vez. Ativar é decisão manual no admin.
insert into public.pesquisas (slug, titulo, subtitulo, ativa)
values (
  'pesquisa-precificacao',
  'Quanto vale isso pra você?',
  'Anônimo. Leva uns minutos. Sem cadastro.',
  false
)
on conflict (slug) do nothing;
