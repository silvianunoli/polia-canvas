import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles, Lock, AlertTriangle, TrendingDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { useUserMeta } from "@/hooks/useUserMeta";
import { PaginaLogada } from "@/components/layout/PaginaLogada";
import { Vazio } from "@/components/layout/Vazio";
import { BTN_ACAO } from "@/lib/botoes";
import { track } from "@/lib/analytics";
import {
  custosFixosDoMes,
  custoMedio,
  mediaTaxas,
  montarProjecao,
  proLaboreJaLancado,
  sobraPorVenda,
  ticketMedio,
} from "@/lib/projecao.functions";
import { temProjete } from "@/lib/planos";
import type { ProdutoResumo } from "@/lib/projecao.functions";
import type { LancamentoResumo } from "@/lib/resumoContador.functions";

export const Route = createFileRoute("/_authenticated/projecao")({
  head: () => ({
    meta: [
      { title: "Projeção e cenários · Pólia" },
      { name: "description", content: "Quantas vendas pra se pagar esse mês." },
    ],
  }),
  component: ProjecaoPage,
});

function numOuVazio(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : NaN;
}

function fmtBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * Valor inicial de um campo editável, arredondado a 2 casas.
 * `ticketMedio` e `custoMedio` são médias, e chegavam com a precisão binária
 * inteira: o campo abria com "898.5714285714286". Os botões de cenário deste
 * mesmo arquivo já arredondavam assim; faltava no valor de partida.
 */
