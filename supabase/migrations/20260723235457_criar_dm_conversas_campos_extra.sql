alter table dm_conversas
  add column criado_em timestamptz not null default now();

alter table dm_conversas
  add column erro text;
