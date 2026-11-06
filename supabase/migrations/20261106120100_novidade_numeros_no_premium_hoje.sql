-- O aviso do sino estava marcado pra 01/12 (20261030200000). Com a virada
-- antecipada pra 06/11, sai junto com o deploy: a linha não entra antes do código.
update public.novidades
set publicada_em = now()
where titulo = 'Raio-x, Projeção, Encomenda e Resumo agora no Premium'
  and publicada_em > now();
