import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { useUserMeta } from "@/hooks/useUserMeta";
import { BlockError } from "@/components/ui/BlockError";
import { hojeISO, mesAnoDe } from "@/lib/data.functions";
import { intervaloDoMes, lerTodasAsPaginas } from "@/lib/leituraPaginada";
import { buscarMetaDoMes } from "@/lib/metaDoMes";
import { numerosDoMes } from "@/lib/numerosDoMes";
import { lerVendasDoPeriodo, lucroDoMes, type LancamentoComOrigem } from "@/lib/lucroDoMes";
import { intervaloDoPeriodo } from "@/lib/vendas";
import { formatarReais } from "@/lib/formatarReais";
import { estaAberto, linhaDoResumo, resumoDoDia, rotuloEntrega } from "@/lib/pedidos";
import { usePedidos } from "@/components/pedidos/dados";
import { ConviteAvisosApp } from "@/components/app/ConviteAvisosApp";

// Aba "Hoje" do app Android (AND-07, wireframe v2 aprovado em 28/10/2026): o
// Painel enxuto pra tela do celular. Os números saem das mesmas fontes do
// Painel (numerosDoMes e lucroDoMes sobre os lançamentos e as vendas do mês,
// buscarMetaDoMes), então os dois nunca discordam. O Painel completo continua a um toque.
// Entregas no lugar das tarefas do Planner desde 28/10/2026: o quadro de
// Pedidos virou a rotina (usePedidos + resumoDoDia, as mesmas do Painel).

export const Route = createFileRoute("/_authenticated/hoje")({
  head: () => ({ meta: [{ title: "Hoje · Pólia One" }] }),
  component: Hoje,
});

function saudacaoAgora() {
  const agora = new Date();
  const minutos = agora.getHours() * 60 + agora.getMinutes();
  if (minutos < 12 * 60) return "Bom dia";
  if (minutos < 18 * 60 + 30) return "Boa tarde";
  return "Boa noite";
}

const CARTAO = "rounded-2xl border border-[var(--line)] bg-white p-4";
const ROTULO = "font-accent text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--muted)]";

