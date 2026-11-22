-- Loja da marca na Pólia One (Sil, 22/11/2026): a dona muda o título dos carrosséis e os
-- banners da página inicial. lojas_marca continua sem UPDATE pela API: esta função grava
-- só esses dois pedaços do conteúdo, da loja de quem chamou, depois de conferir cada campo.
-- A capa das coleções vai direto em produto_categorias.capa_path (RLS "dona edita").

create or replace function public.loja_marca_salvar_vitrine(p_rotulos jsonb, p_banners jsonb)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_uid uuid := auth.uid();
  v_chave text;
  v_rotulo jsonb;
  v_rotulos jsonb;
  v_banner jsonb;
  v_banners jsonb := '[]'::jsonb;
  v_titulo text;
  v_acima text;
  v_link text;
  v_alt text;
  v_img text;
  v_cel text;
begin
  if v_uid is null then
    raise exception 'Sem sessão' using errcode = '42501';
  end if;
  if not exists (select 1 from lojas_marca where user_id = v_uid) then
    raise exception 'Conta sem loja da marca' using errcode = '42501';
  end if;
  if jsonb_typeof(p_rotulos) <> 'object' or jsonb_typeof(p_banners) <> 'array' then
    raise exception 'Formato inválido' using errcode = '22023';
  end if;
  select coalesce(conteudo->'rotulos', '{}'::jsonb) into v_rotulos from lojas_marca where user_id = v_uid;
  if jsonb_typeof(v_rotulos) <> 'object' then
    v_rotulos := '{}'::jsonb;
  end if;
  if jsonb_array_length(p_banners) > 5 then
    raise exception 'Até 5 banners' using errcode = '22023';
  end if;

  for v_chave, v_rotulo in select * from jsonb_each(p_rotulos) loop
    if v_chave not in ('produtos', 'atalhos', 'destaques', 'rotina', 'universos', 'depoimentos', 'instagram') then
      raise exception 'Bloco desconhecido: %', v_chave using errcode = '22023';
    end if;
    v_titulo := nullif(btrim(coalesce(v_rotulo->>'titulo', '')), '');
    v_acima := nullif(btrim(coalesce(v_rotulo->>'acima', '')), '');
    if length(v_titulo) > 60 or length(v_acima) > 60 then
      raise exception 'Título até 60 caracteres' using errcode = '22023';
    end if;
    -- Os dois vazios: o bloco volta pro título padrão da loja.
    if v_titulo is null and v_acima is null then
      v_rotulos := v_rotulos - v_chave;
    else
      v_rotulos := v_rotulos || jsonb_build_object(
        v_chave, jsonb_strip_nulls(jsonb_build_object('titulo', v_titulo, 'acima', v_acima)));
    end if;
  end loop;

  for v_banner in select * from jsonb_array_elements(p_banners) loop
    v_img := btrim(coalesce(v_banner->>'imagem_path', ''));
    v_cel := nullif(btrim(coalesce(v_banner->>'imagem_celular_path', '')), '');
    v_link := nullif(btrim(coalesce(v_banner->>'link', '')), '');
    v_alt := btrim(coalesce(v_banner->>'alt', ''));
    -- Só arquivo da pasta da própria dona no bucket marca-logos.
    if v_img = '' or split_part(v_img, '/', 1) <> v_uid::text or v_img like '%..%' then
      raise exception 'Imagem do banner inválida' using errcode = '22023';
    end if;
    if v_cel is not null and (split_part(v_cel, '/', 1) <> v_uid::text or v_cel like '%..%') then
      raise exception 'Imagem de celular inválida' using errcode = '22023';
    end if;
    -- Mesma regra da loja (linkSeguro): caminho interno ou https.
    if v_link is not null and (length(v_link) > 300 or v_link !~ '^(/[^/]|/$|https://)') then
      raise exception 'Link do banner inválido' using errcode = '22023';
    end if;
    if length(v_alt) > 160 then
      raise exception 'Descrição do banner até 160 caracteres' using errcode = '22023';
    end if;
    v_banners := v_banners || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
      'imagem_path', v_img, 'imagem_celular_path', v_cel, 'link', v_link, 'alt', v_alt)));
  end loop;

  update lojas_marca
     set conteudo = jsonb_set(
           jsonb_set(coalesce(conteudo, '{}'::jsonb), '{rotulos}', v_rotulos, true),
           '{banners}', v_banners, true),
         updated_at = now()
   where user_id = v_uid;
end;
$$;

revoke all on function public.loja_marca_salvar_vitrine(jsonb, jsonb) from public, anon;
grant execute on function public.loja_marca_salvar_vitrine(jsonb, jsonb) to authenticated;
