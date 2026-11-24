import { useEffect, useMemo, useState } from "react";
import { precoQueVale } from "@/lib/precoPromocional";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles, AlertTriangle, TrendingDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { useUserMeta } from "@/hooks/useUserMeta";
import { PaginaLogada } from "@/components/layout/PaginaLogada";
import { Vazio } from "@/components/layout/Vazio";
import { UpgradeGate } from "@/components/layout/UpgradeGate";
import { Campo } from "@/components/ui/Campo";
import { BTN_ACAO, BTN_MIUDO_ACAO } from "@/lib/botoes";
import { track } from "@/lib/analytics";
import { toastErro, toastSucesso } from "@/lib/toast";
import { registrar } from "@/lib/founder-eventos";
import {
  acaoDaMeta,
  CATEGORIA_EQUIPAMENTO,
  CATEGORIA_INSUMOS,
  custosFixosDePartida,
  custoMedio,
  entradasDoMes,
  insumosDoMes,
  lerValorReais,
  mediaTaxas,
  mesAnterior,
  montarFaltaNoMes,
  montarProjecao,
  paraCampoReais,
  proLaboreJaLancado,
  reservaForaDoFinanceiro,
  salarioDePartida,
  separarForaDaCurva,
  sobraPorVenda,
  ticketMedio,
  valorDoCampo,
} from "@/lib/projecao.functions";
import { temNumerosDoMes, tierDosNumeros, tiersPagos } from "@/lib/planos";
import { buscarMetaDoMes, TITULO_META_DO_MES } from "@/lib/metaDoMes";
import { intervaloDoMes, lerTodasAsPaginas } from "@/lib/leituraPaginada";
import type { FaltaNoMes, ProdutoResumo } from "@/lib/projecao.functions";
import { CATEGORIA_PRO_LABORE } from "@/lib/resumoContador.functions";
import { resumoEquipamentos } from "@/lib/equipamentos";
import { useEquipamentos } from "@/components/produtos/equipamentosDados";

type ProdutoDaProjecao = ProdutoResumo & { nome: string };
import type { LancamentoResumo } from "@/lib/resumoContador.functions";

export const Route = createFileRoute("/_authenticated/projecao")({
  head: () => ({
    meta: [
      { title: "Projeção e cenários · Pólia One" },
      { name: "description", content: "Quantas vendas pra se pagar esse mês." },
    ],
  }),
  component: ProjecaoPage,
});

function fmtBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function nomeDoMes(mes: number, ano: number): string {
  return new Date(ano, mes - 1, 1).toLocaleDateString("pt-BR", { month: "long" });
}

function comMaiuscula(s: string): string {
  return s.charAt(0).toLocaleUpperCase("pt-BR") + s.slice(1);
}

function vendasTxt(n: number): string {
  return `${n} ${n === 1 ? "venda" : "vendas"}`;
}

/**
 * Valor inicial de um campo editável, arredondado a 2 casas.
 * `ticketMedio` e `custoMedio` são médias, e chegavam com a precisão binária
 * inteira: o campo abria com "898.5714285714286". Desde 08/10/2026 (QA-29) sai
 * com vírgula decimal ("898,57"), que é como ela escreve e como lerValorReais lê.
 */
const paraCampo = paraCampoReais;

