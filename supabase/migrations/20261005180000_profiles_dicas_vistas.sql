-- Tour de boas-vindas e dicas de primeira visita (05/10/2026).
--
-- Guarda quais dicas a usuária já viu ("tour", "produtos", "calculadora"...).
-- Fica no perfil, e não no localStorage, pra o tour não voltar quando ela
-- entra por outro aparelho. A policy "Users can update own profile" já deixa
-- a própria usuária gravar aqui (só is_admin e plano são congelados).
--
-- O CHECK limita o tamanho pra ninguém usar a coluna como depósito: são
-- ~12 chaves curtas hoje.
alter table public.profiles
  add column if not exists dicas_vistas text[] not null default '{}';

alter table public.profiles
  drop constraint if exists profiles_dicas_vistas_limite;

alter table public.profiles
  add constraint profiles_dicas_vistas_limite
  check (cardinality(dicas_vistas) <= 50);
