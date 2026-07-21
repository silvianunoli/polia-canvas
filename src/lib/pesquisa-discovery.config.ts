// Config da pesquisa de discovery da Pólia (pública e anônima).
//
// UMA pesquisa, sem construtor (KISS). As perguntas moram aqui, versionadas e
// tipadas; a página pública renderiza a partir daqui e o painel de admin usa os
// mesmos rótulos para agregar. Mudou pergunta? Muda aqui.
//
// Posicionamento marca-primeiro: além de negócio e números, o bloco de
// marca/valor (compra_pesa, tem_marca, ouve_caro, inseguranca) é o que valida a
// tese "a dor lidera pela marca, não só pelo preço".

export type TipoPergunta = "unica" | "multipla" | "aberta";

export interface OpcaoPergunta {
  id: string;
  rotulo: string;
}

export interface Pergunta {
  id: string; // estável: é a chave em pesquisa_respostas.respostas
  ordem: number;
  parte: 1 | 2; // 1 = seu negócio, 2 = sobre você (perfil opcional)
  tipo: TipoPergunta;
  titulo: string;
  ajuda?: string;
  opcional?: boolean; // pode pular sem responder
  sensivel?: boolean; // dado pessoal (LGPD): sempre opcional + "prefiro não dizer"
  opcoes?: OpcaoPergunta[]; // unica / multipla
  maxSelecoes?: number; // multipla
  placeholder?: string; // aberta
}

export interface PesquisaConfig {
  slug: string;
  perguntas: Pergunta[];
}

export const SLUG_PESQUISA = "discovery-negocio";

