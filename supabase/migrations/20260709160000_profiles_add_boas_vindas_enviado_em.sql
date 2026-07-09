alter table public.profiles
  add column boas_vindas_enviado_em timestamptz null;

comment on column public.profiles.boas_vindas_enviado_em is
  'Quando o e-mail de boas-vindas foi disparado (garantirBoasVindas, 1x por conta). Null = ainda não enviado.';
