-- ─────────────────────────────────────────────────────────────────────────────
-- Seed de conta ativa — Social Media Best (oi.silvianunoli@gmail.com)
--
-- Popula a conta como se fosse uma usuária ativa TODOS OS DIAS por DOIS MESES,
-- pra conseguir ver todas as telas com dado real (Painel, Planejamento, Marca,
-- Mercado, Catálogo, Financeiro, Caderno, Metas, Planner, Calendário, Clientes,
-- Raio-x, Projeção, Plano de conteúdo).
--
-- COMO RODAR: cole inteiro no SQL Editor do Supabase (projeto Pólia) e execute.
--
-- IDEMPOTENTE: apaga e recria os dados DESTA usuária antes de inserir, então
-- pode rodar quantas vezes quiser sem duplicar. Não toca em nenhuma outra conta.
--
-- ANCORADO EM current_date: o mês corrente fica PARCIAL de propósito (receita
-- abaixo da meta), que é o estado mais informativo pro Painel. Rodar em outro
-- dia continua fazendo sentido.
--
-- O QUE ELE APAGA (só do user_id abaixo): planejamento (respostas/seções/campos),
-- produtos, clientes, lançamentos, metas, quadros, tarefas, notas, presenças e
-- intenções do dia. Inclui o produto placeholder "Gestão de Redes Sociais"
-- (R$ 1.000, sem custo), que é substituído pelo catálogo completo.
-- ─────────────────────────────────────────────────────────────────────────────

do $seed$
declare
  u          uuid := '5be97dcd-d0e3-4fce-835d-48bb4d9fbaec';
  hoje       date := current_date;
  ini        date := current_date - 60;          -- dois meses de histórico
  m0         date := date_trunc('month', current_date)::date;             -- mês corrente
  m1         date := (date_trunc('month', current_date) - interval '1 month')::date;
  m2         date := (date_trunc('month', current_date) - interval '2 month')::date;
  seg        date := (date_trunc('week', current_date))::date;            -- segunda desta semana
  d          date;
  mes        date;
  q_conteudo uuid;
  q_clientes uuid;
  q_operacao uuid;
  intencoes  text[] := array[
    'fechar o calendário da Bella antes do almoço',
    'gravar os 3 reels do Pet Amigo e não abrir o Instagram até terminar',
    'responder as propostas paradas e não deixar nenhuma pro dia seguinte',
    'só edição hoje, sem reunião',
    'mandar o relatório da Casa Fiori antes das 11h',
    'revisar preço de renovação sem me acovardar',
    'terminar o ensaio da Flor de Lis e entregar antes do prazo',
    'um caso publicado, nem que seja curto',
    'organizar a semana e sair no horário',
    'nada de arte avulsa fora de contrato hoje'
  ];
