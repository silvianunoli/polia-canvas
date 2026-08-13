import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles, Lock, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { useUserMeta } from "@/hooks/useUserMeta";
import { PainelNav } from "@/components/painel/PainelNav";
import { gerarPlanoConteudo } from "@/lib/planoConteudo.functions";
import { track } from "@/lib/analytics";
import { temProjete } from "@/lib/planos";

export const Route = createFileRoute("/_authenticated/plano-conteudo")({
  head: () => ({
    meta: [
      { title: "Plano de conteúdo do ano · Pólia" },
      { name: "description", content: "365 ideias de post pras suas redes, pela Aimer." },
    ],
  }),
  component: PlanoConteudoPage,
});

const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

const TIPO_LABEL: Record<string, string> = {
  feed: "Feed",
  stories: "Stories",
  reels: "Reels",
  carrossel: "Carrossel",
};

interface DiaRow {
  id: string;
  data: string; // "YYYY-MM-DD"
  tipo: string;
  titulo: string;
  ideia: string;
  postado: boolean;
}

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function PlanoConteudoPage() {
  const { user } = useSupabaseSession();
  const userId = user?.id;
  const meta = useUserMeta();
  const ehProjete = temProjete(meta.plano);
  const qc = useQueryClient();

  const anoAtual = new Date().getFullYear();
  const [mesAtivo, setMesAtivo] = useState(new Date().getMonth() + 1);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [motivo, setMotivo] = useState<string | null>(null);

  const planoQuery = useQuery({
    queryKey: ["ia-plano-conteudo", userId, anoAtual],
    enabled: !!userId && ehProjete,
    queryFn: async () => {
      const { data } = await supabase
        .from("ia_plano_conteudo" as never)
        .select("id, data, tipo, titulo, ideia, postado")
        .eq("user_id", userId!)
        .eq("ano", anoAtual)
        .order("data", { ascending: true });
      return ((data ?? []) as unknown as DiaRow[]) ?? [];
    },
  });

  const dias = planoQuery.data ?? [];
  const diasDoMesAtivo = useMemo(
    () => dias.filter((d) => Number(d.data.split("-")[1]) === mesAtivo),
    [dias, mesAtivo],
  );
  const itemDeHoje = useMemo(() => dias.find((d) => d.data === hojeISO()) ?? null, [dias]);
  const precisaLembrar = !!itemDeHoje && !itemDeHoje.postado;

  const gerar = async () => {
    setErro(null);
    setMotivo(null);
    setGerando(true);
    try {
      const resultado = await gerarPlanoConteudo({ data: { ano: anoAtual } });
      if (resultado.ok) {
        track("plano_conteudo_gerado", { ano: anoAtual });
        await qc.invalidateQueries({ queryKey: ["ia-plano-conteudo", userId, anoAtual] });
      } else {
        setMotivo(resultado.motivo);
        if (resultado.motivo === "falha_ia") {
          setErro("Não consegui montar o seu plano agora. Tenta de novo.");
        }
      }
    } catch {
      setErro("Não consegui montar o seu plano agora. Tenta de novo.");
    } finally {
      setGerando(false);
    }
  };

  const marcarPostado = async (row: DiaRow, postado: boolean) => {
    await supabase
      .from("ia_plano_conteudo" as never)
      .update({ postado, postado_em: postado ? new Date().toISOString() : null } as never)
      .eq("id", row.id);
    await qc.invalidateQueries({ queryKey: ["ia-plano-conteudo", userId, anoAtual] });
  };

  const salvarCampo = async (row: DiaRow, campo: "titulo" | "ideia" | "tipo", valor: string) => {
    if (valor === row[campo]) return;
    await supabase
      .from("ia_plano_conteudo" as never)
      .update({ [campo]: valor } as never)
      .eq("id", row.id);
    await qc.invalidateQueries({ queryKey: ["ia-plano-conteudo", userId, anoAtual] });
  };

  if (!ehProjete) {
    return (
      <div className="polia-v3 min-h-screen bg-[var(--bg)] text-[var(--ink)]">
        <PainelNav />
        <div className="mx-auto max-w-[520px] px-6 py-16 text-center">
          <span className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--surface)]">
            <Lock size={20} className="text-[var(--ink-soft)]" aria-hidden="true" />
          </span>
          <h1 className="font-cabinet text-[26px] text-[var(--ink)]">
            O plano de conteúdo do ano é do Projete
          </h1>
          <p className="mt-2 text-[15px] text-[var(--ink-soft)]">
            A Aimer monta 365 ideias de post pras suas redes, uma por dia, a partir da sua marca e
            do seu público.
          </p>
          <Link
            to="/upgrade"
            search={{ rota: "/plano-conteudo", tier: "projete" }}
            className="mt-6 inline-flex items-center justify-center rounded-xl bg-[var(--secondary)] px-4 py-3 font-medium text-[var(--secondary-ink)] no-underline"
          >
            Conhecer o Projete
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="polia-v3 min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <PainelNav />
      <div className="mx-auto max-w-[720px] px-6 py-12 md:px-10">
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--muted)]">
          Plano de conteúdo
        </p>
        <h1 className="font-cabinet mt-1 text-[clamp(26px,4vw,34px)] text-[var(--ink)]">
          Uma ideia de post pra cada dia do ano
        </h1>

        {precisaLembrar && (
          <div className="mt-6 flex items-center justify-between rounded-xl border border-[var(--line)] bg-[var(--secondary-light)] px-4 py-3">
            <p className="text-[14px] text-[var(--ink)]">
              O tema de hoje ainda não foi marcado como postado:{" "}
              <strong>{itemDeHoje!.titulo}</strong>
            </p>
            <button
              type="button"
              onClick={() => void marcarPostado(itemDeHoje!, true)}
              className="ml-4 shrink-0 rounded-lg bg-[var(--secondary)] px-3 py-1.5 text-[13px] font-medium text-[var(--secondary-ink)] hover:opacity-90"
            >
              Já postei
            </button>
          </div>
        )}

        {planoQuery.isLoading ? (
          <div className="mt-6 h-40 animate-pulse rounded-xl bg-[var(--surface)]" />
        ) : dias.length > 0 ? (
          <>
            <select
              value={mesAtivo}
              onChange={(e) => setMesAtivo(Number(e.target.value))}
              className="mt-6 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-[14px] text-[var(--ink)] focus:border-[var(--secondary)] focus:shadow-[0_0_0_3px_var(--secondary-light)] focus:outline-none"
            >
              {MESES.map((nome, i) => (
                <option key={nome} value={i + 1}>
                  {nome} {anoAtual}
                </option>
              ))}
            </select>

            <ul className="mt-4 space-y-3">
              {diasDoMesAtivo.map((row) => (
                <li key={row.id} className="rounded-xl border border-[var(--line)] bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium text-[var(--muted)]">
                        {row.data.split("-")[2]}
                      </span>
                      <select
                        value={row.tipo}
                        onChange={(e) => void salvarCampo(row, "tipo", e.target.value)}
                        className="rounded-md border border-[var(--line)] bg-white px-2 py-1 text-[12px] text-[var(--ink-soft)]"
                      >
                        {Object.entries(TIPO_LABEL).map(([valor, label]) => (
                          <option key={valor} value={valor}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={() => void marcarPostado(row, !row.postado)}
                      aria-pressed={row.postado}
                      className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[12px] font-medium ${
                        row.postado
                          ? "bg-[var(--secondary-light)] text-[var(--secondary-text)]"
                          : "border border-[var(--line)] text-[var(--ink-soft)]"
                      }`}
                    >
                      <Check size={13} aria-hidden="true" />
                      {row.postado ? "Postado" : "Marcar como postado"}
                    </button>
                  </div>
                  <input
                    defaultValue={row.titulo}
                    onBlur={(e) => void salvarCampo(row, "titulo", e.target.value)}
                    className="mt-2 w-full rounded-md border-none bg-transparent p-0 text-[15px] font-medium text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-[var(--secondary)]"
                  />
                  <textarea
                    defaultValue={row.ideia}
                    onBlur={(e) => void salvarCampo(row, "ideia", e.target.value)}
                    rows={2}
                    className="mt-1 w-full resize-none rounded-md border-none bg-transparent p-0 text-[14px] text-[var(--ink-soft)] focus:outline-none focus:ring-1 focus:ring-[var(--secondary)]"
                  />
                </li>
              ))}
            </ul>
          </>
        ) : motivo === "planejamento_incompleto" ? (
          <div className="mt-6 rounded-xl border border-dashed border-[var(--line)] bg-white p-6 text-center">
            <p className="text-[14px] text-[var(--ink-soft)]">
              Preciso saber mais sobre a sua marca antes de montar o plano. Responda o básico no
              Planejamento e volte aqui.
            </p>
            <Link
              to="/planejamento"
              className="mt-3 inline-block text-[13px] font-medium text-[var(--secondary-text)] no-underline"
            >
              Ir pro Planejamento
            </Link>
          </div>
        ) : motivo === "teto_atingido" ? (
          <div className="mt-6 rounded-xl border border-dashed border-[var(--line)] bg-white p-6 text-center">
            <p className="text-[14px] text-[var(--ink-soft)]">
              Você já usou as suas gerações do plano de conteúdo desse ano.
            </p>
          </div>
        ) : (
          <div className="mt-6 rounded-xl border border-dashed border-[var(--line)] bg-white p-6 text-center">
            <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--secondary-light)]">
              <Sparkles size={18} className="text-[var(--secondary-text)]" aria-hidden="true" />
            </span>
            <p className="text-[14px] text-[var(--ink-soft)]">
              A Aimer monta 365 ideias de post pra {anoAtual}, uma por dia, a partir da sua marca,
              do seu público e do que você vende.
            </p>
            {erro && <p className="mt-3 text-[13px] text-[var(--danger)]">{erro}</p>}
            <button
              type="button"
              onClick={() => void gerar()}
              disabled={gerando}
              className="mt-4 rounded-xl bg-[var(--secondary)] px-4 py-2.5 font-medium text-[var(--secondary-ink)] hover:opacity-90 disabled:opacity-50"
            >
              {gerando ? "A Pólia está montando o seu plano..." : "Gerar plano de conteúdo"}
            </button>
            {gerando && (
              <p className="mt-2 text-[12px] text-[var(--muted)]">Isso pode levar um minuto.</p>
            )}
          </div>
        )}

        {dias.length > 0 && (
          <button
            type="button"
            onClick={() => void gerar()}
            disabled={gerando}
            className="mt-6 text-[13px] font-medium text-[var(--secondary-text)] hover:underline disabled:opacity-50"
          >
            {gerando ? "Gerando outro..." : "Gerar outro plano pro ano"}
          </button>
        )}
      </div>
    </div>
  );
}
