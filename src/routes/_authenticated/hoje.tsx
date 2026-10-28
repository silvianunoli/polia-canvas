import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { useUserMeta } from "@/hooks/useUserMeta";
import { BlockError } from "@/components/ui/BlockError";
import { hojeISO, mesAnoDe } from "@/lib/data.functions";
import { intervaloDoMes, lerTodasAsPaginas } from "@/lib/leituraPaginada";
import { buscarMetaDoMes } from "@/lib/metaDoMes";
import { numerosDoMes, type LancamentoDoMes } from "@/lib/numerosDoMes";
import { formatarReais } from "@/lib/formatarReais";
import { recursoLiberado } from "@/lib/planos";
import { estaAberto, linhaDoResumo, resumoDoDia, rotuloEntrega } from "@/lib/pedidos";
import { usePedidos } from "@/components/pedidos/dados";

// Aba "Hoje" do app Android (AND-07, wireframe v2 aprovado em 28/10/2026): o
// Painel enxuto pra tela do celular. Os números saem das mesmas fontes do
// Painel (numerosDoMes sobre os lançamentos do mês, buscarMetaDoMes), então
// os dois nunca discordam. O Painel completo continua a um toque.
// Entregas no lugar das tarefas do Planner desde 28/10/2026: o quadro de
// Pedidos virou a rotina (usePedidos + resumoDoDia, as mesmas do Painel).

export const Route = createFileRoute("/_authenticated/hoje")({
  head: () => ({ meta: [{ title: "Hoje · Pólia One" }] }),
  component: Hoje,
});

type PostHoje = { titulo: string | null; tipo: string | null; postado: boolean | null };

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

  const postLiberado = !meta.carregando && recursoLiberado("/plano-conteudo", meta.plano);

  const dados = useQuery({
    queryKey: ["hoje-app", userId, hoje, postLiberado],
    enabled: !!userId && !!hoje,
    queryFn: async () => {
      const dia = hoje!;
      const { ano, mes } = mesAnoDe(dia);
      const intervalo = intervaloDoMes(ano, mes);
      const [lancamentos, metaMes, post] = await Promise.all([
        lerTodasAsPaginas<LancamentoDoMes>((de, ate) =>
          supabase
            .from("lancamentos")
            .select("tipo, valor, data, categoria")
            .eq("user_id", userId!)
            .gte("data", intervalo.inicio)
            .lt("data", intervalo.fimExclusivo)
            .order("id", { ascending: true })
            .range(de, ate),
        ),
        buscarMetaDoMes(supabase, userId!),
        postLiberado
          ? supabase
              .from("ia_plano_conteudo")
              .select("titulo, tipo, postado")
              .eq("user_id", userId!)
              .eq("data", dia)
              .limit(1)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);
      if (metaMes.error) throw metaMes.error;
      if (post.error) throw post.error;
      const n = numerosDoMes(lancamentos, ano, mes);
      return {
        entrou: n.entradas,
        lucrou: n.sobra,
        metaAlvo: Number(metaMes.data?.valor_alvo ?? 0),
        post: post.data as PostHoje | null,
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
          {saudacao}, {meta.displayName}.
        </p>
        <h1 className="font-cabinet mt-1 text-[28px] leading-[1.1] text-[var(--ink)]">Hoje</h1>

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

            {d?.post && (
              <Link
                to="/plano-conteudo"
                className={`${CARTAO} flex items-center gap-3 no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ink)]`}
              >
                <div className="min-w-0 flex-1">
                  <p className={ROTULO}>Post de hoje{d.post.tipo ? ` · ${d.post.tipo}` : ""}</p>
                  <p className="mt-1 text-[15px] text-[var(--ink)]">
                    {d.post.titulo || "Ver a ideia do dia"}
                  </p>
                  {d.post.postado && (
                    <p className="mt-1 text-[12px] text-[var(--secondary-text)]">Já postado</p>
                  )}
                </div>
                <ChevronRight size={18} className="text-[var(--muted)]" aria-hidden="true" />
              </Link>
            )}

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