begin

  -- ── limpeza (só desta usuária) ───────────────────────────────────────────
  delete from tarefas               where user_id = u;
  delete from quadros               where user_id = u;
  delete from clientes              where user_id = u;
  delete from lancamentos           where user_id = u;
  delete from metas                 where user_id = u;
  delete from produtos              where user_id = u;
  delete from notas                 where user_id = u;
  delete from intencoes_dia         where user_id = u;
  delete from presencas             where user_id = u;
  delete from planejamento_respostas where user_id = u;
  delete from planejamento_secoes    where user_id = u;
  delete from planejamento_campos    where user_id = u;

  -- ── PLANEJAMENTO: 73 respostas, 27 seções, 6 módulos ─────────────────────
  -- O trigger materializar_planejamento agrega isto em planejamento_campos e
  -- cria sozinho os produtos (produto.lista) e as metas (financeiro.meta_boa e
  -- financeiro.meta_mensal). Por isso o Planejamento vem primeiro.

  insert into planejamento_respostas (user_id, modulo, secao, pergunta_idx, campo, resposta, updated_at) values
  -- MÓDULO 1 — Razão de existir
  (u,1,'1.1',0,'marca.proposito',$q$Comecei porque via negócio bom perdendo cliente por causa de um Instagram abandonado. Trabalhei 6 anos em agência e o que me incomodava era verba grande resolvendo problema pequeno, enquanto a padaria da esquina não tinha ninguém.$q$, ini + 2),
  (u,1,'1.1',1,'marca.proposito',$q$Faria falta o lugar onde a dona consegue falar da própria marca sem virar refém de agência. A maioria das minhas clientes não quer aprender a fazer post, quer parar de perder venda.$q$, ini + 2),
  (u,1,'1.1',2,'marca.proposito',$q$Quero que ela pare de achar que rede social é sorte. Que olhe pro perfil e saiba o que está funcionando e por quê.$q$, ini + 2),
  (u,1,'1.2',0,'marca.missao',$q$Cuido das redes de negócios locais que não têm equipe de marketing e não podem errar o mês.$q$, ini + 3),
  (u,1,'1.2',1,'marca.missao',$q$Entrego previsibilidade. A cliente para de acordar pensando "o que eu posto hoje" e passa a ter o mês inteiro pronto.$q$, ini + 3),
  (u,1,'1.3',0,'marca.visao',$q$Em 3 anos: R$ 25.000 por mês recorrente, 12 contas fixas, duas pessoas comigo (uma editora e uma social media júnior), e eu fora da execução diária, só na estratégia e no atendimento.$q$, ini + 4),
  (u,1,'1.3',1,'marca.visao',$q$O sonho maior é ter um método que funcione sem mim. Poder sumir um mês e o negócio continuar entregando.$q$, ini + 4),
  (u,1,'1.4',0,'marca.valores',$q$1. Número antes de opinião. 2. Não prometo resultado que não controlo. 3. Prazo combinado é prazo cumprido. 4. A cliente sabe exatamente o que está pagando.$q$, ini + 5),
  (u,1,'1.4',1,'marca.valores',$q$Diria não pra quem quer comprar seguidor ou engajamento falso. Já perdi duas propostas por isso e faria de novo.$q$, ini + 5),
  (u,1,'1.4',2,'marca.valores',$q$Não faço contrato de fidelidade longo pra prender cliente insatisfeita. Se não está funcionando, a gente conversa e encerra.$q$, ini + 5),
  (u,1,'1.5',0,'marca.personalidade',$q$Seria uma mulher de 35 anos, organizada sem ser dura. Fala direto, sem jargão de marketing. Roupa simples e boa. Lê mais sobre negócio do que sobre rede social. Está no WhatsApp, não no LinkedIn.$q$, ini + 6),
  (u,1,'1.5',1,'marca.tom',$q$Segura, clara, respeitada.$q$, ini + 6),
  (u,1,'1.5',2,'marca.tom',$q$Nunca diria "bombar", "viralizar" ou "estratégia infalível". Nunca prometeria número de seguidor.$q$, ini + 6),

  -- MÓDULO 2 — Quem você serve
  (u,2,'2.1',0,'mercado.perfil_cliente',$q$Entre 30 e 48 anos, dona de um negócio local em Curitiba ou região: clínica de estética, pet shop, restaurante de bairro, loja de roupa. Ela é a dona e também atende.$q$, ini + 9),
  (u,2,'2.1',1,'mercado.perfil_cliente',$q$Acorda cedo, abre o negócio, atende o dia inteiro. Olha o celular entre um cliente e outro. Consome Instagram e WhatsApp, quase nada de e-mail. À noite tenta responder mensagem e acaba postando qualquer coisa às 22h.$q$, ini + 9),
  (u,2,'2.1',2,'mercado.perfil_cliente',$q$Gosta de marca que parece cuidada: Granado, cafeteria de bairro bem feita. Segue outras donas de negócio. Compra sem pensar o que economiza tempo dela.$q$, ini + 9),
  (u,2,'2.2',0,'mercado.dores',$q$A maior frustração é postar e não vender. Ela sente que faz tudo e o retorno não vem.$q$, ini + 10),
  (u,2,'2.2',1,'mercado.dores',$q$O que tira o sono é mês fraco sem saber o motivo. Ela não sabe se foi o preço, a sazonalidade ou o perfil parado.$q$, ini + 10),
  (u,2,'2.2',2,'mercado.sonhos',$q$Sonha com o negócio cheio sem precisar estar em tudo. Contratar mais uma pessoa. Tirar férias de verdade.$q$, ini + 10),
  (u,2,'2.2',3,'mercado.dores',$q$Sente vergonha e cansaço. Vergonha de comparar o perfil dela com o da concorrente, cansaço de ter mais uma coisa pra fazer.$q$, ini + 10),
  (u,2,'2.3',0,'mercado.gatilhos',$q$Ela me escolhe quando vê que eu falo de venda e não de seguidor. O gatilho é a primeira reunião, quando mostro os números do perfil dela e ela entende o que estava perdendo.$q$, ini + 11),
  (u,2,'2.3',1,'mercado.objecoes',$q$Ela já foi mal atendida por agência antes. Tem medo de assinar mensalidade e não ver resultado, e de perder o controle da própria voz.$q$, ini + 11),
  (u,2,'2.3',2,'mercado.gatilhos',$q$Depois de comprar ela relaxa. A frase que mais ouço é "agora eu não penso mais nisso".$q$, ini + 11),
  (u,2,'2.4',0,'mercado.concorrentes',$q$Agência pequena local, social media freelancer iniciante, sobrinho da dona, e a própria dona fazendo sozinha.$q$, ini + 12),
  (u,2,'2.4',1,'mercado.concorrentes',$q$Admiro as agências que documentam o processo e entregam relatório de verdade. E freelancer que cobra caro sem pedir desculpa por isso.$q$, ini + 12),
  (u,2,'2.4',2,'mercado.concorrentes',$q$Faço diferente na previsibilidade: entrego o mês inteiro aprovado antes de começar. Agência entrega em cima da hora e freelancer some.$q$, ini + 12),
  (u,2,'2.4',3,'mercado.concorrentes',$q$Ninguém ocupa o lugar de quem explica o número pra dona do negócio em português. Todo mundo manda print de alcance e ninguém traduz.$q$, ini + 12),
  (u,2,'2.5',0,'mercado.posicionamento',$q$Ajudo donas de negócio local a manterem presença constante nas redes sem virar reféns de agência. Entrego o mês planejado e aprovado antes de começar, com relatório que fala de venda e não de seguidor.$q$, ini + 13),
  (u,2,'2.5',1,'mercado.posicionamento',$q$O que mais elogiam é a organização e o prazo. A frase mais repetida é "nunca precisei correr atrás de você".$q$, ini + 13),

  -- MÓDULO 3 — O que você vende (produto.lista vira o catálogo pelo trigger)
  (u,3,'3.1',0,'produto.lista',$q$Gestão de redes mensal, 12 posts e 20 stories por mês, com calendário aprovado antes do mês começar
Gestão mais tráfego mensal, gestão completa com campanha de anúncio e relatório de venda
Pacote de 12 posts, arte e legenda sem gestão do dia a dia, pra quem posta sozinha
Ensaio de conteúdo, meio período de foto e vídeo no negócio da cliente, 40 imagens tratadas
Consultoria de perfil, duas horas olhando o perfil junto e um plano de 30 dias
Kit de bio e destaques, capa de destaque, bio reescrita e link organizado$q$, ini + 16),
  (u,3,'3.1',1,'produto.lista',$q$Acompanhamento trimestral, revisão a cada 3 meses pra cliente que já está organizada e só quer ajuste$q$, ini + 16),
  (u,3,'3.2',0,'produto.transformacao',$q$Antes ela posta quando lembra, sempre correndo, e sente que está sempre devendo. O perfil não tem cara de negócio.$q$, ini + 17),
  (u,3,'3.2',1,'produto.transformacao',$q$Depois ela abre o mês com tudo aprovado. Sabe o que vai sair e quando. Responde direct de cliente querendo comprar, não de amiga elogiando.$q$, ini + 17),
  (u,3,'3.2',2,'produto.transformacao',$q$Ela consegue planejar promoção com antecedência e medir se deu certo. Antes era tudo no impulso.$q$, ini + 17),
  (u,3,'3.3',0,'marca.fronteiras',$q$Somos organizadas, diretas e presentes. Nunca somos aceleradas, genéricas nem escondidas atrás de relatório bonito.$q$, ini + 18),
  (u,3,'3.3',1,'marca.fronteiras',$q$Jamais venderia seguidor, engajamento comprado ou pacote de post genérico sem olhar o negócio.$q$, ini + 18),
  (u,3,'3.3',2,'marca.fronteiras',$q$Não quero cliente que trata rede social como favor, que some pra aprovar e depois cobra resultado. E não atendo quem quer preço de estagiário.$q$, ini + 18),
  (u,3,'3.4',0,'marca.frase_valor',$q$Cuido das redes de negócios locais com o mês inteiro planejado e aprovado antes de começar, pra dona parar de postar no susto e voltar a vender.$q$, ini + 19),
  (u,3,'3.4',1,'marca.frase_valor',$q$Testei com três clientes novas. As três entenderam na primeira leitura, e o que mais chamou atenção foi "aprovado antes de começar".$q$, ini + 19),

  -- MÓDULO 4 — Quanto vale (meta_boa vira a "Meta do mês" pelo trigger)
  (u,4,'4.1',0,'financeiro.custo_fixo',$q$R$ 1.180 por mês. Canva Pro 55, Notion 40, celular e internet 220, contador 320, coworking dois dias por semana 400, tarifa de banco 45, banco de imagem 100.$q$, ini + 23),
  (u,4,'4.1',1,'financeiro.custo_unitario',$q$Gestão mensal me custa cerca de R$ 180 por cliente entre impulsionamento mínimo e as 9 horas que levo por mês. Ensaio custa R$ 260 com deslocamento e edição.$q$, ini + 23),
  (u,4,'4.2',0,'financeiro.meta_mensal',$q$R$ 9.000 por mês limpos pra mim.$q$, ini + 24),
  (u,4,'4.2',1,'financeiro.preco_ideal',$q$A gestão mensal merece R$ 1.200. É quase um salário de meio período de social media e eu entrego mais organizada que agência.$q$, ini + 24),
  (u,4,'4.2',2,'financeiro.preco_ideal',$q$Hesito porque conheço o bolso das minhas clientes. Já cobrei 800 por vergonha de falar 1.200 e me arrependi nos dois casos.$q$, ini + 24),
  (u,4,'4.3',0,'financeiro.estrategia_preco',$q$Freelancer iniciante cobra de 400 a 700. Agência pequena daqui cobra de 1.800 a 3.000 com fidelidade de 12 meses.$q$, ini + 25),
  (u,4,'4.3',1,'financeiro.estrategia_preco',$q$Quero ser equivalente ao freelancer bom e mais acessível que agência, sem fidelidade. Fico no meio de propósito.$q$, ini + 25),
  (u,4,'4.3',2,'financeiro.estrategia_preco',$q$O que justifica é o mês fechado antes de começar e o relatório que fala de venda. Ela está pagando pra não pensar nisso, não pelos 12 posts.$q$, ini + 25),
  (u,4,'4.4',0,'financeiro.meta_minima',$q$R$ 4.500 paga tudo, incluindo o meu mínimo.$q$, ini + 26),
  (u,4,'4.4',1,'financeiro.meta_boa',$q$R$ 8.000 é um mês bom.$q$, ini + 26),
  (u,4,'4.4',2,'financeiro.meta_celebracao',$q$R$ 12.000 me faria comemorar de verdade.$q$, ini + 26),

  -- MÓDULO 5 — Como te acharem
  (u,5,'5.1',0,'caderno.canais',$q$Instagram, WhatsApp Business, indicação boca a boca, LinkedIn parado, e um grupo de empreendedoras aqui do bairro.$q$, ini + 30),
  (u,5,'5.1',1,'caderno.canais',$q$Hoje quase tudo vem de indicação de cliente. O Instagram traz umas 2 conversas por mês.$q$, ini + 30),
  (u,5,'5.2',0,'caderno.canal_principal',$q$Instagram é o de maior potencial, porque é onde minhas clientes já estão e onde eu provo o serviço fazendo.$q$, ini + 31),
  (u,5,'5.2',1,'caderno.canal_principal',$q$Se fosse um só, seria o WhatsApp. É onde fecha.$q$, ini + 31),
  (u,5,'5.2',2,'caderno.canal_principal',$q$Testei LinkedIn por 4 meses e não deu, minhas clientes não abrem LinkedIn. Também testei anúncio frio pra formulário e vinha gente querendo pagar 300.$q$, ini + 31),
  (u,5,'5.3',0,'caderno.voz',$q$Informal, mas profissional. Falo como quem senta do lado, não como quem apresenta slide. Direta, sem termo técnico e sem inglês desnecessário.$q$, ini + 32),
  (u,5,'5.3',1,'caderno.anti_exemplos',$q$Nunca digo "bombar", "engajar sua audiência" ou "estratégia matadora". Nunca uso número de seguidor como prova.$q$, ini + 32),
  (u,5,'5.3',2,'caderno.voz',$q$Admiro o Nubank de uns anos atrás, quando explicava coisa chata de banco sem infantilizar.$q$, ini + 32),
  (u,5,'5.4',0,'caderno.jornada_cliente',$q$Ela vê um post meu ou recebe indicação, entra no perfil, lê a bio e manda WhatsApp. Eu peço o arroba e olho o perfil antes de responder. Mando um diagnóstico curto de graça, marco reunião de 30 minutos e envio proposta em até 24h.$q$, ini + 33),
  (u,5,'5.4',1,'caderno.jornada_cliente',$q$A maioria trava na proposta, entre o preço e a decisão. Falta mostrar o que ela deixa de ganhar continuando como está.$q$, ini + 33),
  (u,5,'5.4',2,'caderno.jornada_cliente',$q$Depois da compra tenho reunião mensal de 30 minutos e mando o relatório. Pra ela voltar, o que funciona é entregar antes do prazo e lembrar de data importante do negócio dela.$q$, ini + 33),
  (u,5,'5.5',0,'caderno.bio',$q$Social Media Best. Cuido das redes de negócios locais de Curitiba. Mês planejado e aprovado antes de começar, com relatório que fala de venda. Orçamento no WhatsApp.$q$, ini + 34),
  (u,5,'5.5',1,'caderno.link',$q$WhatsApp do negócio e o perfil @socialmediabest.$q$, ini + 34),

  -- MÓDULO 6 — Onde você vai
  (u,6,'6.1',0,'metas.visao_1ano',$q$Em 1 ano: R$ 12.000 por mês, 8 contas fixas, uma editora de vídeo freelancer fixa comigo, e sexta-feira livre de execução.$q$, ini + 38),
  (u,6,'6.1',1,'metas.visao_3anos',$q$Em 3 anos: R$ 25.000 por mês, equipe de duas pessoas e eu só na estratégia, com um método documentado que outra pessoa consegue rodar.$q$, ini + 38),
  (u,6,'6.2',0,'metas.meta_trimestre',$q$R$ 9.500 por mês até novembro.$q$, ini + 39),
  (u,6,'6.2',1,'metas.meta_semestre',$q$R$ 12.000 por mês até fevereiro. É realista se eu fechar mais 3 contas fixas e subir a gestão pra 1.400 nas renovações. Precisa mudar o tempo que gasto editando vídeo.$q$, ini + 39),
  (u,6,'6.3',0,'metas.metricas',$q$Faturamento do mês, número de contas fixas ativas e ticket médio por cliente.$q$, ini + 40),
  (u,6,'6.3',1,'metas.frequencia',$q$Olho o faturamento toda sexta e fecho o mês no primeiro dia útil seguinte.$q$, ini + 40),
  (u,6,'6.4',0,'metas.acoes',$q$1. Subir a gestão pra R$ 1.400 nas renovações de setembro. 2. Contratar editora freelancer pra sair da edição de vídeo. 3. Publicar um caso por mês com número real de cliente.$q$, ini + 41),
  (u,6,'6.4',1,'metas.cortes',$q$Vou parar de fazer arte avulsa fora de contrato, que toma meio dia e rende 150. E parar de responder proposta de quem não passou pelo diagnóstico.$q$, ini + 41),
  (u,6,'6.5',0,'metas.proxima_acao',$q$Mandar a proposta de renovação com preço novo pras 4 clientes que renovam no mês que vem.$q$, ini + 42),
  (u,6,'6.5',1,'metas.data_proxima_acao', to_char(hoje + 9, 'DD/MM/YYYY'), ini + 42);

  -- Seções concluídas: a data de conclusão acompanha a última resposta da seção.
  insert into planejamento_secoes (user_id, modulo, secao, concluido, concluido_em)
  select u, modulo, secao, true, max(updated_at)
    from planejamento_respostas where user_id = u
   group by modulo, secao;

  -- ── CATÁLOGO: o trigger criou os 7 serviços com preço 0. Aqui entram preço,
  --    custo e tipo, como se ela tivesse passado pela calculadora. ───────────
  update produtos set tipo='servico', preco_venda=1200, preco_custo=180, canal='Indicação e Instagram',
    preco_atualizado_em = ini + 20, updated_at = ini + 20
    where user_id=u and nome='Gestão de redes mensal';
  update produtos set tipo='servico', preco_venda=1900, preco_custo=320, canal='Indicação',
    preco_atualizado_em = ini + 20, updated_at = ini + 20
    where user_id=u and nome='Gestão mais tráfego mensal';
  update produtos set tipo='servico', preco_venda=780, preco_custo=120, canal='Instagram',
    preco_atualizado_em = ini + 20, updated_at = ini + 20
    where user_id=u and nome='Pacote de 12 posts';
  update produtos set tipo='servico', preco_venda=950, preco_custo=260, canal='Indicação',
    preco_atualizado_em = ini + 20, updated_at = ini + 20
    where user_id=u and nome='Ensaio de conteúdo';
  update produtos set tipo='servico', preco_venda=450, preco_custo=40, canal='Instagram',
    preco_atualizado_em = ini + 20, updated_at = ini + 20
    where user_id=u and nome='Consultoria de perfil';
  update produtos set tipo='servico', preco_venda=320, preco_custo=45, canal='Instagram',
    preco_atualizado_em = ini + 20, updated_at = ini + 20
    where user_id=u and nome='Kit de bio e destaques';
  update produtos set tipo='servico', preco_venda=690, preco_custo=90, canal='Base de clientes',
    preco_atualizado_em = ini + 20, updated_at = ini + 20
    where user_id=u and nome='Acompanhamento trimestral';

  -- ── CLIENTES: 14, com mistura real de status ─────────────────────────────
  insert into clientes (user_id, nome, contato, status_pedido, valor, produto_id, venda_registrada, notas, created_at, updated_at)
  select u, x.nome, x.contato, x.status, x.valor,
         (select id from produtos p where p.user_id=u and p.nome=x.produto limit 1),
         x.registrada, x.notas, hoje - x.dias, hoje - x.dias
    from (values
      ('Bella Estética',      'WhatsApp · Bruna',   'Entregue',    1200, 'Gestão de redes mensal',    true,  'Conta fixa desde o começo. Renova no dia 5.', 58),
      ('Pet Amigo',           'WhatsApp · Carla',   'Entregue',    1200, 'Gestão de redes mensal',    true,  'Pediu mais vídeo de bastidor. Renova dia 5.', 56),
      ('Ateliê Nara',         'Direct · Nara',      'Entregue',     900, 'Gestão de redes mensal',    true,  'Preço antigo. Entra na renovação com 1.400.', 54),
      ('Casa Fiori',          'WhatsApp · Renata',  'Entregue',    1900, 'Gestão mais tráfego mensal',true,  'Única com tráfego. Relatório dia 10.', 51),
      ('Studio Lume',         'WhatsApp · Paula',   'Em produção', 1400, 'Gestão de redes mensal',    false, 'Fechou já no preço novo. Paga dia 20.', 34),
      ('Doceria Mel',         'Direct · Alice',     'Entregue',     780, 'Pacote de 12 posts',        true,  'Posta sozinha, só quer arte pronta.', 47),
      ('Clínica Vitta',       'WhatsApp · Dra. Rê', 'Entregue',     450, 'Consultoria de perfil',     true,  'Consultoria virou proposta de gestão.', 41),
      ('Barbearia Norte',     'Direct · Tiago',     'Entregue',     320, 'Kit de bio e destaques',    true,  'Trabalho pequeno, indicou duas pessoas.', 39),
      ('Flor de Lis',         'WhatsApp · Sônia',   'Entregue',     950, 'Ensaio de conteúdo',        true,  'Ensaio rendeu conteúdo pra 3 meses.', 28),
      ('Padaria São Jorge',   'WhatsApp · Seu Ivo', 'Em produção',  450, 'Consultoria de perfil',     false, 'Reunião marcada, plano de 30 dias em aberto.', 12),
      ('Óptica Vista',        'Direct · Marcos',    'Em espera',    780, 'Pacote de 12 posts',        false, 'Proposta enviada, aguardando resposta.', 9),
      ('Academia Pulse',      'WhatsApp · Diego',   'Em espera',   1200, 'Gestão de redes mensal',    false, 'Quer começar mês que vem.', 6),
      ('Espaço Zen',          'WhatsApp · Lu',      'Atrasado',     950, 'Ensaio de conteúdo',        false, 'Remarcou o ensaio duas vezes. Cobrar data.', 21),
      ('Mercearia da Vila',   'Direct · Dona Cida', 'Em produção',  320, 'Kit de bio e destaques',    false, 'Falta ela mandar as fotos da loja.', 4)
    ) as x(nome, contato, status, valor, produto, registrada, notas, dias);

  -- ── FINANCEIRO: dois meses fechados + o mês corrente parcial ─────────────
  -- Recorrentes: 3 contas no dia 5, 1 no dia 10, 1 no dia 20. No mês corrente
  -- a do dia 20 ainda não caiu, e é isso que abre a distância pra meta.
  foreach mes in array array[m2, m1, m0] loop
    -- entradas recorrentes
    if mes + 4  <= hoje then
      insert into lancamentos (user_id, tipo, valor, data, descricao, categoria) values
        (u,'entrada',1200, mes + 4,  'Bella Estética · gestão mensal', 'Serviço'),
        (u,'entrada',1200, mes + 4,  'Pet Amigo · gestão mensal',      'Serviço'),
        (u,'entrada', 900, mes + 4,  'Ateliê Nara · gestão mensal',    'Serviço');
    end if;
    if mes + 9  <= hoje then
      insert into lancamentos (user_id, tipo, valor, data, descricao, categoria) values
        (u,'entrada',1900, mes + 9,  'Casa Fiori · gestão e tráfego',  'Serviço');
    end if;
    if mes + 19 <= hoje then
      insert into lancamentos (user_id, tipo, valor, data, descricao, categoria) values
        (u,'entrada',1400, mes + 19, 'Studio Lume · gestão mensal',    'Serviço');
    end if;

    -- saídas fixas do mês
    if mes      <= hoje then insert into lancamentos (user_id,tipo,valor,data,descricao,categoria) values (u,'saida', 45, mes,      'Tarifa do banco',        'Estrutura'); end if;
    if mes + 2  <= hoje then insert into lancamentos (user_id,tipo,valor,data,descricao,categoria) values (u,'saida', 55, mes + 2,  'Canva Pro',              'Ferramenta'),
                                                                                                          (u,'saida', 40, mes + 2,  'Notion',                 'Ferramenta'),
                                                                                                          (u,'saida',100, mes + 2,  'Banco de imagem',        'Ferramenta'); end if;
    if mes + 4  <= hoje then insert into lancamentos (user_id,tipo,valor,data,descricao,categoria) values (u,'saida',400, mes + 4,  'Coworking',              'Estrutura'); end if;
    if mes + 7  <= hoje then insert into lancamentos (user_id,tipo,valor,data,descricao,categoria) values (u,'saida',220, mes + 7,  'Celular e internet',     'Estrutura'); end if;
    if mes + 9  <= hoje then insert into lancamentos (user_id,tipo,valor,data,descricao,categoria) values (u,'saida',320, mes + 9,  'Contador',               'Estrutura'); end if;
  end loop;

  -- avulsos dos dois meses fechados
  insert into lancamentos (user_id, tipo, valor, data, descricao, categoria) values
    (u,'entrada', 950, m2 + 13, 'Flor de Lis · ensaio de conteúdo',   'Serviço'),
    (u,'entrada', 320, m2 + 21, 'Barbearia Norte · kit de bio',       'Serviço'),
    (u,'saida',   380, m2 + 14, 'Impulsionamento Meta',               'Anúncio'),
    (u,'saida',   300, m2 + 22, 'Editora de vídeo freelancer',        'Terceirizado'),
    (u,'entrada', 780, m1 + 7,  'Doceria Mel · pacote de 12 posts',   'Serviço'),
    (u,'entrada', 450, m1 + 15, 'Clínica Vitta · consultoria',        'Serviço'),
    (u,'entrada', 950, m1 + 24, 'Espaço Zen · ensaio (sinal)',        'Serviço'),
    (u,'saida',   420, m1 + 12, 'Impulsionamento Meta',               'Anúncio'),
    (u,'saida',   600, m1 + 20, 'Editora de vídeo freelancer',        'Terceirizado'),
    (u,'saida',   190, m1 + 27, 'Curso de tráfego',                   'Ferramenta');

  -- avulsos do mês corrente (só o que já aconteceu)
  if m0 + 6  <= hoje then insert into lancamentos (user_id,tipo,valor,data,descricao,categoria) values (u,'entrada',450, m0 + 6,  'Padaria São Jorge · consultoria','Serviço'); end if;
  if m0 + 10 <= hoje then insert into lancamentos (user_id,tipo,valor,data,descricao,categoria) values (u,'entrada',320, m0 + 10, 'Mercearia da Vila · kit de bio', 'Serviço'); end if;
  if m0 + 8  <= hoje then insert into lancamentos (user_id,tipo,valor,data,descricao,categoria) values (u,'saida',  260, m0 + 8,  'Impulsionamento Meta',           'Anúncio'); end if;

  -- ── METAS: o trigger já criou "Meta do mês" (8.000) e "Meta pessoal"
  --    (9.000). Aqui entra o valor já atingido e mais duas metas próprias. ──
  update metas
     set valor_atual = coalesce((select sum(valor) from lancamentos
                                  where user_id=u and tipo='entrada'
                                    and data >= m0 and data <= hoje), 0),
         updated_at = now()
   where user_id=u and titulo='Meta do mês';

  insert into metas (user_id, titulo, descricao, status, progresso, valor_alvo, valor_atual, formato, unidade, prazo, da_jornada, created_at, updated_at) values
    (u,'Contas fixas ativas','Cliente de gestão mensal, não trabalho avulso.','ativa',63,8,5,'numero','contas', (m0 + interval '5 month')::date, false, ini + 40, hoje - 3),
    (u,'Ticket médio por cliente','Subir com renovação, sem trocar de cliente.','ativa',84,1400,1180,'moeda',null,(m0 + interval '3 month')::date, false, ini + 40, hoje - 3),
    (u,'Sair da edição de vídeo','Passar a edição pra uma freelancer fixa.','ativa',40,null,0,'numero',null,(m0 + interval '2 month')::date, false, ini + 41, hoje - 8);

  -- ── PLANNER: 3 quadros ───────────────────────────────────────────────────
  insert into quadros (user_id, nome, slug, ordem, created_at, updated_at)
       values (u,'Conteúdo do mês','conteudo-do-mes',0, ini, hoje) returning id into q_conteudo;
  insert into quadros (user_id, nome, slug, ordem, created_at, updated_at)
       values (u,'Clientes novas','clientes-novas',1, ini + 5, hoje) returning id into q_clientes;
  insert into quadros (user_id, nome, slug, ordem, created_at, updated_at)
       values (u,'Operação','operacao',2, ini + 5, hoje) returning id into q_operacao;

  -- Concluídas desta semana: alimentam o gráfico "Sua semana de trabalho".
  insert into tarefas (user_id, quadro_id, titulo, status, prioridade, categoria, prazo, created_at, updated_at) values
    (u,q_conteudo,'Calendário do mês da Bella aprovado','concluido','alta','Conteúdo', seg,     seg - 4, seg),
    (u,q_conteudo,'12 artes do Pet Amigo','concluido','media','Conteúdo',                 seg,     seg - 4, seg),
    (u,q_operacao,'Fechar o mês passado no Financeiro','concluido','alta','Admin',        seg,     seg - 3, seg),
    (u,q_conteudo,'Roteiro dos 3 reels da Casa Fiori','concluido','media','Conteúdo',     seg + 1, seg - 2, seg + 1),
    (u,q_clientes,'Diagnóstico da Óptica Vista','concluido','media','Vendas',             seg + 1, seg - 2, seg + 1),
    (u,q_conteudo,'Editar reels da Casa Fiori','concluido','alta','Conteúdo',             seg + 2, seg - 1, seg + 2),
    (u,q_conteudo,'Legendas da semana do Ateliê Nara','concluido','baixa','Conteúdo',     seg + 2, seg - 1, seg + 2),
    (u,q_operacao,'Relatório da Casa Fiori','concluido','alta','Admin',                   seg + 2, seg - 3, seg + 2),
    (u,q_clientes,'Proposta da Academia Pulse','concluido','alta','Vendas',               seg + 2, seg - 5, seg + 2),
    (u,q_conteudo,'Stories da Doceria Mel','concluido','baixa','Conteúdo',                seg + 3, seg,     seg + 3);

  -- Atrasadas: poucas de propósito, pra não virar parede vermelha.
  insert into tarefas (user_id, quadro_id, titulo, status, prioridade, categoria, prazo, created_at, updated_at) values
    (u,q_clientes,'Cobrar data do ensaio do Espaço Zen','hoje','alta','Vendas',        hoje - 6, hoje - 14, hoje - 6),
    (u,q_operacao,'Pedir as fotos da Mercearia da Vila','planejado','media','Admin',   hoje - 3, hoje - 9,  hoje - 3),
    (u,q_conteudo,'Publicar o caso da Flor de Lis','planejado','media','Conteúdo',     hoje - 1, hoje - 12, hoje - 1);

  -- Para hoje
  insert into tarefas (user_id, quadro_id, titulo, status, prioridade, categoria, prazo, horario, created_at, updated_at) values
    (u,q_operacao,'Reunião mensal com a Bella','hoje','alta','Admin',       hoje,'09:30', hoje - 7, hoje),
    (u,q_conteudo,'Aprovar calendário do Studio Lume','hoje','alta','Conteúdo', hoje,'14:00', hoje - 4, hoje),
    (u,q_clientes,'Responder a Óptica Vista','em_progresso','media','Vendas',   hoje, null,   hoje - 2, hoje);

  -- Próximos 7 dias
  insert into tarefas (user_id, quadro_id, titulo, status, prioridade, categoria, prazo, created_at, updated_at) values
    (u,q_clientes,'Enviar proposta de renovação com preço novo','planejado','alta','Vendas', hoje + 2, hoje - 5, hoje - 1),
    (u,q_conteudo,'Ensaio de conteúdo da Flor de Lis','planejado','media','Conteúdo',        hoje + 3, hoje - 6, hoje - 2),
    (u,q_operacao,'Entrevistar editora de vídeo freelancer','planejado','media','Admin',     hoje + 4, hoje - 8, hoje - 3),
    (u,q_conteudo,'Calendário do mês que vem do Pet Amigo','planejado','media','Conteúdo',   hoje + 5, hoje - 3, hoje - 1),
    (u,q_operacao,'Conciliar entradas da semana','planejado','baixa','Admin',                hoje + 6, hoje - 2, hoje - 1);

  -- Backlog e pausadas
  insert into tarefas (user_id, quadro_id, titulo, status, prioridade, categoria, created_at, updated_at) values
    (u,q_conteudo,'Série sobre erro comum de bio','ideias','baixa','Conteúdo',        hoje - 20, hoje - 20),
    (u,q_conteudo,'Bastidor de um ensaio, formato reels','ideias','baixa','Conteúdo', hoje - 18, hoje - 18),
    (u,q_conteudo,'Carrossel: o que é relatório de verdade','ideias','media','Conteúdo', hoje - 15, hoje - 15),
    (u,q_clientes,'Lista de 10 negócios do bairro pra prospectar','ideias','media','Vendas', hoje - 17, hoje - 17),
    (u,q_clientes,'Pedir indicação pras 4 clientes fixas','ideias','media','Vendas',  hoje - 11, hoje - 11),
    (u,q_operacao,'Montar modelo de proposta em PDF','pausado','baixa','Admin',       hoje - 25, hoje - 10),
    (u,q_operacao,'Estudar precificação por hora','pausado','baixa','Admin',          hoje - 22, hoje - 13),
    (u,q_operacao,'Organizar banco de imagens por cliente','ideias','baixa','Admin',  hoje - 13, hoje - 13);

  -- Concluídas ao longo dos dois meses (histórico do gráfico e da presença)
  insert into tarefas (user_id, quadro_id, titulo, status, prioridade, categoria, prazo, created_at, updated_at)
  select u,
         case when g % 3 = 0 then q_conteudo when g % 3 = 1 then q_clientes else q_operacao end,
         (array['Calendário aprovado','Artes da quinzena','Reels editados','Relatório enviado',
                'Reunião mensal','Legendas revisadas','Stories da semana','Diagnóstico de perfil',
                'Proposta enviada','Conciliação do caixa'])[1 + (g % 10)]
           || ' · ' || to_char(ini + g, 'DD/MM'),
         'concluido',
         (array['alta','media','baixa'])[1 + (g % 3)],
         (array['Conteúdo','Vendas','Admin'])[1 + (g % 3)],
         (ini + g)::date, (ini + g - 2)::date, (ini + g)::date
    from generate_series(2, 52, 2) as g
   where (ini + g) < seg;   -- o histórico para antes da semana corrente

  -- ── CADERNO: notas ───────────────────────────────────────────────────────
  insert into notas (user_id, titulo, conteudo, fixada, created_at, updated_at) values
    (u,'Script do diagnóstico gratuito', $q$1. Pergunto o arroba e olho antes da call.
2. Mostro 3 coisas que estão custando venda hoje.
3. Não dou solução na call, dou diagnóstico.
4. Proposta em até 24h, com prazo de resposta de 5 dias.$q$, true, ini + 8, hoje - 6),
    (u,'Preço de renovação · setembro', $q$Gestão sobe de 1.200 pra 1.400.
Ateliê Nara está em 900, vai pra 1.200 (aviso com 30 dias).
Casa Fiori mantém 1.900 até dezembro, já subiu em maio.
Argumento: entrego calendário aprovado antes do mês, ninguém do mercado faz.$q$, true, ini + 27, hoje - 2),
    (u,'O que funcionou no mês passado', $q$Reels de bastidor rendeu 3x mais salvamento que carrossel.
Post de preço gerou 2 conversas no direct.
Story com enquete de horário trouxe pouca resposta, cortar.$q$, false, m1 + 26, m1 + 26),
    (u,'Ideias de conteúdo pro mês', $q$- Erro comum de bio de negócio local
- Antes e depois de um perfil (com autorização)
- Quanto custa não ter calendário
- Bastidor de um ensaio
- Por que não vendo seguidor$q$, false, ini + 35, hoje - 9),
    (u,'Checklist de entrada de cliente nova', $q$Contrato assinado, acesso ao perfil, briefing de marca,
banco de fotos da cliente, grupo no WhatsApp, data fixa de reunião mensal.$q$, false, ini + 12, ini + 12),
    (u,'Objeções que mais ouço', $q$"Já tentei com agência e não deu certo" — mostrar o calendário aprovado antes.
"É caro" — comparar com o custo de um mês sem venda.
"Eu mesma consigo postar" — perguntar quando foi o último post.$q$, false, ini + 21, hoje - 15),
    (u,'Fornecedores e contatos', $q$Editora de vídeo (freelancer): orçamento de 600 por mês, 8 vídeos.
Fotógrafa parceira para ensaio maior: 450 a diária.
Contador: fecha dia 10.$q$, false, ini + 30, hoje - 20),
    (u,'Anotação da reunião com a Casa Fiori', $q$Renata quer focar em campanha de aniversário da loja em setembro.
Verba de anúncio sobe pra 500 no mês. Pedir as fotos do estoque novo até dia 25.$q$, false, hoje - 5, hoje - 5);

  -- ── PRESENÇA: todos os dias dos últimos dois meses ───────────────────────
  insert into presencas (user_id, data, created_at)
  select u, dia::date, dia::date
    from generate_series(ini, hoje, interval '1 day') as dia
  on conflict (user_id, data) do nothing;

  -- ── INTENÇÃO DO DIA: dias úteis dos últimos dois meses ───────────────────
  insert into intencoes_dia (user_id, data, texto, created_at, updated_at)
  select u, dia::date,
         intencoes[1 + (extract(doy from dia)::int % array_length(intencoes,1))],
         dia::date, dia::date
    from generate_series(ini, hoje, interval '1 day') as dia
   where extract(dow from dia) between 1 and 5
  on conflict (user_id, data) do nothing;

