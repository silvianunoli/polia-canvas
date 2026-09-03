// Modelo do Planejamento — 6 módulos que formam o documento vivo do negócio
// (handoff 2026-07-03, substitui a jornada-wizard). Cada módulo tem 4-6 seções,
// cada seção tem 1-4 perguntas. Cada pergunta tem um `campo` (saves_to) — as
// respostas de um mesmo campo são combinadas e materializadas na ferramenta
// (trigger `materializar_planejamento` na tabela planejamento_respostas).
//
// Seções com 2 campos: as perguntas foram divididas entre eles de forma sensata
// (ver comentário na seção). Ao concluir um módulo, sua ferramenta é desbloqueada.
//
// ATENÇÃO: o `id` da seção é CHAVE PERSISTIDA: vira `planejamento_respostas.secao` e
// `planejamento_secoes.secao` (primary key junto com user_id). Renumerar um id
// existente reatribui a resposta já salva de uma pergunta para outra. Seção nova
// entra com id que não colide (foi assim que "1.0" nasceu), nunca empurrando os
// vizinhos. A ORDEM de exibição vem da ordem deste array, não do valor do id.

export const TOTAL_MODULOS = 6;

export interface Pergunta {
  label: string;
  campo: string;
}

export interface Secao {
  id: string; // "1.1" … "6.5"
  modulo: number;
  titulo: string;
  subtitulo: string;
  perguntas: Pergunta[];
}

export interface Modulo {
  n: number;
  nome: string;
  subtitulo: string;
}

export const MODULOS: Modulo[] = [
  { n: 1, nome: "Razão de existir", subtitulo: "Começa pela conta do mês. Depois, por que o negócio existe, para quem, e o que o diferencia." },
  { n: 2, nome: "Quem você serve", subtitulo: "A pessoa que compra de você. Quem ela é de verdade." },
  { n: 3, nome: "O que você vende", subtitulo: "Produto, proposta de valor, e o que faz do seu o único." },
  { n: 4, nome: "Quanto vale", subtitulo: "Precificar é respeitar o seu trabalho. E entender o seu negócio." },
  { n: 5, nome: "Como te acharem", subtitulo: "Onde você aparece, como você fala, e como as pessoas chegam até a compra." },
  { n: 6, nome: "Onde você vai", subtitulo: "Metas que fazem sentido. Ações que te movem. Foco no que importa." },
];

export function moduloInfo(n: number): Modulo {
  return MODULOS[Math.min(Math.max(n, 1), TOTAL_MODULOS) - 1];
}