function ProjecaoPage() {
  const { user } = useSupabaseSession();
  const userId = user?.id;
  const meta = useUserMeta();
  const ehProjete = temNumerosDoMes(meta.plano);
  const qc = useQueryClient();

  const hoje = new Date();
  const mesAtual = hoje.getMonth() + 1;
  const anoAtual = hoje.getFullYear();

  const dadosQuery = useQuery({
    queryKey: ["projecao", userId],
    enabled: !!userId && ehProjete,
    queryFn: async () => {
      // A Projeção usa o mês corrente (o que já entrou) e o mês fechado (custos
      // fixos e pró-labore de um mês inteiro, ONE-241): filtra no banco e lê
      // inteiro, página por página (QA-24/QA-29). Antes lia tudo sem paginar e
      // o PostgREST cortava em 1.000 linhas.
      const ant = mesAnterior(mesAtual, anoAtual);
      const mes = {
        inicio: intervaloDoMes(ant.ano, ant.mes).inicio,
        fimExclusivo: intervaloDoMes(anoAtual, mesAtual).fimExclusivo,
      };
      const [lancamentosMes, prodRes, metaRes, perfilRes, planejamentoRes] = await Promise.all([
        lerTodasAsPaginas<LancamentoResumo>((de, ate) =>
          supabase
            .from("lancamentos")
            .select("id, tipo, valor, data, descricao, categoria")
            .eq("user_id", userId!)
            .gte("data", mes.inicio)
            .lt("data", mes.fimExclusivo)
            .order("data", { ascending: false })
            .order("id", { ascending: true })
            .range(de, ate)
            .then((r) => ({
              data: r.data as unknown as LancamentoResumo[] | null,
              error: r.error,
            })),
        ),
        supabase
          .from("produtos")
          .select("nome, preco_venda, preco_promocional, preco_custo, calculadora_breakdown")
          .eq("user_id", userId!)
          .eq("arquivado", false)
          .gt("preco_venda", 0),
        buscarMetaDoMes(supabase, userId!),
        supabase.from("profiles").select("pro_labore_desejado").eq("id", userId!).maybeSingle(),
        // "Quanto você quer receber por mês" do Módulo 4 é o mesmo salário: sem
        // salário salvo aqui, ele é o ponto de partida (ONE-102). Leitura
        // opcional: se falhar, o campo só começa vazio, como antes.
        supabase
          .from("planejamento_campos" as never)
          .select("valor")
          .eq("user_id", userId!)
          .eq("campo", "financeiro.meta_mensal")
          .maybeSingle(),
      ]);
      // Antes os erros destas leituras eram ignorados: produto ou meta que não
      // carregou virava "sem produto" / "sem meta" calado. Agora cai na tela
      // de "não conseguiu puxar os seus números".
      const falha = [prodRes, metaRes, perfilRes].find((r) => (r as { error: unknown }).error);
      if (falha) throw (falha as { error: unknown }).error;
      const produtosRaw = (prodRes.data ?? []) as unknown as {
        nome: string;
        preco_venda: number;
        preco_promocional: number | null;
        preco_custo: number | null;
        calculadora_breakdown: ProdutoResumo["calculadora_breakdown"];
      }[];
      return {
        lancamentos: lancamentosMes,
        produtos: produtosRaw.map(
          (p): ProdutoDaProjecao => ({
            nome: p.nome,
            // Com promoção, a Projeção conta o promocional (ONE-239, Sil 24/11/2026).
            precoVenda: precoQueVale(p.preco_venda, p.preco_promocional),
            precoCusto: p.preco_custo,
            calculadora_breakdown: p.calculadora_breakdown,
          }),
        ),
        metaMes: (metaRes.data ?? null) as { id: string; valor_alvo: number | null } | null,
        proLaboreSalvo:
          (perfilRes.data as { pro_labore_desejado: number | null } | null)?.pro_labore_desejado ??
          null,
        proLaboreDoPlanejamento: (() => {
          const texto = (planejamentoRes.data as { valor?: string } | null)?.valor ?? "";
          const n = lerValorReais(texto);
          return n != null && !Number.isNaN(n) && n > 0 ? n : null;
        })(),
      };
    },
  });

  useEffect(() => {
    if (ehProjete) track("projecao_aberta");
  }, [ehProjete]);

  const dados = dadosQuery.data;
  const lancamentos = useMemo(() => dados?.lancamentos ?? [], [dados?.lancamentos]);
  const produtos = useMemo(() => dados?.produtos ?? [], [dados?.produtos]);
  const metaMes = dados?.metaMes ?? null;

  const ant = mesAnterior(mesAtual, anoAtual);
  const nomeMesAtual = nomeDoMes(mesAtual, anoAtual);
  const nomeMesAnterior = nomeDoMes(ant.mes, ant.ano);

  // ONE-241: o maior entre o mês fechado e o mês corrente (ver custosFixosDePartida).
  const fixos = useMemo(
    () => custosFixosDePartida(lancamentos, mesAtual, anoAtual),
    [lancamentos, mesAtual, anoAtual],
  );
  // ONE-251: a parcela mensal dos equipamentos entra nos custos fixos, menos o
  // que ela já lançou como reserva no Financeiro no mesmo mês. Se a leitura dos
  // equipamentos falhar, a reserva fica fora e a dica do campo avisa.
  const equipamentosQuery = useEquipamentos(userId, ehProjete);
  const reservaDoMes = resumoEquipamentos(equipamentosQuery.data ?? []).reservaDoMes;
  const mesDosFixos = fixos.origem === "mes-anterior" ? ant : { mes: mesAtual, ano: anoAtual };
  const reservaEquipamentos = reservaForaDoFinanceiro({
    lancamentos,
    mes: mesDosFixos.mes,
    ano: mesDosFixos.ano,
    reservaDoMes,
  });
  const custosFixosBase = Math.round((fixos.valor + reservaEquipamentos) * 100) / 100;
  // Insumo do mês de onde os custos fixos vieram (só pra linha de ajuda).
  const insumosForaBase = useMemo(
    () =>
      fixos.origem === "mes-anterior"
        ? insumosDoMes(lancamentos, ant.mes, ant.ano)
        : insumosDoMes(lancamentos, mesAtual, anoAtual),
    [lancamentos, fixos.origem, ant.mes, ant.ano, mesAtual, anoAtual],
  );
  // ONE-241: o pró-labore lançado no mês corrente não é mais o salário de
  // partida (pode ser só uma parte); aparece só na linha de ajuda.
  const proLaboreLancadoNoMes = useMemo(
    () => proLaboreJaLancado(lancamentos, mesAtual, anoAtual),
    [lancamentos, mesAtual, anoAtual],
  );
  const salario = useMemo(
    () =>
      salarioDePartida({
        salvo: dados?.proLaboreSalvo ?? null,
        doPlanejamento: dados?.proLaboreDoPlanejamento ?? null,
        lancadoMesAnterior: proLaboreJaLancado(lancamentos, ant.mes, ant.ano),
      }),
    [dados?.proLaboreSalvo, dados?.proLaboreDoPlanejamento, lancamentos, ant.mes, ant.ano],
  );
  const proLaboreBase = salario.valor;
  const jaEntrou = useMemo(
    () => entradasDoMes(lancamentos, mesAtual, anoAtual),
    [lancamentos, mesAtual, anoAtual],
  );
  // ONE-122: produto fora da curva sai das médias, a menos que ela peça
  // pra usar todos. A tela mostra quem saiu: a Pólia não esconde a conta.
  const [usarTodosNaMedia, setUsarTodosNaMedia] = useState(false);
  const curva = useMemo(() => separarForaDaCurva(produtos), [produtos]);
  const produtosNaMedia = useMemo(
    () => (usarTodosNaMedia ? [...curva.naMedia, ...curva.foraDaCurva] : curva.naMedia),
    [curva, usarTodosNaMedia],
  );
  const ticketBase = useMemo(() => ticketMedio(produtosNaMedia), [produtosNaMedia]);
  const custoBase = useMemo(() => custoMedio(produtosNaMedia), [produtosNaMedia]);
  const qtdProdutosNaMedia = produtosNaMedia.length;
  const taxasBase = useMemo(() => mediaTaxas(produtosNaMedia), [produtosNaMedia]);

  const [custosFixosTxt, setCustosFixosTxt] = useState<string | null>(null);
  const [proLaboreTxt, setProLaboreTxt] = useState<string | null>(null);
  const [ticketTxt, setTicketTxt] = useState<string | null>(null);
  const [custoTxt, setCustoTxt] = useState<string | null>(null);
  const [metaTxt, setMetaTxt] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erroValidacao, setErroValidacao] = useState<Record<string, string>>({});

  const custosFixos = valorDoCampo(custosFixosTxt, custosFixosBase, 0);
  const proLaboreDesejado = valorDoCampo(proLaboreTxt, proLaboreBase ?? 0, 0);
  const ticket = valorDoCampo(ticketTxt, ticketBase, 0);
  const custo = valorDoCampo(custoTxt, custoBase, 0);
  const metaAlvo = valorDoCampo(metaTxt, metaMes?.valor_alvo ?? null, null);

  // Sobra com os números REAIS (sem edição): decide se a tela inteira vira o
  // aviso "nenhuma venda deixa sobra". A sobra do cenário editado não decide
  // isso: antes, apagar o ticket médio pra digitar outro (ticket 0, sobra 0)
  // trocava a tela pelo aviso e os campos sumiam junto, sem volta.
  const sobraReal = useMemo(
    () => sobraPorVenda({ ticketMedio: ticketBase, custoMedio: custoBase, ...taxasBase }),
    [ticketBase, custoBase, taxasBase],
  );
  const sobra = useMemo(
    () => sobraPorVenda({ ticketMedio: ticket, custoMedio: custo, ...taxasBase }),
    [ticket, custo, taxasBase],
  );

  const projecao = useMemo(
    () => montarProjecao({ custosFixos, proLaboreDesejado, metaAlvo, ticketMedio: ticket, sobra }),
    [custosFixos, proLaboreDesejado, metaAlvo, ticket, sobra],
  );
  const falta = useMemo(
    () =>
      montarFaltaNoMes({
        custosFixos,
        proLaboreDesejado,
        metaAlvo,
        ticketMedio: ticket,
        sobra,
        jaEntrou,
      }),
    [custosFixos, proLaboreDesejado, metaAlvo, ticket, sobra, jaEntrou],
  );

  // ONE-241: cenário com antes e depois. Simulação = mexeu em custos fixos,
  // ticket ou custo (o "e se"). Salário e meta são valores que ela salva, então
  // não contam como cenário. O "real" usa os mesmos salário e meta da tela, pra
  // a diferença mostrar só o efeito do cenário.
  const emSimulacao = custosFixosTxt != null || ticketTxt != null || custoTxt != null;
  const faltaReal = useMemo(
    () =>
      montarFaltaNoMes({
        custosFixos: custosFixosBase,
        proLaboreDesejado,
        metaAlvo,
        ticketMedio: ticketBase,
        sobra: sobraReal,
        jaEntrou,
      }),
    [custosFixosBase, proLaboreDesejado, metaAlvo, ticketBase, sobraReal, jaEntrou],
  );
  // Compara em centavos: o campo abre arredondado (898,57) e a média real tem
  // mais casas (898,5714...), o que sem isso virava "de R$ 898,57 para R$ 898,57".
  const difere = (a: number, b: number) => Math.round(a * 100) !== Math.round(b * 100);
  const mudancasDoCenario = [
    difere(custosFixos, custosFixosBase)
      ? `custos fixos de ${fmtBRL(custosFixosBase)} para ${fmtBRL(custosFixos)}`
      : null,
    difere(ticket, ticketBase)
      ? `ticket médio de ${fmtBRL(ticketBase)} para ${fmtBRL(ticket)}`
      : null,
    difere(custo, custoBase) ? `custo médio de ${fmtBRL(custoBase)} para ${fmtBRL(custo)}` : null,
  ].filter((m): m is string => m != null);
  const ticketMais10 = paraCampo(ticketBase * 1.1);
  const custoMenos10 = paraCampo(custoBase * 0.9);

  const validarCampo = (chave: string, valor: string) => {
    const n = lerValorReais(valor);
    setErroValidacao((prev) => {
      const novo = { ...prev };
      if (Number.isNaN(n)) novo[chave] = "Coloque um valor em reais.";
      else delete novo[chave];
      return novo;
    });
  };

  // Os 10% saem sempre do valor real: antes saíam do valor da tela, e dois
  // cliques davam 21% com o botão ainda dizendo 10%.
  const aplicarCenarioPreco = () => setTicketTxt(ticketMais10);
  const aplicarCenarioCusto = () => setCustoTxt(custoMenos10);
  // O salário fica: ele não é cenário, é o que ela quer tirar e ainda vai
  // salvar. Antes "Voltar ao valor real" apagava o que ela tinha acabado de
  // digitar e o "Salvar" seguinte gravava 0 (teste de 08/10/2026).
  const voltarAoValorReal = () => {
    setCustosFixosTxt(null);
    setTicketTxt(null);
    setCustoTxt(null);
    setMetaTxt(null);
    setErroValidacao(
      (prev): Record<string, string> => (prev.proLabore ? { proLabore: prev.proLabore } : {}),
    );
  };

  const confirmar = async () => {
    if (Object.keys(erroValidacao).length > 0) return;
    setSalvando(true);
    try {
      // .select("id") confirma que a linha foi mesmo gravada: com RLS, um
      // update que não acha a linha volta sem erro e sem nada salvo.
      const { data: perfilSalvo, error: erroPerfil } = await supabase
        .from("profiles")
        .update({ pro_labore_desejado: proLaboreDesejado })
        .eq("id", userId!)
        .select("id");
      if (erroPerfil) throw erroPerfil;
      if (!perfilSalvo?.length) throw new Error("perfil não atualizado");

      const acao = acaoDaMeta({
        metaId: metaMes?.id ?? null,
        editada: metaTxt != null,
        valor: metaAlvo,
      });
      if (acao === "atualizar" && metaMes?.id) {
        const { data: metaSalva, error: erroMeta } = await supabase
          .from("metas")
          .update({ valor_alvo: metaAlvo!, updated_at: new Date().toISOString() })
          .eq("id", metaMes.id)
          .select("id");
        if (erroMeta) throw erroMeta;
        if (!metaSalva?.length) throw new Error("meta não atualizada");
      } else if (acao === "criar") {
        // Mesmo formato da linha que a trigger materializar_planejamento cria
        // (da_jornada = true): se depois ela responder a meta no Planejamento,
        // a trigger atualiza ESTA linha em vez de criar uma segunda.
        const { error: erroMeta } = await supabase.from("metas").insert({
          user_id: userId!,
          titulo: TITULO_META_DO_MES,
          formato: "moeda",
          valor_alvo: metaAlvo!,
          valor_atual: 0,
          status: "ativa",
          da_jornada: true,
        });
        if (erroMeta) throw erroMeta;
      }
      toastSucesso(acao === "manter" ? "Salário salvo." : "Salário e meta salvos.");
      track("projecao_confirmada", { proLaboreDesejado, metaAlvo });
      void registrar("feature_completed", {
        feature: "projecao",
        propriedades: { acao: "confirmada" },
      });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["projecao", userId] }),
        qc.invalidateQueries({ queryKey: ["meta-do-mes", userId] }),
        qc.invalidateQueries({ queryKey: ["financeiro", userId] }),
      ]);
    } catch (e) {
      console.error("projecao: falha ao salvar", e);
      toastErro(
        "A Pólia One não conseguiu salvar agora. Tenta de novo, os números continuam na tela.",
      );
    } finally {
      setSalvando(false);
    }
  };

  // Só barra depois de saber o plano de verdade — ver `carregando` em useUserMeta.
  if (meta.carregando) {
    return (
      <PaginaLogada eyebrow="Projeção" titulo="Quanto vender pra se pagar.">
        <div className="h-40 animate-pulse rounded-xl bg-[var(--surface)] motion-reduce:animate-none" />
      </PaginaLogada>
    );
  }

  if (!ehProjete) {
    return (
      <UpgradeGate
        eyebrow="Projeção"
        titulo={`Projeção é do ${tiersPagos()[tierDosNumeros()].titulo}`}
        feature="Quantas vendas e quanto de faturamento pra empatar, se pagar e bater a meta do mês, tudo a partir do que já está na Pólia One."
        rota="/projecao"
        tier={tierDosNumeros()}
      />
    );
  }

  const semProduto = !dadosQuery.isLoading && produtos.length === 0;
  const semCusto =
    !dadosQuery.isLoading && !semProduto && fixos.valor === 0 && custosFixosTxt == null;
  // Dica do campo de custos fixos: de onde veio o número, o que ficou fora e a
  // reserva dos equipamentos. Mês anterior zerado não vira "maiores que R$ 0,00".
  const dicaOrigemFixos =
    fixos.origem === "mes-anterior"
      ? `Vem das saídas de ${nomeMesAnterior}, o último mês fechado. Em ${nomeMesAtual} já saíram ${fmtBRL(fixos.doMesAtual)} até agora.`
      : fixos.doMesAnterior > 0
        ? `Saídas de ${nomeMesAtual} até agora, já maiores que as de ${nomeMesAnterior} (${fmtBRL(fixos.doMesAnterior)}).`
        : `Saídas de ${nomeMesAtual} até agora. ${comMaiuscula(nomeMesAnterior)} não tem custo fixo lançado no Financeiro.`;
  const dicaReserva = equipamentosQuery.isError
    ? " A reserva dos equipamentos não carregou e ficou fora dessa soma."
    : reservaEquipamentos > 0
      ? ` Inclui ${fmtBRL(reservaEquipamentos)} da reserva dos equipamentos (aba Equipamentos, em Produtos).`
      : "";
  const dicaFora =
    insumosForaBase > 0
      ? ` Ficam fora os ${fmtBRL(insumosForaBase)} lançados em ${CATEGORIA_INSUMOS}: insumo já está no custo de cada produto. ${CATEGORIA_EQUIPAMENTO} também fica fora.`
      : ` Saída em ${CATEGORIA_INSUMOS} fica fora: insumo já está no custo de cada produto. ${CATEGORIA_EQUIPAMENTO} também fica fora.`;

  return (
    <PaginaLogada
      dica="projecao"
      largura="larga"
      eyebrow="Projeção"
      titulo="Quanto vender pra se pagar."
      subtitulo={`Quantas vendas ainda faltam em ${nomeMesAtual} pra empatar, pra se pagar e pra bater a meta.`}
    >
      <div>
        {dadosQuery.isLoading ? (
          <div className="mt-6 h-64 animate-pulse rounded-xl bg-[var(--surface)] motion-reduce:animate-none" />
        ) : dadosQuery.isError ? (
          <div className="mt-6">
            <Vazio
              icone={AlertTriangle}
              titulo="A Pólia One não conseguiu puxar os seus números agora."
              texto="Pode ter sido a conexão. Nada do que já está salvo se perdeu."
              acao={
                <button
                  type="button"
                  onClick={() => void dadosQuery.refetch()}
                  className={BTN_ACAO}
                >
                  Tentar de novo
                </button>
              }
            />
          </div>
        ) : semProduto ? (
          <div className="mt-6">
            <Vazio
              icone={Sparkles}
              titulo="Ainda não dá pra projetar."
              texto="Pra projetar, a Pólia One precisa saber quanto uma venda dá de lucro e quanto custa o seu mês. Comece precificando 1 produto."
              acao={
                <Link to="/produtos" className={BTN_ACAO}>
                  Ir pros Produtos
                </Link>
              }
            />
          </div>
        ) : sobraReal <= 0 ? (
          <div className="mt-6">
            <Vazio
              icone={TrendingDown}
              titulo="Nenhuma venda está dando lucro."
              texto="Do jeito que está, cada venda não deixa nada, então não existe número de vendas que se pague. Reveja o preço ou o custo."
              acao={
                <Link to="/calculadora" className={BTN_ACAO}>
                  Ir pra calculadora
                </Link>
              }
            />
          </div>
        ) : (
          <>
            {semCusto && (
              <p className="mt-6 rounded-lg bg-[var(--surface)] px-3 py-2 text-[13px] text-[var(--ink-soft)]">
                Nenhum custo fixo lançado em {nomeMesAnterior} nem em {nomeMesAtual}. Com eles no
                Financeiro, a conta de quanto vender pra se pagar fica certa.{" "}
                <Link
                  to="/financeiro"
                  className="font-medium text-[var(--secondary-text)] no-underline hover:underline"
                >
                  Ir pro Financeiro
                </Link>
              </p>
            )}

            <div className="mt-6 rounded-xl border border-[var(--line)] bg-white p-6">
              {/* Cenário editado sem sobra (ticket apagado, custo acima do preço):
                  avisa no lugar das linhas e mantém os campos na tela. */}
              {/* ONE-241: aviso de simulação, pra ela saber que o número de baixo
                  é do cenário e não do mês dela. */}
              {emSimulacao && projecao && mudancasDoCenario.length > 0 && (
                <p className="mb-4 rounded-lg bg-[var(--surface)] px-3 py-2 text-[13px] text-[var(--ink-soft)]">
                  <span className="font-semibold text-[var(--ink)]">Simulação:</span>{" "}
                  {mudancasDoCenario.join(", ")}. O cadastro não muda.
                </p>
              )}
              {!projecao || !falta ? (
                <p role="status" className="text-[15px] text-[var(--ink)]">
                  Com esse ticket médio e esse custo, cada venda não dá lucro, então não existe
                  número de vendas que se pague. Ajuste os valores abaixo ou volte ao valor real.
                </p>
              ) : (
                <div className="space-y-3" aria-live="polite">
                  <p className="text-[13px] text-[var(--muted)]">
                    {jaEntrou > 0
                      ? `Em ${nomeMesAtual} já entraram ${fmtBRL(jaEntrou)} no Financeiro. A conta abaixo desconta isso.`
                      : `Em ${nomeMesAtual} ainda não entrou nada no Financeiro, então a conta abaixo é do mês inteiro.`}
                  </p>
                  <LinhaFalta
                    rotulo="Pra empatar"
                    falta={falta.empatar}
                    totalNoMes={projecao.empatar.vendas}
                    real={emSimulacao ? faltaReal?.empatar : undefined}
                    feito="já empatou"
                  />
                  {/* Sem pró-labore preenchido a linha repetiria a de empatar: em vez do
                    número, a tela pede o dado que falta. */}
                  {proLaboreDesejado > 0 ? (
                    <LinhaFalta
                      rotulo={`Pra pagar o seu salário (${fmtBRL(proLaboreDesejado)} por mês)`}
                      falta={falta.sePagar}
                      totalNoMes={projecao.sePagar.vendas}
                      real={emSimulacao ? faltaReal?.sePagar : undefined}
                      feito="as vendas do mês já cobrem"
                    />
                  ) : (
                    <p className="text-[16px] text-[var(--ink)]">
                      Pra pagar o seu salário: falta dizer quanto você quer tirar por mês. Preenche
                      aqui embaixo que a conta aparece.
                    </p>
                  )}
                  {projecao.meta && falta.meta ? (
                    <LinhaFalta
                      rotulo={`Pra bater a meta de ${fmtBRL(metaAlvo ?? 0)}`}
                      falta={falta.meta}
                      totalNoMes={projecao.meta.vendas}
                      real={emSimulacao ? (faltaReal?.meta ?? undefined) : undefined}
                      feito="meta batida"
                    />
                  ) : (
                    <p className="text-[13px] text-[var(--muted)]">
                      Sem Meta do mês definida ainda.{" "}
                      <Link
                        to="/metas"
                        search={{ criar: "meta-do-mes" }}
                        className="font-medium text-[var(--secondary-text)] no-underline hover:underline"
                      >
                        Definir agora
                      </Link>
                    </p>
                  )}
                </div>
              )}

              {/* ONE-241: os cenários moram logo abaixo do resultado. Antes ficavam
                  depois dos cinco campos e, no celular, o clique mudava um número
                  que estava duas telas acima, fora da vista. */}
              <div className="mt-5 flex flex-wrap gap-2 border-t border-[var(--line)] pt-4">
                <button
                  type="button"
                  onClick={aplicarCenarioPreco}
                  aria-pressed={ticketTxt === ticketMais10}
                  className={`${BTN_MIUDO_ACAO} ${ticketTxt === ticketMais10 ? "bg-[var(--secondary-light)]" : ""}`}
                >
                  E se eu cobrasse 10% a mais?
                </button>
                <button
                  type="button"
                  onClick={aplicarCenarioCusto}
                  aria-pressed={custoTxt === custoMenos10}
                  className={`${BTN_MIUDO_ACAO} ${custoTxt === custoMenos10 ? "bg-[var(--secondary-light)]" : ""}`}
                >
                  E se meu custo caísse 10%?
                </button>
                {(emSimulacao || metaTxt != null) && (
                  <button
                    type="button"
                    onClick={voltarAoValorReal}
                    className="inline-flex min-h-11 items-center rounded-lg px-3 text-[13px] font-medium text-[var(--secondary-text)] hover:underline"
                  >
                    Voltar ao valor real
                  </button>
                )}
              </div>

              <div className="mt-5 grid grid-cols-1 gap-4 border-t border-[var(--line)] pt-4 sm:grid-cols-2">
                <Campo
                  label="Custos fixos do mês (R$)"
                  hint={`${dicaOrigemFixos}${dicaReserva}${dicaFora}`}
                  error={erroValidacao.custosFixos}
                >
                  <input
                    type="text"
                    inputMode="decimal"
                    value={custosFixosTxt ?? paraCampo(custosFixosBase)}
                    onChange={(e) => {
                      setCustosFixosTxt(e.target.value);
                      validarCampo("custosFixos", e.target.value);
                    }}
                    className={`w-full rounded-lg border px-3 py-2 text-[14px] text-[var(--ink)] focus:outline-none ${
                      erroValidacao.custosFixos
                        ? "border-[var(--danger)]"
                        : "border-[var(--line)] focus:border-[var(--secondary-text)]"
                    }`}
                  />
                </Campo>
                <Campo
                  label="Quanto você quer tirar por mês (R$)"
                  hint={`É o seu salário do negócio, o que o contador chama de pró-labore.${
                    salario.origem === "mes-anterior" && proLaboreTxt == null
                      ? ` Veio do pró-labore de ${nomeMesAnterior}.`
                      : ""
                  }${
                    proLaboreLancadoNoMes > 0
                      ? ` Em ${nomeMesAtual} já saíram ${fmtBRL(proLaboreLancadoNoMes)} em ${CATEGORIA_PRO_LABORE}.`
                      : ""
                  }`}
                  error={erroValidacao.proLabore}
                >
                  <input
                    type="text"
                    inputMode="decimal"
                    value={proLaboreTxt ?? (proLaboreBase != null ? paraCampo(proLaboreBase) : "")}
                    onChange={(e) => {
                      setProLaboreTxt(e.target.value);
                      validarCampo("proLabore", e.target.value);
                    }}
                    className={`w-full rounded-lg border px-3 py-2 text-[14px] text-[var(--ink)] focus:outline-none ${
                      erroValidacao.proLabore
                        ? "border-[var(--danger)]"
                        : "border-[var(--line)] focus:border-[var(--secondary-text)]"
                    }`}
                  />
                </Campo>
                <Campo label="Ticket médio (R$)" error={erroValidacao.ticket}>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={ticketTxt ?? paraCampo(ticketBase)}
                    onChange={(e) => {
                      setTicketTxt(e.target.value);
                      validarCampo("ticket", e.target.value);
                    }}
                    className={`w-full rounded-lg border px-3 py-2 text-[14px] text-[var(--ink)] focus:outline-none ${
                      erroValidacao.ticket
                        ? "border-[var(--danger)]"
                        : "border-[var(--line)] focus:border-[var(--secondary-text)]"
                    }`}
                  />
                </Campo>
                <Campo
                  label="Custo médio (R$)"
                  hint={
                    qtdProdutosNaMedia > 0
                      ? `Média do custo de fazer cada unidade, puxada ${qtdProdutosNaMedia === 1 ? "do único produto" : `de ${qtdProdutosNaMedia} produtos`} do cadastro. Os custos fixos já entram no campo de cima.`
                      : "Só o custo de fazer cada unidade. Com produtos cadastrados, a Pólia puxa a média deles. Os custos fixos já entram no campo de cima."
                  }
                  error={erroValidacao.custo}
                >
                  <input
                    type="text"
                    inputMode="decimal"
                    value={custoTxt ?? paraCampo(custoBase)}
                    onChange={(e) => {
                      setCustoTxt(e.target.value);
                      validarCampo("custo", e.target.value);
                    }}
                    className={`w-full rounded-lg border px-3 py-2 text-[14px] text-[var(--ink)] focus:outline-none ${
                      erroValidacao.custo
                        ? "border-[var(--danger)]"
                        : "border-[var(--line)] focus:border-[var(--secondary-text)]"
                    }`}
                  />
                </Campo>
                {curva.foraDaCurva.length > 0 && (
                  <p className="text-[13px] text-[var(--ink-soft)] sm:col-span-2">
                    {usarTodosNaMedia
                      ? `A média usa todos os produtos, inclusive ${listarNomes(curva.foraDaCurva)}, bem acima ou abaixo dos outros.`
                      : `${curva.foraDaCurva.length === 1 ? "Ficou fora" : "Ficaram fora"} do ticket e do custo médios, por estar bem acima ou abaixo dos outros: ${listarNomes(curva.foraDaCurva)}.`}{" "}
                    <button
                      type="button"
                      onClick={() => setUsarTodosNaMedia((v) => !v)}
                      className="inline-flex min-h-11 items-center font-medium text-[var(--secondary-text)] hover:underline"
                    >
                      {usarTodosNaMedia ? "Tirar da média" : "Usar todos na média"}
                    </button>
                  </p>
                )}
                <Campo label="Meta do mês (R$)" error={erroValidacao.meta}>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={
                      metaTxt ?? (metaMes?.valor_alvo != null ? paraCampo(metaMes.valor_alvo) : "")
                    }
                    onChange={(e) => {
                      setMetaTxt(e.target.value);
                      validarCampo("meta", e.target.value);
                    }}
                    className={`w-full rounded-lg border px-3 py-2 text-[14px] text-[var(--ink)] focus:outline-none ${
                      erroValidacao.meta
                        ? "border-[var(--danger)]"
                        : "border-[var(--line)] focus:border-[var(--secondary-text)]"
                    }`}
                  />
                </Campo>
              </div>

              <button
                type="button"
                onClick={() => void confirmar()}
                disabled={salvando || Object.keys(erroValidacao).length > 0}
                className={`${BTN_ACAO} mt-5`}
              >
                {salvando ? "Salvando..." : "Salvar salário e meta"}
              </button>
            </div>
          </>
        )}
      </div>
    </PaginaLogada>
  );
}

