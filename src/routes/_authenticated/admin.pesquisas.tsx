import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  PESQUISA_DISCOVERY,
  PERGUNTAS_POR_ID,
  SLUG_PESQUISA,
  type Pergunta,
} from "@/lib/pesquisa-discovery.config";
import {
  funil,
  abandonoPorPergunta,
  distribuicao,
  respostasAbertas,
  filtrarPorSegmento,
  type RespostaRow,
} from "@/lib/pesquisa-agg";

export const Route = createFileRoute("/_authenticated/admin/pesquisas")({
  head: () => ({
    meta: [{ title: "Pesquisas · Pólia" }],
  }),
  component: AdminPesquisas,
});

// Dimensões de recorte (perguntas de escolha única que fazem sentido segmentar).
const DIMENSOES = [
  "categoria",
  "tempo",
  "quem_toca",
  "renda_principal",
  "tem_marca",
  "inseguranca",
];

function rotuloResposta(p: Pergunta, v: unknown): string {
  if (v === undefined || v === null) return "";
  if (p.tipo === "aberta") return typeof v === "string" ? v : "";
  const mapa = new Map((p.opcoes ?? []).map((o) => [o.id, o.rotulo]));
  if (p.tipo === "multipla" && Array.isArray(v)) {
    return v.map((x) => mapa.get(String(x)) ?? String(x)).join("; ");
  }
  return mapa.get(String(v)) ?? String(v);
}

function Barra({ pct, cor = "var(--secondary)" }: { pct: number; cor?: string }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-[var(--line)]">
      <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, backgroundColor: cor }} />
    </div>
  );
}