export const SECOES: Secao[] = [
  // ───────── MÓDULO 1 — Razão de existir ─────────
  // Abertura pelo número (decisão EST-01, 2026-09-03). Até aqui o Planejamento
  // pedia 39 perguntas de marca, cliente e produto antes da 1ª de dinheiro, o
  // contrário do eixo do produto ("saber se o negócio dá lucro vem na frente").
  //
  // As duas perguntas desta seção vieram de 4.1 e 4.2 (módulo Quanto vale) e
  // foram REMOVIDAS de lá, não duplicadas. São as únicas do módulo financeiro
  // que não dependem de nada respondido antes: as outras pedem o preço do
  // produto (que só é listado em 3.1) ou o preço do concorrente (que só é
  // mapeado em 2.4), então o módulo inteiro não podia ser promovido a primeiro.
  //
  // Efeito colateral desejado: `financeiro.meta_mensal` materializa em
  // financeiro_mensal.meta pelo trigger, então a meta do mês já aparece no
  // Painel e no /financeiro depois da 1ª pergunta respondida.
  {
    id: "1.0",
    modulo: 1,
    titulo: "A conta do mês",
    subtitulo:
      "O Planejamento abre pelo número: o que você quer tirar daqui e o que o negócio custa todo mês.",
    // 2 campos: meta_mensal (o que ela quer receber) + custo_fixo (o que sai).
    perguntas: [
      {
        label: "Quanto você quer receber por mês com esse negócio?",
        campo: "financeiro.meta_mensal",
      },
      {
        label:
          "Quais são os seus custos fixos todo mês? (plataformas, ferramentas, espaço, contador, outros). Some tudo.",
        campo: "financeiro.custo_fixo",
      },
    ],
  },
  {
    id: "1.1",
    modulo: 1,
    titulo: "Propósito",
    subtitulo: "Por que isso existe?",
    perguntas: [
      { label: "Por que você criou esse negócio? O que te fez começar?", campo: "marca.proposito" },
      { label: "Se o seu negócio deixasse de existir amanhã, que falta faria pra sua cliente?", campo: "marca.proposito" },
      { label: "Qual é a mudança que você quer ver na vida de quem compra de você?", campo: "marca.proposito" },
    ],
  },
  {
    id: "1.2",
    modulo: 1,
    titulo: "Missão",
    subtitulo: "O que você faz, pra quem, e como isso muda a vida delas.",
    perguntas: [
      { label: "Em uma frase: o que você faz, pra quem faz?", campo: "marca.missao" },
      { label: "O que você entrega que vai além do produto ou serviço em si?", campo: "marca.missao" },
    ],
  },
  {
    id: "1.3",
    modulo: 1,
    titulo: "Visão",
    subtitulo: "Onde você quer que isso chegue.",
    perguntas: [
      { label: "Onde você quer que esse negócio esteja em 3 anos? Seja específica: faturamento, quantas clientes, onde você está, o que mudou na sua rotina.", campo: "marca.visao" },
      { label: "Qual é o sonho maior por trás disso tudo?", campo: "marca.visao" },
    ],
  },
  {
    id: "1.4",
    modulo: 1,
    titulo: "Valores",
    subtitulo: "O que você nunca negocia.",
    perguntas: [
      { label: "Liste de 3 a 5 coisas que guiam cada decisão do seu negócio. O que você nunca abre mão?", campo: "marca.valores" },
      { label: "O que faria você dizer não a uma cliente, mesmo que custasse dinheiro?", campo: "marca.valores" },
      { label: "O que você recusa fazer, mesmo que os concorrentes façam?", campo: "marca.valores" },
    ],
  },
  {
    id: "1.5",
    modulo: 1,
    titulo: "Personalidade",
    subtitulo: "Se seu negócio fosse uma pessoa.",
    // 2 campos: personalidade (quem ela é) + tom (como fala / o que não diz).
    perguntas: [
      { label: "Se o seu negócio fosse uma pessoa, como ela seria? Como ela fala, como ela se veste, o que ela lê, onde ela está.", campo: "marca.personalidade" },
      { label: "Escolha 3 palavras que descrevem como você quer que as pessoas se sintam ao interagir com a sua marca.", campo: "marca.tom" },
      { label: "O que sua marca NUNCA diria ou faria?", campo: "marca.tom" },
    ],
  },

  // ───────── MÓDULO 2 — Quem você serve ─────────
  {
    id: "2.1",
    modulo: 2,
    titulo: "Retrato do dia",
    subtitulo: "Quem é ela como pessoa, não como \"cliente\".",
    perguntas: [
      { label: "Quantos anos ela tem, onde mora, o que faz pra viver?", campo: "mercado.perfil_cliente" },
      { label: "Descreva o dia a dia dela: o que ela faz pela manhã, o que ela consome, onde ela passa o tempo online e offline.", campo: "mercado.perfil_cliente" },
      { label: "Que marcas ela gosta? Que pessoas ela segue? O que ela compra sem pensar duas vezes?", campo: "mercado.perfil_cliente" },
    ],
  },
  {
    id: "2.2",
    modulo: 2,
    titulo: "O que ela sente",
    subtitulo: "As dores reais e os sonhos verdadeiros.",
    // 2 campos: dores (frustração/problema) + sonhos (o que ela deseja).
    perguntas: [
      { label: "Qual é a maior frustração que ela tem e que o seu negócio resolve?", campo: "mercado.dores" },
      { label: "O que a mantém acordada à noite? O que ela mais quer mudar na vida dela?", campo: "mercado.dores" },
      { label: "Quais são os sonhos dela? O que ela imagina quando pensa em 'vida que eu quero'?", campo: "mercado.sonhos" },
      { label: "O que ela sente quando enfrenta o problema que você resolve?", campo: "mercado.dores" },
    ],
  },
  {
    id: "2.3",
    modulo: 2,
    titulo: "Por que ela compra",
    subtitulo: "O que leva à decisão, e o que trava.",
    // 2 campos: gatilhos (o que faz comprar) + objecoes (o que trava).
    perguntas: [
      { label: "O que faz ela escolher comprar de você? Qual é o gatilho da decisão?", campo: "mercado.gatilhos" },
      { label: "O que poderia fazer ela hesitar antes de comprar? Quais são as dúvidas ou medos dela?", campo: "mercado.objecoes" },
      { label: "Depois de comprar, como ela se sente? O que muda pra ela?", campo: "mercado.gatilhos" },
    ],
  },
  {
    id: "2.4",
    modulo: 2,
    titulo: "Concorrência",
    subtitulo: "O que existe no mercado, pelo ângulo certo.",
    perguntas: [
      { label: "Quem mais faz algo parecido com o que você faz? Anota de 2 a 5 nomes.", campo: "mercado.concorrentes" },
      { label: "O que você admira nessas marcas?", campo: "mercado.concorrentes" },
      { label: "O que você faria diferente? O que elas não entregam que você entrega?", campo: "mercado.concorrentes" },
      { label: "Qual é o espaço que ninguém está ocupando ainda?", campo: "mercado.concorrentes" },
    ],
  },
  {
    id: "2.5",
    modulo: 2,
    titulo: "Seu lugar no mercado",
    subtitulo: "Por que você e não outra.",
    perguntas: [
      { label: "Em 2 frases: quem você ajuda, qual transformação entrega, e o que te diferencia.", campo: "mercado.posicionamento" },
      { label: "O que as pessoas dizem sobre você? (Se já tem clientes: o que elas elogiam mais? Se ainda não tem: o que você imagina que diriam?)", campo: "mercado.posicionamento" },
    ],
  },

  // ───────── MÓDULO 3 — O que você vende ─────────
  {
    id: "3.1",
    modulo: 3,
    titulo: "O que você oferece",
    subtitulo: "Tudo que você vende, em um só lugar.",
    perguntas: [
      { label: "Liste o que você vende hoje (ou vai vender). Para cada item: nome, descrição curta, pra quem é. Um por linha.", campo: "produto.lista" },
      { label: "Tem algo que você ainda não vende mas quer vender? Anota aqui também.", campo: "produto.lista" },
    ],
  },
  {
    id: "3.2",
    modulo: 3,
    titulo: "A transformação que você entrega",
    subtitulo: "Não o produto: o que muda na vida dela.",
    perguntas: [
      { label: "Como é a vida da sua cliente antes de comprar de você?", campo: "produto.transformacao" },
      { label: "Como é a vida dela depois?", campo: "produto.transformacao" },
      { label: "O que ela consegue fazer depois que não conseguia antes?", campo: "produto.transformacao" },
    ],
  },
  {
    id: "3.3",
    modulo: 3,
    titulo: "O que você é e o que não é",
    subtitulo: "Fronteiras claras criam identidade forte.",
    perguntas: [
      { label: "Complete: 'Somos [3 coisas]. Nunca somos [3 coisas].'", campo: "marca.fronteiras" },
      { label: "O que sua marca JAMAIS venderia?", campo: "marca.fronteiras" },
      { label: "Qual cliente você não quer ter? Quem não é pra você?", campo: "marca.fronteiras" },
    ],
  },
  {
    id: "3.4",
    modulo: 3,
    titulo: "Sua frase de valor",
    subtitulo: "Uma frase que resume tudo.",
    perguntas: [
      { label: "Em 1 frase: o que você vende, pra quem, e qual transformação entrega.", campo: "marca.frase_valor" },
      { label: "Teste: se uma pessoa que nunca te viu lesse essa frase, ela entenderia imediatamente o que você faz?", campo: "marca.frase_valor" },
    ],
  },

  // ───────── MÓDULO 4 — Quanto vale ─────────
  {
    id: "4.1",
    modulo: 4,
    titulo: "O que sai por venda",
    // O custo fixo saiu daqui pra abertura do módulo 1 (seção 1.0). Sobrou o
    // custo variável, que precisa saber o que ela vende (módulo 3) pra fazer
    // sentido, e por isso ficou.
    subtitulo:
      "O custo fixo já entrou lá na abertura. Aqui é o que sai a cada produto ou atendimento.",
    perguntas: [
      { label: "Quanto você gasta por produto ou atendimento? (material, tempo, embalagem, frete, etc.)", campo: "financeiro.custo_unitario" },
    ],
  },
  {
    id: "4.2",
    modulo: 4,
    titulo: "O preço que você cobra",
    // "Quanto você quer receber por mês" saiu daqui pra seção 1.0. Sobrou o
    // preço, que depende do produto listado em 3.1.
    subtitulo: "Um número, e o que faz ele parecer alto demais.",
    perguntas: [
      { label: "Qual o preço que você acha que o seu produto ou serviço merece? Por quê?", campo: "financeiro.preco_ideal" },
      { label: "Tem algum receio de cobrar esse valor? O que te faz hesitar?", campo: "financeiro.preco_ideal" },
    ],
  },
  {
    id: "4.3",
    modulo: 4,
    titulo: "Como o mercado precifica",
    subtitulo: "Entender o mercado é parte de se posicionar.",
    perguntas: [
      { label: "Quanto os seus concorrentes cobram pelo que fazem?", campo: "financeiro.estrategia_preco" },
      { label: "Você quer ser mais acessível, equivalente ou premium que eles? Por quê?", campo: "financeiro.estrategia_preco" },
      { label: "O que justifica o preço que você vai cobrar? O que sua cliente está pagando além do produto em si?", campo: "financeiro.estrategia_preco" },
    ],
  },
  {
    id: "4.4",
    modulo: 4,
    titulo: "Sua meta do mês",
    subtitulo: "Um número claro transforma intenção em foco.",
    // 3 campos: meta_minima / meta_boa / meta_celebracao. meta_boa é a Meta do
    // mês canônica: materializa em `metas` (trigger) e é lida por Painel,
    // Financeiro e a calculadora de Produtos.
    perguntas: [
      { label: "Quanto você precisaria faturar no próximo mês pra pagar as contas?", campo: "financeiro.meta_minima" },
      { label: "Quanto faria esse mês ser considerado um mês bom?", campo: "financeiro.meta_boa" },
      { label: "Qual valor faria você celebrar?", campo: "financeiro.meta_celebracao" },
    ],
  },

  // ───────── MÓDULO 5 — Como te acharem ─────────
  {
    id: "5.1",
    modulo: 5,
    titulo: "Seus canais",
    subtitulo: "Mapear tudo pra escolher com intenção.",
    perguntas: [
      { label: "Liste todos os lugares onde você está presente ou quer estar: Instagram, TikTok, WhatsApp, YouTube, LinkedIn, e-mail, marketplace, loja física, presencial, podcast, outro.", campo: "caderno.canais" },
      { label: "Onde suas clientes mais te encontram hoje?", campo: "caderno.canais" },
    ],
  },
  {
    id: "5.2",
    modulo: 5,
    titulo: "Onde focar agora",
    subtitulo: "Fazer bem em um canal vale mais do que mal em cinco.",
    perguntas: [
      { label: "Qual canal tem mais potencial pra você agora? Por quê?", campo: "caderno.canal_principal" },
      { label: "Se você só pudesse estar em um lugar, qual seria?", campo: "caderno.canal_principal" },
      { label: "O que você já testou que não funcionou? Por que você acha que não deu certo?", campo: "caderno.canal_principal" },
    ],
  },
  {
    id: "5.3",
    modulo: 5,
    titulo: "Sua voz",
    subtitulo: "Como você fala define quem você atrai.",
    // 2 campos: voz (como fala / referência) + anti_exemplos (o que nunca diria).
    perguntas: [
      { label: "Como você fala com a sua cliente? Formal ou informal? Técnica ou acolhedora? Séria ou bem-humorada? Minimalista ou expressiva?", campo: "caderno.voz" },
      { label: "O que você NUNCA diria na sua comunicação?", campo: "caderno.anti_exemplos" },
      { label: "Tem alguma marca (de qualquer setor) que você admira a forma de comunicar? O que você admira nela?", campo: "caderno.voz" },
    ],
  },
  {
    id: "5.4",
    modulo: 5,
    titulo: "O caminho da sua cliente",
    subtitulo: "Da descoberta à compra, e depois.",
    perguntas: [
      { label: "Da primeira vez que ela te encontra até comprar, o que acontece? Descreva passo a passo.", campo: "caderno.jornada_cliente" },
      { label: "Onde a maioria das pessoas para antes de comprar? O que poderia estar travando?", campo: "caderno.jornada_cliente" },
      { label: "Como você se relaciona com ela depois da compra? O que você faz pra ela voltar?", campo: "caderno.jornada_cliente" },
    ],
  },
  {
    id: "5.5",
    modulo: 5,
    titulo: "Sua bio",
    subtitulo: "3 linhas que fazem tudo.",
    // 2 campos: bio (o texto) + link (contato).
    perguntas: [
      { label: "Em 3 linhas: quem você é, o que faz, pra quem, e como ela compra ou te contrata.", campo: "caderno.bio" },
      { label: "Qual o link ou contato que vai nessa bio?", campo: "caderno.link" },
    ],
  },

  // ───────── MÓDULO 6 — Onde você vai ─────────
  {
    id: "6.1",
    modulo: 6,
    titulo: "Onde você quer chegar",
    subtitulo: "O destino antes do mapa.",
    // 2 campos: visao_1ano + visao_3anos.
    perguntas: [
      { label: "Qual seria o cenário ideal pro seu negócio em 1 ano? Seja específica: quanto você fatura, quantas clientes tem, onde você está, o que mudou na sua rotina.", campo: "metas.visao_1ano" },
      { label: "Em 3 anos, como você imagina esse negócio?", campo: "metas.visao_3anos" },
    ],
  },
  {
    id: "6.2",
    modulo: 6,
    titulo: "Depois do mês que vem",
    subtitulo: "A Meta do mês já está no módulo Quanto vale; aqui é o resto do caminho.",
    // 2 campos: meta_trimestre / meta_semestre. A meta do próximo mês vive só
    // em financeiro.meta_boa (módulo 4); pergunta duplicada removida daqui.
    perguntas: [
      { label: "Qual seria o número pra 3 meses?", campo: "metas.meta_trimestre" },
      { label: "E pra 6 meses? Essa meta é realista dado o que você tem hoje? O que precisaria mudar?", campo: "metas.meta_semestre" },
    ],
  },
  {
    id: "6.3",
    modulo: 6,
    titulo: "O que você vai medir",
    subtitulo: "Números que realmente dizem se está crescendo.",
    // 2 campos: metricas + frequencia.
    perguntas: [
      { label: "Quais são os 3 números que você vai olhar todo mês? (não seguidores, resultados reais: faturamento, número de clientes, ticket médio, taxa de retorno…)", campo: "metas.metricas" },
      { label: "Como e quando você vai acompanhar esses números? Uma vez por semana? No final do mês?", campo: "metas.frequencia" },
    ],
  },
  {
    id: "6.4",
    modulo: 6,
    titulo: "O que vai ser diferente",
    subtitulo: "Decisões concretas, não intenções vagas.",
    // 2 campos: acoes (começar) + cortes (parar).
    perguntas: [
      { label: "Liste 3 coisas concretas que você vai mudar ou começar a fazer pra chegar onde quer.", campo: "metas.acoes" },
      { label: "O que você vai parar de fazer? O que está tomando tempo sem trazer resultado?", campo: "metas.cortes" },
    ],
  },
  {
    id: "6.5",
    modulo: 6,
    titulo: "Sua primeira ação",
    subtitulo: "Uma coisa. Uma data.",
    // 2 campos: proxima_acao (o que) + data_proxima_acao (quando).
    perguntas: [
      { label: "O que você vai fazer essa semana que move a agulha? Uma coisa só.", campo: "metas.proxima_acao" },
      { label: "Até quando? Coloca uma data.", campo: "metas.data_proxima_acao" },
    ],
  },
];