end
$seed$;

-- ── Conferência ──────────────────────────────────────────────────────────────
select 'respostas' o, count(*)::text v from planejamento_respostas where user_id='5be97dcd-d0e3-4fce-835d-48bb4d9fbaec'
union all select 'seções concluídas', count(*)::text from planejamento_secoes where user_id='5be97dcd-d0e3-4fce-835d-48bb4d9fbaec' and concluido
union all select 'campos materializados', count(*)::text from planejamento_campos where user_id='5be97dcd-d0e3-4fce-835d-48bb4d9fbaec'
union all select 'produtos', count(*)::text from produtos where user_id='5be97dcd-d0e3-4fce-835d-48bb4d9fbaec'
union all select 'clientes', count(*)::text from clientes where user_id='5be97dcd-d0e3-4fce-835d-48bb4d9fbaec'
union all select 'lançamentos', count(*)::text from lancamentos where user_id='5be97dcd-d0e3-4fce-835d-48bb4d9fbaec'
union all select 'metas', count(*)::text from metas where user_id='5be97dcd-d0e3-4fce-835d-48bb4d9fbaec'
union all select 'quadros', count(*)::text from quadros where user_id='5be97dcd-d0e3-4fce-835d-48bb4d9fbaec'
union all select 'tarefas', count(*)::text from tarefas where user_id='5be97dcd-d0e3-4fce-835d-48bb4d9fbaec'
union all select 'notas', count(*)::text from notas where user_id='5be97dcd-d0e3-4fce-835d-48bb4d9fbaec'
union all select 'presenças', count(*)::text from presencas where user_id='5be97dcd-d0e3-4fce-835d-48bb4d9fbaec'
union all select 'intenções', count(*)::text from intencoes_dia where user_id='5be97dcd-d0e3-4fce-835d-48bb4d9fbaec'
union all select 'receita do mês', to_char(coalesce(sum(valor),0),'999G999D99') from lancamentos
   where user_id='5be97dcd-d0e3-4fce-835d-48bb4d9fbaec' and tipo='entrada' and data >= date_trunc('month', current_date)
union all select 'quanto sobrou no mês', to_char(
     coalesce(sum(case when tipo='entrada' then valor else -valor end),0),'999G999D99') from lancamentos
   where user_id='5be97dcd-d0e3-4fce-835d-48bb4d9fbaec' and data >= date_trunc('month', current_date);