// Uma linha do resultado (ONE-241): quanto FALTA no mês, o total do mês ao lado
// e, numa simulação, o número do mês real pra comparar.
function LinhaFalta({
  rotulo,
  falta,
  totalNoMes,
  real,
  feito,
}: {
  rotulo: string;
  falta: FaltaNoMes;
  totalNoMes: number;
  real?: FaltaNoMes;
  feito: string;
}) {
  const comparar = real != null && real.vendas !== falta.vendas;
  return (
    <p className="text-[16px] text-[var(--ink)]">
      {rotulo}:{" "}
      {falta.vendas === 0 && totalNoMes > 0 ? (
        <>
          <strong>{feito}</strong>. Eram {vendasTxt(totalNoMes)} no mês.
        </>
      ) : (
        <>
          {falta.vendas === 1 ? "falta" : "faltam"}{" "}
          <strong>
            {vendasTxt(falta.vendas)} ({fmtBRL(falta.faturamento)})
          </strong>
          {totalNoMes !== falta.vendas && (
            <span className="text-[var(--muted)]"> de {totalNoMes} no mês</span>
          )}
          .
        </>
      )}
      {comparar && (
        <span className="block text-[13px] text-[var(--muted)]">
          No seu mês real: {real.vendas === 0 ? "nenhuma venda faltando" : vendasTxt(real.vendas)}.
        </span>
      )}
    </p>
  );
}

// "A, B e C" (até três nomes; o resto vira "e mais N").
function listarNomes(produtos: { nome: string }[]): string {
  const nomes = produtos.map((p) => p.nome);
  const mostrados = nomes.slice(0, 3);
  const resto = nomes.length - mostrados.length;
  if (resto > 0) return `${mostrados.join(", ")} e mais ${resto}`;
  if (mostrados.length <= 1) return mostrados[0] ?? "";
  return `${mostrados.slice(0, -1).join(", ")} e ${mostrados[mostrados.length - 1]}`;
}