export function secoesDoModulo(n: number): Secao[] {
  return SECOES.filter((s) => s.modulo === n);
}

export function secaoPorId(id: string): Secao | undefined {
  return SECOES.find((s) => s.id === id);
}

// ───────── Ferramentas desbloqueadas ─────────
export interface FerramentaPlan {
  nome: string;
  rota: string;
  desbloqueioSub: string;
  abrirLabel: string;
  tags: string;
}

export const FERRAMENTAS: Record<number, FerramentaPlan> = {
  1: {
    nome: "Marca",
    rota: "/marca",
    desbloqueioSub: "A identidade do seu negócio, escrita por você.",
    abrirLabel: "Abrir minha Marca",
    tags: "propósito, missão, valores, voz",
  },
  2: {
    nome: "Mapa de Mercado",
    rota: "/mercado",
    desbloqueioSub: "Quem é a sua cliente, o mercado e o seu lugar nele.",
    abrirLabel: "Abrir meu Mapa de Mercado",
    tags: "cliente, dores, concorrência, posicionamento",
  },
  3: {
    nome: "Catálogo",
    rota: "/produtos",
    desbloqueioSub: "Seus produtos e a transformação que você entrega.",
    abrirLabel: "Abrir meu catálogo",
    tags: "produtos, transformação, frase de valor",
  },
  4: {
    nome: "Financeiro",
    rota: "/financeiro",
    desbloqueioSub: "Seus custos, seu preço e suas metas do mês.",
    abrirLabel: "Abrir meu financeiro",
    tags: "custo, preço, metas",
  },
  5: {
    nome: "Caderno",
    rota: "/caderno",
    desbloqueioSub: "Seu guia de presença: canais, voz e bio.",
    abrirLabel: "Abrir meu caderno",
    tags: "canais, voz, bio, caminho da cliente",
  },
  6: {
    nome: "Metas",
    rota: "/metas",
    desbloqueioSub: "Onde você quer chegar e o que te leva lá.",
    abrirLabel: "Abrir minhas metas",
    tags: "metas, métricas, ações",
  },
};

