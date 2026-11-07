-- "Como usar esta tela" abre o tutorial por cima da tela (ONE-187). Aplicar junto com o deploy (regra do sino).
insert into public.novidades (titulo, texto, link, link_rotulo) values
  ('O tutorial de cada tela abre por cima dela',
   'O "Como usar esta tela" agora abre o clipe e o passo a passo numa janela por cima da tela. Fechou, a tela continua do jeito que estava, sem perder o que foi preenchido.',
   '/como-usar', 'Ver os tutoriais');
