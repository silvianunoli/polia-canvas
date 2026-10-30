-- Botão "Enviar foto" no cadastro de produto (Adicionar/Editar produto): a foto sobe
-- do aparelho pro bucket produtos-fotos, na pasta da dona, em vez de só aceitar link.
-- Aplicar junto com o deploy do código (regra do sino).
insert into public.novidades (titulo, texto, link, link_rotulo) values
  ('Foto do produto direto do aparelho',
   'Em Produtos, o cadastro ganhou o botão "Enviar foto": a foto sobe do celular ou do computador, em JPG, PNG ou WEBP de até 3 MB. Colar o link de uma imagem continua valendo.',
   '/produtos', 'Abrir Produtos');
