// Topo da /landing-b por nicho (09/10/2026, campanha "Nichos · Cadastro").
// Cada anúncio do Meta manda utm_content com o nome do anúncio (N07-confeiteira,
// N19-croche...). Quem chega por ele vê no topo a mesma pergunta da arte que
// clicou, com a foto do mesmo nicho; o resto da página é igual pra todo mundo.
// Sem utm_content conhecido, a landing mostra o topo padrão.
//
// Chamada e apoio são os textos aprovados das artes (CRIATIVOS-NICHOS-POLIA-ONE.md,
// na raiz do workspace). Foto: public/marketing/landing/nicho-<slug>.

export type NichoLanding = {
  /** Etiqueta acima do título. */
  rotulo: string;
  titulo: string;
  subtitulo: string;
  /** Nome da foto em public/marketing/landing (sem extensão). */
  foto: string;
  alt: string;
};

const NICHOS: Record<string, NichoLanding> = {
  "N01-nail": {
    rotulo: "Nail design",
    titulo: "Nail designer, sua marca atrai cliente ou só promoção?",
    subtitulo:
      "O Planejamento da marca da Pólia One organiza o que te diferencia, e a Calculadora mostra quanto cobrar por isso.",
    foto: "nicho-nail",
    alt: "Nail designer sorrindo enquanto faz as unhas de uma cliente, com a parede de esmaltes ao fundo.",
  },
  "N02-trancista": {
    rotulo: "Tranças",
    titulo: "Trancista, você sabe quanto cobrar pela sua hora?",
    subtitulo:
      "Box braids leva horas. A Pólia One calcula o serviço por hora, com cabelo, material e o seu tempo.",
    foto: "nicho-trancista",
    alt: "Trancista sorrindo enquanto faz box braids em uma cliente, com jumbos coloridos na estante.",
  },
  "N03-lash": {
    rotulo: "Cílios e sobrancelha",
    titulo: "Lash designer, quanto custa de verdade cada aplicação?",
    subtitulo: "Fio, cola, descartáveis e a sua hora. A Pólia One junta tudo e sugere o preço.",
    foto: "nicho-lash",
    alt: "Lash designer aplicando cílios em uma cliente deitada na maca, com ring light ao lado.",
  },
  "N04-cabeleireira": {
    rotulo: "Salão de beleza",
    titulo: "Cabeleireira, quanto sobra de uma progressiva depois dos produtos?",
    subtitulo:
      "A Pólia One coloca produto, energia, taxa do cartão e o seu tempo na conta antes do preço.",
    foto: "nicho-cabeleireira",
    alt: "Cabeleireira mostrando o resultado no espelho para uma cliente sorridente no salão.",
  },
  "N05-esteticista": {
    rotulo: "Estética",
    titulo: "Esteticista, a limpeza de pele está pagando a sua sala?",
    subtitulo:
      "A Pólia One divide aluguel e produtos pelo mês e mostra quantos atendimentos fecham as contas.",
    foto: "nicho-esteticista",
    alt: "Esteticista sorrindo durante uma limpeza de pele, na sala com plantas e toalhas enroladas.",
  },
  "N06-maquiadora": {
    rotulo: "Maquiagem",
    titulo: "Maquiadora, o pacote da noiva está no preço certo?",
    subtitulo:
      "Deslocamento, teste, produto e horas de espera. A Pólia One faz a conta do pacote inteiro.",
    foto: "nicho-maquiadora",
    alt: "Maquiadora passando batom em uma noiva, com a maleta de maquiagem aberta ao lado.",
  },
  "N07-confeiteira": {
    rotulo: "Confeitaria",
    titulo: "Confeiteira, você sabe quanto cobrar pelo bolo de pote?",
    subtitulo:
      "A Pólia One soma ingrediente, pote, gás e taxa e mostra o preço que deixa sobra de verdade.",
    foto: "nicho-confeiteira",
    alt: "Mãos fechando potes de bolo com etiqueta kraft, enfileirados na bancada.",
  },
  "N08-doceira": {
    rotulo: "Doces de festa",
    titulo: "Doceira, o cento de brigadeiro está pagando o seu tempo?",
    subtitulo:
      "A Pólia One coloca a sua hora na conta do cento, junto com chocolate, forminha e embalagem.",
    foto: "nicho-doceira",
    alt: "Mãos enrolando brigadeiros e colocando nas forminhas, com caixas de doces na mesa.",
  },
  "N09-marmita": {
    rotulo: "Marmitas",
    titulo: "Marmiteira, quanto sobra de cada marmita que sai daí?",
    subtitulo:
      "A Pólia One faz a conta por unidade e mostra quantas marmitas fecham a meta do mês.",
    foto: "nicho-marmita",
    alt: "Cozinheira montando marmitas com arroz, frango e legumes na bancada da cozinha.",
  },
  "N10-salgadeira": {
    rotulo: "Salgados e bufê",
    titulo: "Salgadeira, o orçamento da festa cobre o óleo e o gás?",
    subtitulo:
      "A Pólia One faz a conta do cento antes do orçamento sair, com desconto simulado se a cliente pedir.",
    foto: "nicho-salgadeira",
    alt: "Salgadeira sorrindo com uma bandeja de coxinhas e pastéis na cozinha de azulejo turquesa.",
  },
  "N11-loja-roupa": {
    rotulo: "Loja de roupa",
    titulo: "Lojista, o desconto da blusinha saiu de onde?",
    subtitulo:
      "A Pólia One simula o desconto antes e mostra quanto ainda sobra de cada peça.",
    foto: "nicho-loja-roupa",
    alt: "Lojista mostrando um vestido estampado na arara da loja, com parede coral ao fundo.",
  },
  "N12-cosmeticos": {
    rotulo: "Revenda de cosméticos",
    titulo: "Revendedora, quanto sobra depois do frete e do parcelamento?",
    subtitulo:
      "A Pólia One coloca frete, taxa e parcelas na conta e mostra a sobra de cada venda.",
    foto: "nicho-cosmeticos",
    alt: "Mãos embalando cosméticos em uma caixa de envio, com papel de seda e produtos na mesa.",
  },
  "N14-social-media": {
    rotulo: "Social media",
    titulo: "Social media, o pacote mensal cobre as suas horas reais?",
    subtitulo:
      "A Pólia One calcula o serviço por hora e mostra quantos clientes fecham a meta do mês.",
    foto: "nicho-social-media",
    alt: "Social media gravando conteúdo com o celular no tripé, ao lado do notebook e de um café.",
  },
  "N15-psicologa": {
    rotulo: "Psicologia",
    titulo: "Psicóloga, quantas sessões fecham o seu mês?",
    subtitulo: "A Pólia One divide os custos fixos e mostra a meta do mês em sessões.",
    foto: "nicho-psicologa",
    alt: "Psicóloga sorrindo durante uma sessão no consultório, de frente para a paciente.",
  },
  "N16-nutricionista": {
    rotulo: "Nutrição",
    titulo: "Nutricionista, o retorno incluso está saindo de graça?",
    subtitulo:
      "A Pólia One coloca o retorno na conta da consulta e mostra o preço que se sustenta.",
    foto: "nicho-nutricionista",
    alt: "Nutricionista sorrindo enquanto monta um prato colorido na cozinha de azulejo verde.",
  },
  "N17-designer": {
    rotulo: "Design",
    titulo: "Designer, as rodadas de ajuste estão incluídas no seu preço?",
    subtitulo:
      "A Pólia One calcula o projeto por hora, com as revisões dentro, e mostra o preço que fecha o mês.",
    foto: "nicho-designer",
    alt: "Designer trabalhando na mesa digitalizadora em frente ao monitor, com referências no mural.",
  },
  "N18-papelaria": {
    rotulo: "Papelaria personalizada",
    titulo: "Papelaria personalizada, quanto custa de verdade cada lembrancinha?",
    subtitulo: "Papel, impressão, laço e a sua hora. A Pólia One junta tudo e sugere o preço.",
    foto: "nicho-papelaria",
    alt: "Mãos montando caixinhas de lembrancinha ao lado da plotter de recorte e dos papéis.",
  },
  "N19-croche": {
    rotulo: "Crochê",
    titulo: "Crocheteira, você cobra pelo fio ou pelas horas de ponto?",
    subtitulo: "A Pólia One coloca as suas horas na conta da peça, além do fio.",
    foto: "nicho-croche",
    alt: "Mãos com anéis finos fazendo crochê, com um cesto de novelos ao lado.",
  },
  "N20-saboaria": {
    rotulo: "Saboaria e velas",
    titulo: "Saboaria artesanal, a sua marca vale mais que o preço da feira?",
    subtitulo:
      "O Planejamento da marca e a Calculadora da Pólia One mostram por que o seu preço não é o da feira.",
    foto: "nicho-saboaria",
    alt: "Mãos amarrando barbante em sabonetes artesanais embalados, com velas na bancada.",
  },
  "N21-fotografa": {
    rotulo: "Fotografia",
    titulo: "Fotógrafa, o preço do ensaio inclui as horas de edição?",
    subtitulo:
      "Ensaio, edição, deslocamento e equipamento. A Pólia One faz a conta por hora e mostra o preço do pacote.",
    foto: "nicho-fotografa",
    alt: "Fotógrafa rindo com a câmera na mão durante um ensaio, com fundo amarelo no estúdio.",
  },
};

/** Fotos dos nichos, pra lista de fotos disponíveis da landing. */
export const FOTOS_NICHOS = Object.values(NICHOS).map((n) => n.foto);

/** O topo do nicho do anúncio, ou null quando o utm_content não é de nicho. */
export function nichoDaCampanha(utmContent: string | undefined): NichoLanding | null {
  if (!utmContent) return null;
  return NICHOS[utmContent.trim()] ?? null;
}
