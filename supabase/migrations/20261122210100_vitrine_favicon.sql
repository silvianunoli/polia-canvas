-- Favicon da Vitrine online (22/11/2026, Sil: "alem do logotipo, a pessoa pode também
-- cadastrar favicon, quando ela não cadastrar, mostrar o da Pólia"). O arquivo fica no
-- bucket marca-logos, na pasta da dona, como a capa; null = ícone da Pólia na aba.
alter table public.catalogos add column if not exists favicon_path text;