export function ferramentaDe(n: number): FerramentaPlan {
  return FERRAMENTAS[Math.min(Math.max(n, 1), TOTAL_MODULOS)];
}

// Rótulo amigável de cada campo, pros documentos das ferramentas e do /completo.
// Rótulos amigáveis — NUNCA podem conter ponto, underline ou chave de objeto.
export const CAMPO_LABEL: Record<string, string> = {
  "marca.proposito": "Propósito",
  "marca.missao": "Missão",
  "marca.visao": "Visão",
  "marca.valores": "Valores",
  "marca.personalidade": "Personalidade",
  "marca.tom": "Tom de voz",
  "marca.fronteiras": "O que você é e o que não é",
  "marca.frase_valor": "Frase de valor",
  "produto.lista": "O que você vende",
  "produto.transformacao": "A transformação que você entrega",
  "mercado.perfil_cliente": "Quem é a sua cliente",
  "mercado.dores": "Dores",
  "mercado.sonhos": "Sonhos",
  "mercado.gatilhos": "O que faz ela comprar",
  "mercado.objecoes": "O que pode fazer ela hesitar",
  "mercado.concorrentes": "Concorrência",
  "mercado.posicionamento": "Seu posicionamento",
  "financeiro.custo_fixo": "Custo fixo do mês",
  "financeiro.custo_unitario": "Custo por produto",
  "financeiro.meta_mensal": "Meta pessoal · quanto quer receber",
  "financeiro.preco_ideal": "Preço que você quer cobrar",
  "financeiro.estrategia_preco": "Como você se posiciona no mercado",
  "financeiro.meta_minima": "Mínimo para pagar as contas",
  "financeiro.meta_boa": "Um mês bom",
  "financeiro.meta_celebracao": "Um mês para celebrar",
  "caderno.canais": "Seus canais",
  "caderno.canal_principal": "Onde focar agora",
  "caderno.voz": "Sua voz",
  "caderno.anti_exemplos": "O que você nunca diz",
  "caderno.jornada_cliente": "O caminho até a compra",
  "caderno.bio": "Bio",
  "caderno.link": "Como ela chega até você",
  "metas.visao_1ano": "Onde você quer chegar em 1 ano",
  "metas.visao_3anos": "Onde você quer chegar em 3 anos",
  "metas.meta_trimestre": "Meta para 3 meses",
  "metas.meta_semestre": "Meta para 6 meses",
  "metas.metricas": "O que você vai medir",
  "metas.frequencia": "Com que frequência vai acompanhar",
  "metas.acoes": "O que vai mudar",
  "metas.cortes": "O que vai deixar de fazer",
  "metas.proxima_acao": "Sua primeira ação",
  "metas.data_proxima_acao": "Data limite",
};

