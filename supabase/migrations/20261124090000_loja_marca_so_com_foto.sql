-- Foto obrigatória na Loja da marca (24/11/2026, ONE-239, Sil: "é obrigatório ter
-- foto cadastrada pra aparecer na loja ou na vitrine"). Produto sem nenhuma foto
-- (sem galeria em produto_fotos e sem link https em foto_url) sai da lista de
-- produtos de loja_marca_publica, mesmo marcado na vitrine. A mesma regra vale
-- na Vitrine online e no site da loja (fotosParaLoja, src/lib/loja.ts).
-- Pode entrar antes do deploy: só muda o que a loja do domínio lista.
do $troca$
declare
  v_fn regprocedure := 'public.loja_marca_publica(text)'::regprocedure;
  v_velho text := 'where p.user_id = v_loja.user_id and not p.arquivado and p.no_catalogo';
  v_novo text := 'where p.user_id = v_loja.user_id and not p.arquivado and p.no_catalogo
         and (p.foto_url like ''https://%'' or exists (select 1 from produto_fotos f where f.produto_id = p.id))';
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
