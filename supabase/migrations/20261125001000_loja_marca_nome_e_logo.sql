-- Nome e logo próprios da Loja da marca (24/11/2026, Sil: o logo e o nome de
-- Configurações refletem na Vitrine online; "na loja da marca não, pq a
-- configuração deve ser feita dentro da página Loja da Marca").
--
-- Até aqui loja_marca_publica lia business_name e logo_path de profiles, os
-- mesmos de Configurações. Agora a loja tem as duas colunas dela. A carga inicial
-- copia o que estava no perfil, então a loja no ar não muda de cara.
--
-- O logo copiado aponta pro MESMO arquivo do perfil. Por isso quem troca o logo
-- num lugar não apaga o arquivo que o outro ainda usa (trocarLogo/removerLogo em
-- components/orcamentos/dados.ts e salvarIdentidadeDaLoja em
-- components/lojaDaMarca/dados.ts conferem antes de apagar).
--
-- Pode entrar antes do deploy: a loja continua mostrando o mesmo nome e logo.

alter table public.lojas_marca
  add column if not exists nome text,
  add column if not exists logo_path text;

alter table public.lojas_marca
  drop constraint if exists lojas_marca_nome_tamanho,
  add constraint lojas_marca_nome_tamanho
    check (nome is null or length(btrim(nome)) between 1 and 80);

update public.lojas_marca l
   set nome = coalesce(l.nome, nullif(btrim(p.business_name), '')),
       logo_path = coalesce(l.logo_path, p.logo_path)
  from public.profiles p
 where p.id = l.user_id;

-- A dona grava pela função (a tabela só tem leitura pra ela, como a vitrine).
create or replace function public.loja_marca_salvar_identidade(p_nome text, p_logo_path text)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_uid uuid := auth.uid();
  v_nome text := btrim(coalesce(p_nome, ''));
  v_logo text := nullif(btrim(coalesce(p_logo_path, '')), '');
begin
  if v_uid is null then
    raise exception 'Sem sessão' using errcode = '42501';
  end if;
  if not exists (select 1 from lojas_marca where user_id = v_uid) then
    raise exception 'Conta sem loja da marca' using errcode = '42501';
  end if;
  if length(v_nome) not between 1 and 80 then
    raise exception 'Nome da loja precisa ter de 1 a 80 caracteres' using errcode = '22023';
  end if;
  -- Só arquivo da pasta da própria dona no marca-logos: o da loja
  -- ({uid}/loja/...) ou o logo que já era o dela ({uid}/logo-...).
  if v_logo is not null and (
       split_part(v_logo, '/', 1) <> v_uid::text
       or v_logo !~ '^[0-9a-f-]{36}/(loja/)?[a-z0-9-]+\.(png|jpg|webp)$'
     ) then
    raise exception 'Logo fora da pasta da conta' using errcode = '42501';
  end if;

  update lojas_marca
     set nome = v_nome,
         logo_path = v_logo,
         updated_at = now()
   where user_id = v_uid;
end;
$$;

revoke all on function public.loja_marca_salvar_identidade(text, text) from public, anon;
grant execute on function public.loja_marca_salvar_identidade(text, text) to authenticated;

-- loja_marca_publica passa a ler o nome e o logo da loja. O nome do perfil fica
-- só como rede de segurança (loja sem nome não abre).
do $troca$
declare
  v_fn regprocedure := 'public.loja_marca_publica(text)'::regprocedure;
  v_velho text := 'select nullif(btrim(business_name), ''''), logo_path into v_nome, v_logo
    from profiles where id = v_loja.user_id;';
  v_novo text := 'select coalesce(nullif(btrim(v_loja.nome), ''''), nullif(btrim(business_name), '''')), v_loja.logo_path
    into v_nome, v_logo
    from profiles where id = v_loja.user_id;';
  v_def text;
  v_achou integer;
begin
  v_def := pg_get_functiondef(v_fn);
  v_achou := (length(v_def) - length(replace(v_def, v_velho, ''))) / length(v_velho);
  if v_achou <> 1 then
    raise exception 'Trecho achado % vezes em loja_marca_publica (esperado 1)', v_achou;
  end if;
  execute replace(v_def, v_velho, v_novo);
end;
$troca$;
