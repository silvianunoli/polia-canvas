import { useEffect, useMemo, useState } from "react";
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
import { BTN_ACAO, BTN_MIUDO } from "@/lib/botoes";
import { track } from "@/lib/analytics";
import { toastErro, toastSucesso } from "@/lib/toast";
import { registrar } from "@/lib/founder-eventos";
import {
  acaoDaMeta,
  CATEGORIA_INSUMOS,
  custosFixosDoMes,
  custoMedio,
  insumosDoMes,
  lerValorReais,
  mediaTaxas,
  montarProjecao,
  paraCampoReais,
  proLaboreJaLancado,
  sobraPorVenda,
  ticketMedio,
  valorDoCampo,
} from "@/lib/projecao.functions";
import { temProjete } from "@/lib/planos";
import { buscarMetaDoMes, TITULO_META_DO_MES } from "@/lib/metaDoMes";
import { intervaloDoMes, lerTodasAsPaginas } from "@/lib/leituraPaginada";
import type { ProdutoResumo } from "@/lib/projecao.functions";
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
  const ehProjete = temProjete(meta.plano);
  const qc = useQueryClient();

  const hoje = new Date();
  const mesAtual = hoje.getMonth() + 1;
  const anoAtual = hoje.getFullYear();

  const dadosQuery = useQuery({
    queryKey: ["projecao", userId],
    enabled: !!userId && ehProjete,
    queryFn: async () => {
      // A Projeção só usa o mês corrente (custos fixos e pró-labore lançado):
      // filtra no banco e lê inteiro, página por página (QA-24/QA-29). Antes
      // lia tudo sem paginar e o PostgREST cortava em 1.000 linhas.
      const mes = intervaloDoMes(anoAtual, mesAtual);
      const [lancamentosMes, prodRes, metaRes, perfilRes] = await Promise.all([
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
          .select("preco_venda, preco_custo, calculadora_breakdown")
          .eq("user_id", userId!)
          .eq("arquivado", false)
          .gt("preco_venda", 0),
        buscarMetaDoMes(supabase, userId!),
        supabase.from("profiles").select("pro_labore_desejado").eq("id", userId!).maybeSingle(),
      ]);
      // Antes os erros destas leituras eram ignorados: produto ou meta que não
      // carregou virava "sem produto" / "sem meta" calado. Agora cai na tela
      // de "não conseguiu puxar os seus números".
      const falha = [prodRes, metaRes, perfilRes].find((r) => (r as { error: unknown }).error);
      if (falha) throw (falha as { error: unknown }).error;
      const produtosRaw = (prodRes.data ?? []) as unknown as {
        preco_venda: number;
        preco_custo: number | null;
        calculadora_breakdown: ProdutoResumo["calculadora_breakdown"];
      }[];
      return {
        lancamentos: lancamentosMes,
        produtos: produtosRaw.map(
          (p): ProdutoResumo => ({
            precoVenda: p.preco_venda,
            precoCusto: p.preco_custo,
            calculadora_breakdown: p.calculadora_breakdown,
          }),
        ),
        metaMes: (metaRes.data ?? null) as { id: string; valor_alvo: number | null } | null,
        proLaboreSalvo:
          (perfilRes.data as { pro_labore_desejado: number | null } | null)?.pro_labore_desejado ??
          null,
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

  const custosFixosBase = useMemo(
    () => custosFixosDoMes(lancamentos, mesAtual, anoAtual),
    [lancamentos, mesAtual, anoAtual],
  );
  // Insumo do mês que ficou fora dos custos fixos (só pra linha de ajuda).
  const insumosForaBase = useMemo(
    () => insumosDoMes(lancamentos, mesAtual, anoAtual),
    [lancamentos, mesAtual, anoAtual],
  );
  const proLaboreBase = useMemo(() => {
    const lancado = proLaboreJaLancado(lancamentos, mesAtual, anoAtual);
    if (lancado > 0) return lancado;
    return dados?.proLaboreSalvo ?? null;
  }, [lancamentos, mesAtual, anoAtual, dados?.proLaboreSalvo]);
  const ticketBase = useMemo(() => ticketMedio(produtos), [produtos]);
  const custoBase = useMemo(() => custoMedio(produtos), [produtos]);
  const taxasBase = useMemo(() => mediaTaxas(produtos), [produtos]);

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

  const validarCampo = (chave: string, valor: string) => {
    const n = lerValorReais(valor);
    setErroValidacao((prev) => {
      const novo = { ...prev };
      if (Number.isNaN(n)) novo[chave] = "Coloque um valor em reais.";
      else delete novo[chave];
      return novo;
    });
  };

  const aplicarCenarioPreco = () => setTicketTxt(paraCampo(ticket * 1.1));
  const aplicarCenarioCusto = () => setCustoTxt(paraCampo(custo * 0.9));
  const voltarAoValorReal = () => {
    setCustosFixosTxt(null);
    setProLaboreTxt(null);
    setTicketTxt(null);
    setCustoTxt(null);
    setMetaTxt(null);
    setErroValidacao({});
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
        titulo="Projeção é do Pro"
        feature="Quantas vendas e quanto de faturamento pra empatar, se pagar e bater a meta do mês, tudo a partir do que já está na Pólia One."
        rota="/projecao"
      />
    );
  }

  const semProduto = !dadosQuery.isLoading && produtos.length === 0;
  const semCusto =
    !dadosQuery.isLoading && !semProduto && custosFixosBase === 0 && custosFixosTxt == null;

  return (
    <PaginaLogada
      dica="projecao"
      largura="larga"
      eyebrow="Projeção"
      titulo="Quanto vender pra se pagar."
      subtitulo="Quantas vendas faltam pra empatar, pra se pagar e pra bater a meta do mês."
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
              texto="Pra projetar, a Pólia One precisa saber quanto sobra numa venda e quanto custa o seu mês. Comece precificando 1 produto."
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
              titulo="Nenhuma venda está deixando sobra."
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
                Falta cadastrar os seus custos fixos pra saber quanto vender pra se pagar.{" "}
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
              {!projecao ? (
                <p role="status" className="text-[15px] text-[var(--ink)]">
                  Com esse ticket médio e esse custo, cada venda não deixa sobra, então não existe
                  número de vendas que se pague. Ajuste os valores abaixo ou volte ao valor real.
                </p>
              ) : (
                <div className="space-y-3">
                  <p className="text-[16px] text-[var(--ink)]">
                    Pra empatar:{" "}
                    <strong>
                      {projecao.empatar.vendas} vendas ({fmtBRL(projecao.empatar.faturamento)})
                    </strong>
                  </p>
                  {/* Sem pró-labore preenchido a linha repetiria a de empatar: em vez do
                    número, a tela pede o dado que falta. */}
                  {proLaboreDesejado > 0 ? (
                    <p className="text-[16px] text-[var(--ink)]">
                      Pra pagar o seu salário ({fmtBRL(proLaboreDesejado)} por mês):{" "}
                      <strong>
                        {projecao.sePagar.vendas} vendas ({fmtBRL(projecao.sePagar.faturamento)})
                      </strong>
                    </p>
                  ) : (
                    <p className="text-[16px] text-[var(--ink)]">
                      Pra pagar o seu salário: falta dizer quanto você quer tirar por mês. Preenche
                      aqui embaixo que a conta aparece.
                    </p>
                  )}
                  {projecao.meta ? (
                    <p className="text-[16px] text-[var(--ink)]">
                      Pra bater a meta ({fmtBRL(metaAlvo ?? 0)}):{" "}
                      <strong>
                        {projecao.meta.vendas} vendas ({fmtBRL(projecao.meta.faturamento)})
                      </strong>
                    </p>
                  ) : (
                    <p className="text-[13px] text-[var(--muted)]">
                      Sem Meta do mês definida ainda.{" "}
                      <Link
                        to="/metas"
                        className="font-medium text-[var(--secondary-text)] no-underline hover:underline"
                      >
                        Definir agora
                      </Link>
                    </p>
                  )}
                </div>
              )}

              <div className="mt-6 grid grid-cols-1 gap-4 border-t border-[var(--line)] pt-4 sm:grid-cols-2">
                <Campo
                  label="Custos fixos do mês (R$)"
                  hint={
                    insumosForaBase > 0
                      ? `Ficam fora os ${fmtBRL(insumosForaBase)} lançados em ${CATEGORIA_INSUMOS}: insumo já está no custo de cada produto.`
                      : `Saída em ${CATEGORIA_INSUMOS} fica fora: insumo já está no custo de cada produto.`
                  }
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
                  hint="É o seu salário do negócio, o que o contador chama de pró-labore."
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
                <Campo label="Custo médio (R$)" error={erroValidacao.custo}>
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

              <div className="mt-5 flex flex-wrap gap-2 border-t border-[var(--line)] pt-4">
                <button type="button" onClick={aplicarCenarioPreco} className={BTN_MIUDO}>
                  E se eu cobrasse 10% a mais?
                </button>
                <button type="button" onClick={aplicarCenarioCusto} className={BTN_MIUDO}>
                  E se meu custo caísse 10%?
                </button>
                <button
                  type="button"
                  onClick={voltarAoValorReal}
                  className="inline-flex min-h-11 items-center rounded-lg px-3 text-[13px] font-medium text-[var(--secondary-text)] hover:underline"
                >
                  Voltar ao valor real
                </button>
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