function paraCampo(v: number): string {
  return String(Math.round(v * 100) / 100);
}

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
      const [lancRes, prodRes, metaRes, perfilRes] = await Promise.all([
        supabase
          .from("lancamentos")
          .select("id, tipo, valor, data, descricao, categoria")
          .eq("user_id", userId!),
        supabase
          .from("produtos")
          .select("preco_venda, preco_custo, calculadora_breakdown")
          .eq("user_id", userId!)
          .eq("arquivado", false)
          .gt("preco_venda", 0),
        supabase
          .from("metas")
          .select("id, valor_alvo")
          .eq("user_id", userId!)
          .eq("titulo", "Meta do mês")
          .maybeSingle(),
        supabase.from("profiles").select("pro_labore_desejado").eq("id", userId!).maybeSingle(),
      ]);
      const produtosRaw = (prodRes.data ?? []) as unknown as {
        preco_venda: number;
        preco_custo: number | null;
        calculadora_breakdown: ProdutoResumo["calculadora_breakdown"];
      }[];
      return {
        lancamentos: (lancRes.data ?? []) as LancamentoResumo[],
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
  const lancamentos = dados?.lancamentos ?? [];
  const produtos = dados?.produtos ?? [];
  const metaMes = dados?.metaMes ?? null;

  const custosFixosBase = useMemo(
    () => custosFixosDoMes(lancamentos, mesAtual, anoAtual),
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

  const custosFixos = custosFixosTxt != null ? (numOuVazio(custosFixosTxt) ?? 0) : custosFixosBase;
  const proLaboreDesejado =
    proLaboreTxt != null ? (numOuVazio(proLaboreTxt) ?? 0) : (proLaboreBase ?? 0);
  const ticket = ticketTxt != null ? (numOuVazio(ticketTxt) ?? 0) : ticketBase;
  const custo = custoTxt != null ? (numOuVazio(custoTxt) ?? 0) : custoBase;
  const metaAlvo = metaTxt != null ? numOuVazio(metaTxt) : (metaMes?.valor_alvo ?? null);

  const sobra = useMemo(
    () => sobraPorVenda({ ticketMedio: ticket, custoMedio: custo, ...taxasBase }),
    [ticket, custo, taxasBase],
  );

  const projecao = useMemo(
    () => montarProjecao({ custosFixos, proLaboreDesejado, metaAlvo, ticketMedio: ticket, sobra }),
    [custosFixos, proLaboreDesejado, metaAlvo, ticket, sobra],
  );

  const validarCampo = (chave: string, valor: string) => {
    const n = numOuVazio(valor);
    setErroValidacao((prev) => {
      const novo = { ...prev };
      if (Number.isNaN(n)) novo[chave] = "Coloque um valor em reais.";
      else delete novo[chave];
      return novo;
    });
  };

  const aplicarCenarioPreco = () => setTicketTxt(String(Math.round(ticket * 1.1 * 100) / 100));
  const aplicarCenarioCusto = () => setCustoTxt(String(Math.round(custo * 0.9 * 100) / 100));
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
      await supabase
        .from("profiles")
        .update({ pro_labore_desejado: proLaboreDesejado } as never)
        .eq("id", userId!);
      if (metaMes?.id && metaTxt != null && metaAlvo != null) {
        await supabase
          .from("metas")
          .update({ valor_alvo: metaAlvo, updated_at: new Date().toISOString() } as never)
          .eq("id", metaMes.id);
      }
      track("projecao_confirmada", { proLaboreDesejado, metaAlvo });
      await qc.invalidateQueries({ queryKey: ["projecao", userId] });
    } finally {
      setSalvando(false);
    }
  };

  // Só barra depois de saber o plano de verdade — ver `carregando` em useUserMeta.
  if (meta.carregando) {
    return (
      <PaginaLogada eyebrow="Projeção" titulo="Quanto vender pra se pagar.">
        <div className="h-40 animate-pulse rounded-xl bg-[var(--surface)]" />
      </PaginaLogada>
    );
  }

  if (!ehProjete) {
    return (
      <PaginaLogada eyebrow="Projeção" titulo="Projeção é do Projete">
        <div className="rounded-xl border border-[var(--line)] bg-white p-6 md:p-8">
          <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--surface)]">
            <Lock size={20} className="text-[var(--ink-soft)]" aria-hidden="true" />
          </span>
          <p className="max-w-[52ch] text-[15px] leading-relaxed text-[var(--ink-soft)]">
            Quantas vendas e quanto de faturamento pra empatar, se pagar e bater a meta do mês, tudo
            a partir do que já está na Pólia.
          </p>
          <Link
            to="/upgrade"
            search={{ rota: "/projecao", tier: "projete" }}
            className={`${BTN_ACAO} mt-6`}
          >
            Conhecer o Projete
          </Link>
        </div>
      </PaginaLogada>
    );
  }

  const semProduto = !dadosQuery.isLoading && produtos.length === 0;
  const semCusto =
    !dadosQuery.isLoading && !semProduto && custosFixosBase === 0 && custosFixosTxt == null;

  return (
    <PaginaLogada
      largura="larga"
      eyebrow="Projeção"
      titulo="Quanto vender pra se pagar."
      subtitulo="Quantas vendas faltam pra empatar, pra se pagar e pra bater a meta do mês."
    >
      <div>
        {dadosQuery.isLoading ? (
          <div className="mt-6 h-64 animate-pulse rounded-xl bg-[var(--surface)]" />
        ) : dadosQuery.isError ? (
          <div className="mt-6">
            <Vazio
              icone={AlertTriangle}
              titulo="Não conseguimos puxar os seus números agora."
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
              texto="Pra projetar, a Pólia precisa saber quanto sobra numa venda e quanto custa o seu mês. Comece precificando 1 produto."
              acao={
                <Link to="/produtos" className={BTN_ACAO}>
                  Ir pros Produtos
                </Link>
              }
            />
          </div>
        ) : sobra <= 0 ? (
          <div className="mt-6">
            <Vazio
              icone={TrendingDown}
              titulo="Nenhuma venda está deixando sobra."
              texto="Do jeito que está, cada venda não deixa nada, então não existe número de vendas que se pague. Reveja o preço ou o custo."
              acao={
                <Link to="/produtos" className={BTN_ACAO}>
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
                  className="font-medium text-[var(--secondary-text)] no-underline"
                >
                  Ir pro Financeiro
                </Link>
              </p>
            )}

            <div className="mt-6 rounded-xl border border-[var(--line)] bg-white p-6">
              <div className="space-y-3">
                <p className="text-[16px] text-[var(--ink)]">
                  Pra empatar:{" "}
                  <strong>
                    {projecao!.empatar.vendas} vendas ({fmtBRL(projecao!.empatar.faturamento)})
                  </strong>
                </p>
                {/* Sem pró-labore preenchido a linha repetiria a de empatar: em vez do
                    número, a tela pede o dado que falta. */}
                {proLaboreDesejado > 0 ? (
                  <p className="text-[16px] text-[var(--ink)]">
                    Pra se pagar ({fmtBRL(proLaboreDesejado)} de pró-labore):{" "}
                    <strong>
                      {projecao!.sePagar.vendas} vendas ({fmtBRL(projecao!.sePagar.faturamento)})
                    </strong>
                  </p>
                ) : (
                  <p className="text-[16px] text-[var(--ink)]">
                    Pra se pagar: falta dizer quanto você quer tirar por mês. Preenche o pró-labore
                    aqui embaixo que a conta aparece.
                  </p>
                )}
                {projecao!.meta ? (
                  <p className="text-[16px] text-[var(--ink)]">
                    Pra bater a meta ({fmtBRL(metaAlvo ?? 0)}):{" "}
                    <strong>
                      {projecao!.meta.vendas} vendas ({fmtBRL(projecao!.meta.faturamento)})
                    </strong>
                  </p>
                ) : (
                  <p className="text-[13px] text-[var(--muted)]">
                    Sem Meta do mês definida ainda.{" "}
                    <Link
                      to="/metas"
                      className="font-medium text-[var(--secondary-text)] no-underline"
                    >
                      Definir agora
                    </Link>
                  </p>
                )}
              </div>

              <div className="mt-6 grid grid-cols-2 gap-4 border-t border-[var(--line)] pt-4">
                <Campo
                  label="Custos fixos do mês (R$)"
                  valor={custosFixosTxt ?? paraCampo(custosFixosBase)}
                  onChange={(v) => {
                    setCustosFixosTxt(v);
                    validarCampo("custosFixos", v);
                  }}
                  erro={erroValidacao.custosFixos}
                />
                <Campo
                  label="Pró-labore desejado (R$)"
                  valor={proLaboreTxt ?? String(proLaboreBase ?? "")}
                  onChange={(v) => {
                    setProLaboreTxt(v);
                    validarCampo("proLabore", v);
                  }}
                  erro={erroValidacao.proLabore}
                />
                <Campo
                  label="Ticket médio (R$)"
                  valor={ticketTxt ?? paraCampo(ticketBase)}
                  onChange={(v) => {
                    setTicketTxt(v);
                    validarCampo("ticket", v);
                  }}
                  erro={erroValidacao.ticket}
                />
                <Campo
                  label="Custo médio (R$)"
                  valor={custoTxt ?? paraCampo(custoBase)}
                  onChange={(v) => {
                    setCustoTxt(v);
                    validarCampo("custo", v);
                  }}
                  erro={erroValidacao.custo}
                />
                <Campo
                  label="Meta do mês (R$)"
                  valor={metaTxt ?? String(metaMes?.valor_alvo ?? "")}
                  onChange={(v) => {
                    setMetaTxt(v);
                    validarCampo("meta", v);
                  }}
                  erro={erroValidacao.meta}
                />
              </div>

              <div className="mt-5 flex flex-wrap gap-2 border-t border-[var(--line)] pt-4">
                <button
                  type="button"
                  onClick={aplicarCenarioPreco}
                  className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-[13px] font-medium text-[var(--ink-soft)] hover:bg-[var(--surface)]"
                >
                  E se eu cobrasse 10% a mais?
                </button>
                <button
                  type="button"
                  onClick={aplicarCenarioCusto}
                  className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-[13px] font-medium text-[var(--ink-soft)] hover:bg-[var(--surface)]"
                >
                  E se meu custo caísse 10%?
                </button>
                <button
                  type="button"
                  onClick={voltarAoValorReal}
                  className="rounded-lg px-3 py-1.5 text-[13px] font-medium text-[var(--secondary-text)] hover:underline"
                >
                  Voltar ao valor real
                </button>
              </div>

              <button
                type="button"
                onClick={() => void confirmar()}
                disabled={salvando || Object.keys(erroValidacao).length > 0}
                className="mt-5 rounded-xl bg-[var(--secondary)] px-4 py-2.5 font-medium text-[var(--secondary-ink)] hover:opacity-90 disabled:opacity-50"
              >
                {salvando ? "Salvando..." : "Confirmar pró-labore e meta"}
              </button>
            </div>
          </>
        )}
      </div>
    </PaginaLogada>
  );
}

function Campo({
  label,
  valor,
  onChange,
  erro,
}: {
  label: string;
  valor: string;
  onChange: (v: string) => void;
  erro?: string;
}) {
  return (
    <label className="block">
      <span className="text-[12px] font-medium text-[var(--ink-soft)]">{label}</span>
      <input
        type="text"
        inputMode="decimal"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className={`mt-1 w-full rounded-lg border px-3 py-2 text-[14px] text-[var(--ink)] focus:outline-none focus:shadow-[0_0_0_3px_var(--secondary-light)] ${
          erro ? "border-[var(--danger)]" : "border-[var(--line)] focus:border-[var(--secondary)]"
        }`}
      />
      {erro && <span className="mt-1 block text-[12px] text-[var(--danger)]">{erro}</span>}
    </label>
  );
}
