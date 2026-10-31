-- O Planejamento sai da Pólia One (decisão da Sil, 31/10/2026). Os 6 módulos e
-- os documentos Marca e Mapa de Mercado viram ferramenta do Pólia Lab depois;
-- na Pólia One ficam só pra conta interna, pela flag `planejamento`
-- (src/lib/ferramentasInternas.ts). Sem a flag, /planejamento, /marca e
-- /mercado levam pro Painel e o item some do menu.
--
-- Nada é apagado: planejamento_respostas, planejamento_campos e
-- planejamento_secoes continuam como estão.
--
-- A flag nasce com o mesmo estado e as mesmas contas da flag `planner`, que já
-- é a lista da conta interna. Sem a linha da `planner` naquele ambiente, nasce
-- em beta sem ninguém (o leitor do app trata flag ausente como desligada).
-- on conflict do nothing: rodar de novo não mexe em quem já foi ajustado no
-- Founder Dashboard.

insert into public.founder_flags (key, ambiente, nome, descricao, estado, rollout_pct, beta_user_ids)
select
  'planejamento',
  a.ambiente,
  'Planejamento (conta interna)',
  'Planejamento, Marca e Mapa de Mercado na Pólia One. Saiu das usuárias em 31/10/2026; só a conta interna vê o item do menu e abre as rotas.',
  coalesce(p.estado, 'beta'),
  coalesce(p.rollout_pct, 0),
  coalesce(p.beta_user_ids, '{}')
from (values ('prod'), ('preview')) as a(ambiente)
left join public.founder_flags p on p.key = 'planner' and p.ambiente = a.ambiente
on conflict (key, ambiente) do nothing;