function AdminPesquisas() {
  const [carregando, setCarregando] = useState(true);
  const [ativa, setAtiva] = useState(false);
  const [tituloPesquisa, setTituloPesquisa] = useState("");
  const [rows, setRows] = useState<RespostaRow[]>([]);
  const [viram, setViram] = useState<number | null>(null);
  const [dim, setDim] = useState("");
  const [valorDim, setValorDim] = useState("");
  const [buscaAberta, setBuscaAberta] = useState("");

  useEffect(() => {
    (async () => {
      const { data: pesquisa } = await supabase
        .from("pesquisas")
        .select("id, ativa, titulo")
        .eq("slug", SLUG_PESQUISA)
        .maybeSingle();
      if (pesquisa) {
        setAtiva(pesquisa.ativa);
        setTituloPesquisa(pesquisa.titulo);
        const { data: rr } = await supabase
          .from("pesquisa_respostas")
          .select("progresso, concluida, respostas, criado_em")
          .eq("pesquisa_id", pesquisa.id)
          .limit(10000);
        setRows((rr as RespostaRow[] | null) ?? []);
      }
      try {
        const { count } = await supabase
          .from("eventos_analytics")
          .select("id", { count: "exact", head: true })
          .eq("evento", "pesquisa_vista");
        setViram(count ?? null);
      } catch {
        setViram(null);
      }
      setCarregando(false);
    })();
  }, []);

  const filtradas = useMemo(() => filtrarPorSegmento(rows, dim, valorDim), [rows, dim, valorDim]);
  const resumo = useMemo(() => funil(filtradas), [filtradas]);
  const abandono = useMemo(
    () => abandonoPorPergunta(filtradas, PESQUISA_DISCOVERY.perguntas),
    [filtradas],
  );
  // Quem começou e não respondeu nada (progresso 0) não cai em nenhuma pergunta;
  // conta num balde à parte pra não virar ponto cego no gráfico de abandono.
  const semResposta = useMemo(
    () => filtradas.filter((r) => !r.concluida && r.progresso === 0).length,
    [filtradas],
  );
  const maxAband = Math.max(1, semResposta, ...abandono.map((a) => a.abandonos));
  const maxFunil = Math.max(1, viram ?? 0, resumo.comecaram);
  const perguntasFechadas = PESQUISA_DISCOVERY.perguntas.filter((p) => p.tipo !== "aberta");
  const dimPergunta = dim ? PERGUNTAS_POR_ID[dim] : undefined;

  const apertos = useMemo(
    () =>
      respostasAbertas(filtradas, "aperto").filter((t) =>
        t.toLowerCase().includes(buscaAberta.trim().toLowerCase()),
      ),
    [filtradas, buscaAberta],
  );
  const episodios = useMemo(
    () =>
      respostasAbertas(filtradas, "episodio").filter((t) =>
        t.toLowerCase().includes(buscaAberta.trim().toLowerCase()),
      ),
    [filtradas, buscaAberta],
  );

  function exportarCsv() {
    const perguntas = PESQUISA_DISCOVERY.perguntas;
    const header = ["criado_em", "concluida", ...perguntas.map((p) => p.titulo)];
    const linhas: string[][] = [header];
    filtradas.forEach((r) => {
      linhas.push([
        r.criado_em,
        r.concluida ? "sim" : "nao",
        ...perguntas.map((p) => rotuloResposta(p, r.respostas[p.id])),
      ]);
    });
    const csv = linhas
      .map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pesquisa-${SLUG_PESQUISA}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <div className="mb-1 flex flex-wrap items-center gap-3">
        <h1 className="font-cabinet text-[40px] text-[var(--ink)]">Pesquisas</h1>
        <span
          className={`rounded-full px-3 py-1 text-[12px] font-semibold ${
            ativa
              ? "bg-[var(--secondary-light)] text-[var(--secondary-text)]"
              : "bg-[var(--surface)] text-[var(--muted)]"
          }`}
        >
          {ativa ? "No ar" : "Fechada"}
        </span>
      </div>
      <p className="mb-6 font-sans text-[14px] text-[var(--muted)]">
        {tituloPesquisa || "Discovery do negócio"} · aderência e resultados. Começaram e concluíram
        vêm da própria pesquisa (não dependem de cookie).
      </p>

      {/* Recorte + export */}
      <div className="mb-6 flex flex-wrap items-end gap-3 rounded-2xl border border-[var(--line)] bg-white p-4">
        <label className="flex flex-col gap-1">
          <span className="font-sans text-[11px] font-medium text-[var(--muted)]">
            Recortar por
          </span>
          <select
            value={dim}
            onChange={(e) => {
              setDim(e.target.value);
              setValorDim("");
            }}
            className="rounded-lg border border-[var(--line)] bg-white px-3 py-1.5 font-sans text-[13px] text-[var(--ink)]"
          >
            <option value="">Todas as respostas</option>
            {DIMENSOES.map((d) => (
              <option key={d} value={d}>
                {PERGUNTAS_POR_ID[d]?.titulo ?? d}
              </option>
            ))}
          </select>
        </label>
        {dimPergunta && (
          <label className="flex flex-col gap-1">
            <span className="font-sans text-[11px] font-medium text-[var(--muted)]">Valor</span>
            <select
              value={valorDim}
              onChange={(e) => setValorDim(e.target.value)}
              className="rounded-lg border border-[var(--line)] bg-white px-3 py-1.5 font-sans text-[13px] text-[var(--ink)]"
            >
              <option value="">Todos</option>
              {(dimPergunta.opcoes ?? []).map((o) => (
                <option key={o.id} value={o.id}>
                  {o.rotulo}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="flex-1" />
        <button
          onClick={exportarCsv}
          disabled={filtradas.length === 0}
          className="rounded-lg border border-[var(--line)] bg-white px-4 py-1.5 font-sans text-[13px] text-[var(--ink-soft)] transition-colors hover:border-[var(--secondary)] disabled:opacity-40"
        >
          Exportar CSV
        </button>
        <span className="font-sans text-[12px] text-[var(--muted)]">
          {filtradas.length} resposta{filtradas.length === 1 ? "" : "s"}
        </span>
      </div>

      {carregando ? (
        <p className="font-sans text-[14px] text-[var(--muted)]">Carregando…</p>
      ) : resumo.comecaram === 0 ? (
        <div className="rounded-2xl border border-[var(--line)] bg-white p-8">
          <p className="font-sans text-[15px] text-[var(--ink-soft)]">
            Nenhuma resposta ainda{dim ? " nesse recorte" : ""}.{" "}
            {ativa
              ? "A pesquisa está no ar em /pesquisa."
              : "A pesquisa está fechada. Vire ativa=true pra abrir."}
          </p>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: "Começaram", valor: String(resumo.comecaram) },
              { label: "Concluíram", valor: String(resumo.concluiram) },
              { label: "Taxa de conclusão", valor: `${resumo.taxaConclusao}%` },
              { label: "Viram*", valor: viram == null ? "—" : String(viram) },
            ].map((k) => (
              <div key={k.label} className="rounded-2xl border border-[var(--line)] bg-white p-5">
                <p className="mb-1 font-sans text-[10px] font-semibold uppercase tracking-[1.5px] text-[var(--muted)]">
                  {k.label}
                </p>
                <p className="font-cabinet text-[32px] leading-none text-[var(--ink)]">{k.valor}</p>
              </div>
            ))}
          </div>

          <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Funil */}
            <div className="rounded-2xl border border-[var(--line)] bg-white p-6">
              <p className="mb-4 font-sans text-[11px] font-semibold uppercase tracking-[2px] text-[var(--muted)]">
                Aderência (funil)
              </p>
              <div className="space-y-3">
                {[
                  { rot: "Viram*", n: viram ?? 0, mostrar: viram != null },
                  { rot: "Começaram", n: resumo.comecaram, mostrar: true },
                  { rot: "Concluíram", n: resumo.concluiram, mostrar: true },
                ]
                  .filter((x) => x.mostrar)
                  .map((x) => (
                    <div key={x.rot}>
                      <div className="mb-1 flex items-center justify-between">
                        <p className="font-sans text-[13px] text-[var(--ink)]">{x.rot}</p>
                        <p className="font-sans text-[12px] text-[var(--muted)]">{x.n}</p>
                      </div>
                      <Barra pct={(x.n / maxFunil) * 100} />
                    </div>
                  ))}
              </div>
              <p className="mt-4 font-sans text-[11px] text-[var(--muted)]">
                *Viram é melhor esforço (só conta quem aceitou cookies de análise). Pode subcontar.
              </p>
            </div>

            {/* Abandono por pergunta */}
            <div className="rounded-2xl border border-[var(--line)] bg-white p-6">
              <p className="mb-1 font-sans text-[11px] font-semibold uppercase tracking-[2px] text-[var(--muted)]">
                Onde abandonam
              </p>
              <p className="mb-4 font-sans text-[12px] text-[var(--muted)]">
                Entre quem não concluiu, em qual pergunta parou. Pergunta que sangra muita gente é
                candidata a cortar.
              </p>
              <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
                <div>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <p className="truncate font-sans text-[12px] text-[var(--ink)]">
                      Começou e não respondeu nada
                    </p>
                    <p className="shrink-0 font-sans text-[12px] text-[var(--muted)]">
                      {semResposta}
                    </p>
                  </div>
                  <Barra pct={(semResposta / maxAband) * 100} cor="var(--accent)" />
                </div>
                {abandono.map((a) => (
                  <div key={a.id}>
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <p className="truncate font-sans text-[12px] text-[var(--ink)]">
                        {a.ordem}. {a.titulo}
                      </p>
                      <p className="shrink-0 font-sans text-[12px] text-[var(--muted)]">
                        {a.abandonos}
                      </p>
                    </div>
                    <Barra pct={(a.abandonos / maxAband) * 100} cor="var(--accent)" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Distribuições por pergunta */}
          <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            {perguntasFechadas.map((p) => {
              const itens = distribuicao(filtradas, p);
              const max = Math.max(1, ...itens.map((i) => i.contagem));
              return (
                <div key={p.id} className="rounded-2xl border border-[var(--line)] bg-white p-6">
                  <p className="mb-4 font-sans text-[13px] font-semibold text-[var(--ink)]">
                    {p.ordem}. {p.titulo}
                  </p>
                  <div className="space-y-3">
                    {itens.map((it) => (
                      <div key={it.id}>
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <p className="truncate font-sans text-[12px] text-[var(--ink-soft)]">
                            {it.rotulo}
                          </p>
                          <p className="shrink-0 font-sans text-[12px] text-[var(--muted)]">
                            {it.contagem} · {it.pct}%
                          </p>
                        </div>
                        <Barra pct={(it.contagem / max) * 100} />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Respostas abertas */}
          <div className="mb-4 flex items-center gap-3">
            <h2 className="font-cabinet text-[22px] text-[var(--ink)]">Respostas abertas</h2>
            <input
              type="text"
              placeholder="buscar palavra…"
              value={buscaAberta}
              onChange={(e) => setBuscaAberta(e.target.value)}
              className="min-w-[180px] rounded-lg border border-[var(--line)] bg-white px-3 py-1.5 font-sans text-[13px] text-[var(--ink)] placeholder:text-[var(--muted)]"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {[
              { titulo: "O maior aperto (P20)", lista: apertos },
              { titulo: "O episódio (P21)", lista: episodios },
            ].map((bloco) => (
              <div
                key={bloco.titulo}
                className="rounded-2xl border border-[var(--line)] bg-white p-6"
              >
                <p className="mb-4 font-sans text-[11px] font-semibold uppercase tracking-[2px] text-[var(--muted)]">
                  {bloco.titulo} · {bloco.lista.length}
                </p>
                {bloco.lista.length === 0 ? (
                  <p className="font-sans text-[13px] text-[var(--muted)]">Nada por aqui ainda.</p>
                ) : (
                  <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
                    {bloco.lista.map((t, i) => (
                      <p
                        key={i}
                        className="rounded-lg border-l-2 border-[var(--secondary)] bg-[var(--surface)] px-3 py-2 font-sans text-[13px] leading-[1.5] text-[var(--ink-soft)]"
                      >
                        {t}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