export const PESQUISA_DISCOVERY: PesquisaConfig = {
  slug: SLUG_PESQUISA,
  perguntas: [
    // ---------- PARTE 1: SEU NEGÓCIO ----------
    {
      id: "categoria",
      ordem: 1,
      parte: 1,
      tipo: "unica",
      titulo: "O que você vende?",
      opcoes: [
        { id: "moda_acessorios", rotulo: "Moda e acessórios (roupas, bolsas, bijuteria)" },
        { id: "moda_intima_fitness", rotulo: "Moda íntima e fitness" },
        { id: "beleza_estetica", rotulo: "Beleza e estética (salão, unhas, cílios, sobrancelha)" },
        { id: "cosmeticos", rotulo: "Cosméticos e perfumaria" },
        { id: "artesanato", rotulo: "Artesanato e feito à mão" },
        { id: "comida", rotulo: "Comida e confeitaria" },
        { id: "saude_bem_estar", rotulo: "Saúde e bem-estar" },
        { id: "servicos", rotulo: "Serviços profissionais" },
        { id: "educacao", rotulo: "Educação e mentoria" },
        { id: "digital", rotulo: "Infoproduto ou digital" },
        { id: "casa_decoracao", rotulo: "Casa e decoração" },
        { id: "papelaria_presentes", rotulo: "Papelaria e presentes personalizados" },
        { id: "pet", rotulo: "Pet" },
        { id: "infantil", rotulo: "Infantil" },
        { id: "revenda", rotulo: "Revenda ou catálogo" },
        { id: "outro", rotulo: "Outro" },
      ],
    },
    {
      id: "tipo_venda",
      ordem: 2,
      parte: 1,
      tipo: "unica",
      titulo: "O que você vende, principalmente?",
      opcoes: [
        { id: "produto", rotulo: "Produto físico" },
        { id: "servico", rotulo: "Serviço" },
        { id: "digital", rotulo: "Digital ou infoproduto" },
        { id: "mistura", rotulo: "Uma mistura" },
      ],
    },
    {
      id: "canais",
      ordem: 3,
      parte: 1,
      tipo: "multipla",
      titulo: "Onde você vende hoje?",
      ajuda: "Marque todos que usa.",
      opcoes: [
        { id: "instagram", rotulo: "Instagram" },
        { id: "whatsapp", rotulo: "WhatsApp" },
        { id: "tiktok", rotulo: "TikTok" },
        { id: "loja_fisica", rotulo: "Loja física" },
        { id: "feira", rotulo: "Feira ou evento" },
        { id: "marketplace", rotulo: "Marketplace (Shopee, Mercado Livre)" },
        { id: "site_proprio", rotulo: "Site ou loja própria" },
        { id: "boca_a_boca", rotulo: "Boca a boca" },
      ],
    },
    {
      id: "tempo",
      ordem: 4,
      parte: 1,
      tipo: "unica",
      titulo: "Há quanto tempo você vende?",
      opcoes: [
        { id: "menos_6m", rotulo: "Menos de 6 meses" },
        { id: "6m_1a", rotulo: "De 6 meses a 1 ano" },
        { id: "1_3a", rotulo: "De 1 a 3 anos" },
        { id: "mais_3a", rotulo: "Mais de 3 anos" },
      ],
    },
    {
      id: "quem_toca",
      ordem: 5,
      parte: 1,
      tipo: "unica",
      titulo: "Quem toca o negócio hoje?",
      opcoes: [
        { id: "so_eu", rotulo: "Só eu" },
        { id: "ajuda_informal", rotulo: "Eu e uma ajuda informal (família, parceria)" },
        { id: "contratadas_1_2", rotulo: "Eu e 1 ou 2 contratadas" },
        { id: "equipe_3", rotulo: "Uma equipe de 3 ou mais" },
      ],
    },
    {
      id: "renda_principal",
      ordem: 6,
      parte: 1,
      tipo: "unica",
      titulo: "O negócio é a sua principal renda?",
      opcoes: [
        { id: "sustento", rotulo: "É o meu sustento" },
        { id: "extra", rotulo: "É uma renda extra" },
        { id: "quero", rotulo: "Ainda não me sustenta, mas quero que vire" },
        { id: "hobby", rotulo: "É mais um hobby que dá uns trocos" },
      ],
    },
    {
      id: "faturamento",
      ordem: 7,
      parte: 1,
      tipo: "unica",
      opcional: true,
      titulo: "Quanto o negócio fatura por mês, mais ou menos?",
      opcoes: [
        { id: "ate_1k", rotulo: "Até R$1 mil" },
        { id: "1_3k", rotulo: "De R$1 a 3 mil" },
        { id: "3_10k", rotulo: "De R$3 a 10 mil" },
        { id: "mais_10k", rotulo: "Mais de R$10 mil" },
        { id: "nao_dizer", rotulo: "Prefiro não dizer" },
      ],
    },
    {
      id: "preco_como",
      ordem: 8,
      parte: 1,
      tipo: "unica",
      titulo: "Quando você definiu o preço do seu último produto, como chegou no valor?",
      opcoes: [
        { id: "copiei", rotulo: "Copiei de quem vende parecido" },
        { id: "margem_olho", rotulo: "Somei o custo e coloquei margem no olho" },
        { id: "perguntei", rotulo: "Perguntei pra alguém" },
        { id: "planilha", rotulo: "Fiz conta em planilha" },
        { id: "justo", rotulo: "Botei o valor que me pareceu justo" },
        { id: "nao_calculei", rotulo: "Não parei pra calcular" },
      ],
    },
    {
      id: "separa_dinheiro",
      ordem: 9,
      parte: 1,
      tipo: "unica",
      titulo: "Você separa o dinheiro do negócio do seu dinheiro pessoal?",
      opcoes: [
        { id: "sempre", rotulo: "Sempre" },
        { id: "as_vezes", rotulo: "Às vezes" },
        { id: "tudo_junto", rotulo: "Não, é tudo junto" },
      ],
    },
    {
      id: "onde_clareza",
      ordem: 10,
      parte: 1,
      tipo: "multipla",
      maxSelecoes: 2,
      titulo: "O que mais te faz sentir falta de clareza no negócio hoje?",
      ajuda: "Escolha até 2.",
      opcoes: [
        { id: "quanto_cobrar", rotulo: "Não sei quanto cobrar" },
        { id: "dou_lucro", rotulo: "Não sei se dou lucro de verdade" },
        { id: "controle_caixa", rotulo: "Perco o controle do que entra e sai" },
        { id: "diferencial", rotulo: "Não sei o que me diferencia" },
        { id: "acham_caro", rotulo: "Minha cliente acha caro ou não entende meu valor" },
        { id: "quem_e_cliente", rotulo: "Não sei quem é a minha cliente" },
        { id: "no_controle", rotulo: "Me sinto no controle" },
      ],
    },
    {
      id: "organiza_hoje",
      ordem: 11,
      parte: 1,
      tipo: "unica",
      titulo: "Como você organiza as contas e o planejamento hoje?",
      opcoes: [
        { id: "caderno", rotulo: "Caderno ou papel" },
        { id: "planilha", rotulo: "Planilha própria" },
        { id: "app_financas", rotulo: "App de finanças" },
        { id: "de_cabeca", rotulo: "É tudo de cabeça" },
        { id: "contador", rotulo: "Meu contador cuida" },
        { id: "nao_organizo", rotulo: "Não organizo" },
      ],
    },
    {
      id: "tentou_largou",
      ordem: 12,
      parte: 1,
      tipo: "unica",
      titulo: "Você já tentou algo pra ter mais clareza no negócio?",
      opcoes: [
        { id: "larguei", rotulo: "Sim, tentei e larguei" },
        { id: "ainda_uso", rotulo: "Sim, e ainda uso" },
        { id: "nunca", rotulo: "Nunca tentei" },
      ],
    },
    {
      id: "ja_pagou",
      ordem: 13,
      parte: 1,
      tipo: "unica",
      titulo:
        "Você já pagou por algo pra ajudar no negócio (curso, mentoria, ferramenta, consultoria)?",
      opcoes: [
        { id: "nunca", rotulo: "Nunca" },
        { id: "uma", rotulo: "Uma vez" },
        { id: "varias", rotulo: "Mais de uma vez" },
      ],
    },
    {
      id: "trava",
      ordem: 14,
      parte: 1,
      tipo: "unica",
      titulo: "O que mais te trava pra resolver isso?",
      opcoes: [
        { id: "tempo", rotulo: "Falta de tempo" },
        { id: "comecar", rotulo: "Não sei por onde começar" },
        { id: "complicado", rotulo: "Parece complicado demais" },
        { id: "nao_deu", rotulo: "Já tentei e não deu certo" },
        { id: "nao_confio", rotulo: "Não confio em curso ou ferramenta" },
        { id: "custo", rotulo: "O custo" },
        { id: "nada", rotulo: "Nada me trava" },
      ],
    },
    {
      id: "compra_pesa",
      ordem: 15,
      parte: 1,
      tipo: "unica",
      titulo: "Na hora que alguém decide comprar de você, o que pesa mais?",
      opcoes: [
        { id: "preco", rotulo: "O preço" },
        { id: "marca", rotulo: "O que a minha marca representa" },
        { id: "os_dois", rotulo: "Os dois igual" },
        { id: "nao_sei", rotulo: "Sinceramente, não sei" },
      ],
    },
    {
      id: "tem_marca",
      ordem: 16,
      parte: 1,
      tipo: "unica",
      titulo: "Você sente que tem uma marca, ou que só vende produtos?",
      opcoes: [
        { id: "tenho", rotulo: "Tenho uma marca" },
        { id: "construindo", rotulo: "Tô construindo" },
        { id: "so_vendo", rotulo: "Sinto que só vendo produtos" },
      ],
    },
    {
      id: "ouve_caro",
      ordem: 17,
      parte: 1,
      tipo: "unica",
      titulo: 'Com que frequência você ouve "tá caro" ou perde venda por causa do preço?',
      opcoes: [
        { id: "direto", rotulo: "Direto" },
        { id: "as_vezes", rotulo: "Às vezes" },
        { id: "quase_nunca", rotulo: "Quase nunca" },
      ],
    },
    {
      id: "inseguranca",
      ordem: 18,
      parte: 1,
      tipo: "unica",
      titulo: "O que te dá mais insegurança hoje?",
      opcoes: [
        { id: "marca", rotulo: "A minha marca e identidade" },
        { id: "precos", rotulo: "Os meus preços" },
        { id: "numeros", rotulo: "Os meus números" },
        { id: "nada", rotulo: "Nada, tô segura" },
      ],
    },
    {
      id: "se_claro",
      ordem: 19,
      parte: 1,
      tipo: "unica",
      titulo: "Se o seu negócio ficasse claro amanhã, o que mudaria primeiro?",
      opcoes: [
        { id: "cobrar_mais", rotulo: "Cobraria mais sem medo" },
        { id: "saber_lucro", rotulo: "Saberia se dou lucro" },
        { id: "nao_perdida", rotulo: "Pararia de me sentir perdida" },
        { id: "crescer", rotulo: "Cresceria com segurança" },
        { id: "trabalhar_menos", rotulo: "Trabalharia menos" },
        { id: "outro", rotulo: "Outro" },
      ],
    },
    {
      id: "aperto",
      ordem: 20,
      parte: 1,
      tipo: "aberta",
      opcional: true,
      titulo: "Com as suas palavras: qual é o maior aperto ou dúvida sobre o seu negócio hoje?",
      ajuda: "Opcional, mas é a resposta que mais ajuda.",
      placeholder: "Escreve do seu jeito...",
    },
    {
      id: "episodio",
      ordem: 21,
      parte: 1,
      tipo: "aberta",
      opcional: true,
      titulo:
        "Me conta a última vez que você se sentiu perdida ou insegura numa decisão do negócio. O que aconteceu?",
      ajuda: "Opcional. É a pergunta de história, a que mais rende.",
      placeholder: "Conta como foi...",
    },
    // ---------- PARTE 2: SOBRE VOCÊ (perfil, opcional) ----------
    {
      id: "idade",
      ordem: 22,
      parte: 2,
      tipo: "unica",
      opcional: true,
      sensivel: true,
      titulo: "Sua idade",
      opcoes: [
        { id: "18_24", rotulo: "18 a 24" },
        { id: "25_34", rotulo: "25 a 34" },
        { id: "35_44", rotulo: "35 a 44" },
        { id: "45_54", rotulo: "45 a 54" },
        { id: "55_mais", rotulo: "55 ou mais" },
        { id: "nao_dizer", rotulo: "Prefiro não dizer" },
      ],
    },
    {
      id: "escolaridade",
      ordem: 23,
      parte: 2,
      tipo: "unica",
      opcional: true,
      sensivel: true,
      titulo: "Sua escolaridade",
      opcoes: [
        { id: "fundamental", rotulo: "Fundamental" },
        { id: "medio", rotulo: "Médio" },
        { id: "superior_inc", rotulo: "Superior incompleto" },
        { id: "superior", rotulo: "Superior completo" },
        { id: "pos", rotulo: "Pós-graduação" },
        { id: "nao_dizer", rotulo: "Prefiro não dizer" },
      ],
    },
    {
      id: "estudou_negocios",
      ordem: 24,
      parte: 2,
      tipo: "unica",
      opcional: true,
      titulo: "Você estudou algo ligado a negócios ou gestão?",
      opcoes: [
        { id: "formacao", rotulo: "Sim, tenho formação na área" },
        { id: "cursos", rotulo: "Fiz cursos livres" },
        { id: "pratica", rotulo: "Não, aprendi na prática" },
      ],
    },
  ],
};

export const TOTAL_PERGUNTAS = PESQUISA_DISCOVERY.perguntas.length;

export const PERGUNTAS_POR_ID: Record<string, Pergunta> = Object.fromEntries(
  PESQUISA_DISCOVERY.perguntas.map((p) => [p.id, p]),
);

export function perguntaPorOrdem(ordem: number): Pergunta | undefined {
  return PESQUISA_DISCOVERY.perguntas.find((p) => p.ordem === ordem);
}
