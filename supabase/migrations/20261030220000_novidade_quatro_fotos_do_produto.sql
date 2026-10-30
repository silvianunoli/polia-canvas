-- ONE-163: o cadastro de produto passou de 1 foto pra até 4 (as mesmas da loja,
-- tabela produto_fotos). A novidade de 30/10 cedo falava de uma foto só; o texto
-- é corrigido na mesma linha (ninguém precisa ver de novo o que já leu).
-- Aplicar só depois do deploy do código.
update public.novidades
set titulo = 'Até 4 fotos por produto, direto do aparelho',
    texto = 'Em Produtos, o cadastro ganhou o espaço "Fotos": até 4 fotos do celular ou do computador, em JPG, PNG ou WEBP de até 3 MB. A primeira é a da vitrine, e as mesmas fotos aparecem na loja da Pólia One.'
where titulo = 'Foto do produto direto do aparelho';
