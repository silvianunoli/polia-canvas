alter table public.convites_cadastro
  add column enviado_em timestamptz null;

comment on column public.convites_cadastro.enviado_em is
  'Quando o e-mail de convite foi disparado pra essa pessoa (via admin.enviarConvite). Null = ainda não enviado.';
