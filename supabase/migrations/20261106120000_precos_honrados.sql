-- Virada de preços antecipada pra 06/11/2026 (decisão da Sil).
--
-- Os e-mails teste_fim_2d e teste_acabou prometeram R$ 29,90 e R$ 47,90 pra quem
-- assinasse até 30/11. A Sil decidiu honrar todas as contas que receberam: elas
-- veem e pagam o preço antigo até o prazo (src/lib/fundadora.ts).
--
-- A lista é uma foto de quem recebeu até agora, e não uma leitura de
-- lembretes_conta: esses tipos seguem sendo enviados, sem a promessa, e o bônus
-- dos primeiros passos apaga a linha de teste_fim_2d pra reenviar.
-- Sem policy: só a service role lê e escreve.
create table if not exists public.precos_honrados (
  user_id uuid primary key references auth.users (id) on delete cascade,
  criado_em timestamptz not null default now()
);

alter table public.precos_honrados enable row level security;
revoke all on public.precos_honrados from anon, authenticated;

insert into public.precos_honrados (user_id)
select distinct user_id
from public.lembretes_conta
where tipo in ('teste_fim_2d', 'teste_acabou')
on conflict (user_id) do nothing;