function Hoje() {
  const { user } = useSupabaseSession();
  const userId = user?.id;
  const meta = useUserMeta();
  // Hora e dia lidos depois de montar: o servidor não sabe o fuso da usuária.
  const [saudacao, setSaudacao] = useState("Olá");
  const [hoje, setHoje] = useState<string | null>(null);
  useEffect(() => {
    setSaudacao(saudacaoAgora());
    setHoje(hojeISO());
  }, []);

  const dados = useQuery({
    queryKey: ["hoje-app", userId, hoje],
    enabled: !!userId && !!hoje,
    queryFn: async () => {
      const dia = hoje!;
      const { ano, mes } = mesAnoDe(dia);
      const intervalo = intervaloDoMes(ano, mes);
      const periodoVendas = intervaloDoPeriodo("mes", new Date());
      const [lancamentos, metaMes, vendas] = await Promise.all([
        lerTodasAsPaginas<LancamentoComOrigem>((de, ate) =>
          supabase
            .from("lancamentos")
            .select("tipo, valor, data, categoria, id_externo")
            .eq("user_id", userId!)
            .gte("data", intervalo.inicio)
            .lt("data", intervalo.fimExclusivo)
            .order("id", { ascending: true })
            .range(de, ate),
        ),
        buscarMetaDoMes(supabase, userId!),
        // Mesmo período do cartão de Vendas do Painel. Leitura que falha vira
        // null: o lucro cai em entradas - saídas em vez de sumir.
        lerVendasDoPeriodo(supabase, userId!, periodoVendas.de, periodoVendas.ate).catch(
          (erro: unknown) => {
            console.error("hoje: falha ao ler vendas", erro);
            return null;
          },
        ),
      ]);
      if (metaMes.error) throw metaMes.error;
      const n = numerosDoMes(lancamentos, ano, mes);
      return {
        entrou: n.entradas,
        lucrou: lucroDoMes(lancamentos, vendas, ano, mes).valor,
        metaAlvo: Number(metaMes.data?.valor_alvo ?? 0),
      };
    },
  });

  // Só lê depois de saber o dia: antes disso o hook fica desligado.
  const pedidos = usePedidos(hoje ? userId : undefined, hoje ?? "");
  const entregas = useMemo(() => {
    if (!hoje || !pedidos.data) return null;
    const pendentes = pedidos.data
      .filter((p) => estaAberto(p) && p.entregaEm <= hoje)
      .sort((a, b) => a.entregaEm.localeCompare(b.entregaEm));
    return { resumo: resumoDoDia(pedidos.data, hoje), pendentes };
  }, [pedidos.data, hoje]);

  const d = dados.data;
  const faltaMeta = d && d.metaAlvo > 0 ? Math.max(0, d.metaAlvo - d.entrou) : 0;
  const pctMeta =
    d && d.metaAlvo > 0 ? Math.min(100, Math.round((d.entrou / d.metaAlvo) * 100)) : 0;

  return (
    <div className="polia-v3 min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <div className="mx-auto w-full max-w-[560px] px-4 pb-8 pt-8">
        <p className="font-fraunces text-[19px] italic text-[var(--ink-soft)]">
          {saudacao}
          {meta.primeiroNome ? `, ${meta.primeiroNome}` : ""}.
        </p>
        <h1 className="font-cabinet mt-1 text-[28px] leading-[1.1] text-[var(--ink)]">Hoje</h1>

        {/* Só no app e só enquanto a permissão do Android não foi decidida (ONE-188). */}
        <div className="mt-6 empty:hidden">
          <ConviteAvisosApp />
        </div>

        {dados.isError ? (
          <div className="mt-6" role="alert">
            <BlockError
              message="A Pólia One não conseguiu ler os números de hoje. Nada foi perdido, é só a leitura que falhou."
              onRetry={() => void dados.refetch()}
            />
          </div>
        ) : (
          <div className="mt-6 flex flex-col gap-3" aria-busy={dados.isLoading}>
            <div className="grid grid-cols-2 gap-3">
              <div className={CARTAO}>
                <p className={ROTULO}>Entrou no mês</p>
                <p className="font-cabinet mt-1 text-[22px] tabular-nums">
                  {d ? formatarReais(d.entrou) : "..."}
                </p>
              </div>
              <div className={CARTAO}>
                <p className={ROTULO}>Quanto lucrou</p>
                <p
                  className={`font-cabinet mt-1 text-[22px] tabular-nums ${
                    d && d.lucrou < 0 ? "text-[var(--danger)]" : ""
                  }`}
                >
                  {d ? formatarReais(d.lucrou) : "..."}
                </p>
              </div>
            </div>

            <div className={CARTAO}>
              <p className={ROTULO}>Meta do mês</p>
              {d && d.metaAlvo > 0 ? (
                <>
                  <div
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={pctMeta}
                    aria-label="Quanto da meta do mês já entrou"
                    className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--surface)]"
                  >
                    <div
                      className="h-full bg-[var(--secondary)]"
                      style={{ width: `${pctMeta}%` }}
                    />
                  </div>
                  <p className="mt-2 text-[14px] text-[var(--ink-soft)]">
                    {faltaMeta === 0
                      ? `Meta de ${formatarReais(d.metaAlvo)} batida.`
                      : `Faltam ${formatarReais(faltaMeta)} pra chegar em ${formatarReais(d.metaAlvo)}.`}
                  </p>
                </>
              ) : (
                <p className="mt-2 text-[14px] text-[var(--ink-soft)]">
                  {d ? (
                    <>
                      Ainda sem meta pro mês.{" "}
                      <Link to="/metas" className="text-[var(--secondary-text)] underline">
                        Definir a meta
                      </Link>
                    </>
                  ) : (
                    "..."
                  )}
                </p>
              )}
            </div>

            <div className={CARTAO}>
              <p className={ROTULO}>Entregas</p>
              {pedidos.isError && (
                <p className="mt-2 text-[14px] text-[var(--ink-soft)]">
                  A Pólia One não conseguiu ler os pedidos agora.
                </p>
              )}
              {!pedidos.isError && !entregas && (
                <p className="mt-2 text-[14px] text-[var(--muted)]">...</p>
              )}
              {entregas && (
                <>
                  <p className="font-cabinet mt-1 text-[19px] leading-tight text-[var(--ink)]">
                    {linhaDoResumo(entregas.resumo)}
                  </p>
                  {entregas.pendentes.length > 0 && (
                    <ul className="mt-2 divide-y divide-[var(--line)]">
                      {entregas.pendentes.slice(0, 5).map((p) => {
                        const entrega = rotuloEntrega(p, hoje!);
                        const primeiro = p.itens[0];
                        return (
                          <li key={p.id} className="flex min-h-12 flex-col justify-center py-2">
                            <span className="text-[15px] text-[var(--ink)]">
                              {p.clienteNome || "Sem nome"}
                            </span>
                            <span className="text-[13px] text-[var(--ink-soft)]">
                              {primeiro
                                ? `${primeiro.quantidade}x ${primeiro.produtoNome}${p.itens.length > 1 ? ` e mais ${p.itens.length - 1}` : ""} · `
                                : ""}
                              <span className={entrega.atrasado ? "text-[var(--danger)]" : ""}>
                                {entrega.texto}
                              </span>
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  <Link
                    to="/pedidos"
                    className="mt-2 inline-flex min-h-11 items-center text-[14px] font-medium text-[var(--secondary-text)] underline underline-offset-2"
                  >
                    Abrir os pedidos
                  </Link>
                </>
              )}
            </div>

            {/* O cartão "Post de hoje" saiu com o Plano de conteúdo em 02/11/2026. */}
            <Link
              to="/painel"
              className="mt-2 self-start text-[14px] text-[var(--secondary-text)] underline underline-offset-2"
            >
              Ver o Painel completo
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
