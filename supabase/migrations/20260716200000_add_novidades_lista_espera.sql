alter table public.lista_espera
  add column if not exists novidades boolean not null default false;

comment on column public.lista_espera.novidades is 'Consentimento explicito pra receber newsletter por e-mail, capturado no formulario de lista de espera.';