// Campos que cada ferramenta exibe como documento (em ordem), além do que ela
// já tem de tipado (produtos/financeiro_mensal/metas rows).
export const CAMPOS_FERRAMENTA: Record<string, string[]> = {
  "/marca": [
    "marca.proposito",
    "marca.missao",
    "marca.visao",
    "marca.valores",
    "marca.personalidade",
    "marca.tom",
    "marca.fronteiras",
    "marca.frase_valor",
  ],
  "/mercado": [
    "mercado.perfil_cliente",
    "mercado.dores",
    "mercado.sonhos",
    "mercado.gatilhos",
    "mercado.objecoes",
    "mercado.concorrentes",
    "mercado.posicionamento",
  ],
  "/produtos": ["marca.frase_valor", "produto.transformacao"],
  "/financeiro": [
    "financeiro.custo_fixo",
    "financeiro.custo_unitario",
    "financeiro.preco_ideal",
    "financeiro.estrategia_preco",
    "financeiro.meta_minima",
    "financeiro.meta_boa",
    "financeiro.meta_celebracao",
  ],
  "/caderno": [
    "caderno.canais",
    "caderno.canal_principal",
    "caderno.voz",
    "caderno.anti_exemplos",
    "caderno.jornada_cliente",
    "caderno.bio",
    "caderno.link",
  ],
  "/metas": [
    "metas.visao_1ano",
    "metas.visao_3anos",
    "metas.meta_trimestre",
    "metas.meta_semestre",
    "metas.metricas",
    "metas.frequencia",
    "metas.acoes",
    "metas.cortes",
    "metas.proxima_acao",
    "metas.data_proxima_acao",
  ],
};
