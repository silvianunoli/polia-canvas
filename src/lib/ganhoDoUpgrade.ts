// Frase do que o plano libera, por tela de origem. Usada pela /upgrade e pela
// /assinar (que desde 09/10/2026 recebe quem está no Grátis direto, com os
// dois planos lado a lado: pedido da Sil, "não vamos fazer a usuária pensar
// muito").

// O ganho concreto da área de onde ela veio. Sem rota conhecida, cai no fallback.
export const GANHO_POR_ROTA: Record<string, string> = {
  "/financeiro": "Aqui entra tudo que entrou e saiu, e o Premium mostra quanto sobrou no mês.",
  // Botão "Resumo pro contador" do Financeiro: a tela já abre no Premium, o
  // que é do Pro é o resumo (08/10/2026).
  "/financeiro/resumo": "O Pro monta o resumo do mês pro contador, em PDF e CSV.",
  "/produtos": "O Premium solta o limite: cada produto com o custo, o preço e quanto sobra.",
  "/calculadora":
    "O Pro abre o modo Encomenda: o preço de um pedido sob medida, material por material.",
  // Raio-x é Pro, não Premium (ROTAS_PROJETE + o portão `temProjete` dentro
  // da página). Nomear o Premium aqui vendia por R$ 29,90 uma tela que só abre
  // no Pro, e ainda contradizia o selo "Recurso do plano Pro" logo acima.
  "/raiox": "O Pro lê o seu mês e devolve onde o dinheiro está vazando.",
  "/projecao": "O Pro mostra quantas vendas fecham o mês e quantas pagam o seu salário.",
  // O banco tem 60 ideias por nicho, que se repetem ao longo do ano: não
  // prometer "uma ideia nova por dia" (08/10/2026).
  "/plano-conteudo":
    "O Pro monta o plano de conteúdo do ano: 60 ideias do seu nicho espalhadas pelos dias, uma por dia.",
  // Rotas pagas que caíam no fallback genérico (08/10/2026).
  "/marca": "O Premium escreve o documento da sua Marca a partir do que o Planejamento já sabe.",
  "/mercado": "O Premium monta o Mapa de Mercado a partir das respostas do Planejamento.",
  "/calendario": "O Premium abre o Calendário, com a agenda do Google junto.",
  "/clientes": "O Premium mostra cada cliente com o status do pedido, da espera à entrega.",
  // Telas com cota no Grátis: a tela abre, o que o Premium muda é o limite.
  "/caderno": "O Premium tira o limite do Caderno: notas sem teto.",
  "/planner": "O Premium tira o limite do Planner: quadros sem teto.",
  "/aimer": "O Premium aumenta o teto diário do Assistente.",
};

// Telas que abrem no Grátis com limite. Sem frase própria, o fallback não
// pode dizer "essa tela abre": ela já está aberta, o que muda é o limite
// ("aumenta", não "tira": a IA do Planejamento tem teto até no Pro).
export const ROTAS_COM_COTA = ["/caderno", "/planner", "/produtos", "/planejamento", "/aimer"];

/** O ganho concreto pra tela de onde ela veio, no nome do plano que a tela pede. */
export function fraseDoGanho(rota: string | undefined, tituloDoPlano: string): string {
  const rotaComCota = !!rota && ROTAS_COM_COTA.some((r) => rota.startsWith(r));
  return (
    (rota ? GANHO_POR_ROTA[rota] : undefined) ??
    (rotaComCota
      ? `O ${tituloDoPlano} aumenta o limite.`
      : `Assinando o ${tituloDoPlano}, essa tela abre na sua conta na hora.`)
  );
}
