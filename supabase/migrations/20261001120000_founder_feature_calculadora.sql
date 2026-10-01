-- /calculadora virou ferramenta própria (antes era aba de /produtos). O mapa
-- rota -> feature do client (src/lib/founder-features.ts) já a conhece; este
-- seed põe o rótulo no /founder.
insert into public.founder_features (key, nome, rota_prefixo, grupo)
values ('calculadora', 'Calculadora', '/calculadora', 'dinheiro')
on conflict (key) do nothing;
