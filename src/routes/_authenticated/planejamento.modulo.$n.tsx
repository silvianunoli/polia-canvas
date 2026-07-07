import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { PainelNav } from "@/components/painel/PainelNav";
import {
  type Secao,
  TOTAL_MODULOS,
  ferramentaDe,
  moduloInfo,
  secoesDoModulo,
} from "@/lib/planejamento";

export const Route = createFileRoute("/_authenticated/planejamento/modulo/$n")({
  validateSearch: (s: Record<string, unknown>) => ({
    secao: typeof s.secao === "string" ? s.secao : undefined,
  }),
  beforeLoad: async ({ params }) => {
    if (typeof window === "undefined") return;
    const n = Number(params.n);
    if (!Number.isInteger(n) || n < 1 || n > TOTAL_MODULOS) {
      throw redirect({ to: "/planejamento" });
    }
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return;
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("id", userId)
      .maybeSingle();
    if (profile && profile.onboarding_completed === false) {
      throw redirect({ to: "/onboarding" });
    }
  },
  component: ModuloPage,
});

interface DraftRow {
  secao: string;
  pergunta_idx: number;
  resposta: string | null;
}
interface SecaoRow {
  secao: string;
  concluido: boolean;
}

function ModuloPage() {
  const { n: nParam } = Route.useParams();
  const { secao: secaoParam } = Route.useSearch();
  const n = Number(nParam);
  const modulo = moduloInfo(n);
  const secoes = useMemo(() => secoesDoModulo(n), [n]);
  const { user } = useSupabaseSession();
  const userId = user?.id;
  const qc = useQueryClient();
  const navigate = useNavigate();

  const ferramenta = ferramentaDe(n);
  const [desbloqueada, setDesbloqueada] = useState(false);
  const [secaoId, setSecaoId] = useState<string | null>(null);

  const dadosQuery = useQuery({
    queryKey: ["modulo", userId, n],
    enabled: !!userId,
    queryFn: async () => {
      const [draftsRes, secoesRes] = await Promise.all([
        supabase
          .from("planejamento_respostas" as never)
          .select("secao, pergunta_idx, resposta")
          .eq("user_id", userId!)
          .eq("modulo", n),
        supabase
          .from("planejamento_secoes" as never)
          .select("secao, concluido")
          .eq("user_id", userId!)
          .eq("modulo", n),
      ]);
      return {
        drafts: ((draftsRes as unknown as { data: DraftRow[] | null }).data ?? []) as DraftRow[],
        secoes: ((secoesRes as unknown as { data: SecaoRow[] | null }).data ?? []) as SecaoRow[],
      };
    },
  });

  const drafts = dadosQuery.data?.drafts ?? [];
  const concluidas = useMemo(
    () => new Set((dadosQuery.data?.secoes ?? []).filter((s) => s.concluido).map((s) => s.secao)),
    [dadosQuery.data?.secoes],
  );

  // Define a seção atual: param explícito > primeira não-concluída > primeira.
  useEffect(() => {
    if (secaoId || !dadosQuery.data) return;
    if (secaoParam && secoes.some((s) => s.id === secaoParam)) {
      setSecaoId(secaoParam);
      return;
    }
    const primeiraAberta = secoes.find((s) => !concluidas.has(s.id));
    setSecaoId(primeiraAberta?.id ?? secoes[0]?.id ?? null);
  }, [dadosQuery.data, secaoParam, secoes, concluidas, secaoId]);

  const idx = secoes.findIndex((s) => s.id === secaoId);
  const secaoAtual = idx >= 0 ? secoes[idx] : null;

  const draftsDaSecao = useMemo(() => {
    if (!secaoAtual) return [] as string[];
    return secaoAtual.perguntas.map((_, i) => {
      const d = drafts.find((r) => r.secao === secaoAtual.id && r.pergunta_idx === i);
      return d?.resposta ?? "";
    });
  }, [secaoAtual, drafts]);

  const upsertResposta = useCallback(
    async (perguntaIdx: number, campo: string, resposta: string) => {
      if (!userId || !secaoAtual) return;
      await (
        supabase.from("planejamento_respostas" as never) as unknown as {
          upsert: (v: Record<string, unknown>, o: { onConflict: string }) => Promise<unknown>;
        }
      ).upsert(
        {
          user_id: userId,
          modulo: n,
          secao: secaoAtual.id,
          pergunta_idx: perguntaIdx,
          campo,
          resposta,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,secao,pergunta_idx" },
      );
    },
    [userId, secaoAtual, n],
  );

  const concluirSecao = useCallback(async () => {
    if (!userId || !secaoAtual) return;
    await (
      supabase.from("planejamento_secoes" as never) as unknown as {
        upsert: (v: Record<string, unknown>, o: { onConflict: string }) => Promise<unknown>;
      }
    ).upsert(
      {
        user_id: userId,
        modulo: n,
        secao: secaoAtual.id,
        concluido: true,
        concluido_em: new Date().toISOString(),
      },
      { onConflict: "user_id,secao" },
    );
    await qc.invalidateQueries({ queryKey: ["modulo", userId, n] });
    const proxima = secoes[idx + 1];
    if (proxima) {
      setSecaoId(proxima.id);
      if (typeof window !== "undefined") window.scrollTo({ top: 0 });
    } else {
      // Último: módulo concluído → tela de desbloqueio.
      qc.invalidateQueries({ queryKey: ["planejamento-mapa", userId] });
      setDesbloqueada(true);
      if (typeof window !== "undefined") window.scrollTo({ top: 0 });
    }
  }, [userId, secaoAtual, n, secoes, idx, qc]);

  const voltarSecao = useCallback(() => {
    const anterior = secoes[idx - 1];
    if (anterior) {
      setSecaoId(anterior.id);
      if (typeof window !== "undefined") window.scrollTo({ top: 0 });
    }
  }, [secoes, idx]);

  // ── Tela de desbloqueio ──
  if (desbloqueada) {
    return (
      <div className="polia-v3 min-h-screen bg-[var(--bg)] text-[var(--ink)]">
        <PainelNav navActive="/planejamento" />
        <div className="mx-auto flex min-h-[70vh] max-w-[520px] flex-col items-center justify-center px-6 py-16 text-center">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--muted)]">
            Módulo {n} concluído
          </p>
          <p className="mt-4 text-[1rem] text-[var(--ink-soft)]">Você acabou de construir a</p>
          <h1 className="font-fraunces mt-1 text-[2.5rem] leading-[1.05] text-[var(--ink)]">
            {ferramenta.nome}
          </h1>
          <p className="mt-3 max-w-[420px] text-[0.9rem] leading-relaxed text-[var(--ink-soft)]">
            {ferramenta.desbloqueioSub}
          </p>
          <a
            href={ferramenta.rota}
            className="mt-8 inline-flex w-full max-w-[320px] items-center justify-center gap-1.5 rounded-full bg-[var(--secondary)] px-6 py-3.5 font-medium text-[var(--secondary-ink)] no-underline transition-opacity hover:opacity-90"
          >
            {ferramenta.abrirLabel}
            <ArrowRight size={16} aria-hidden="true" />
          </a>
          <a
            href="/planejamento"
            className="mt-4 text-[0.875rem] text-[var(--muted)] no-underline hover:text-[var(--ink-soft)]"
          >
            Ver o planejamento
          </a>
        </div>
      </div>
    );
  }

  const total = secoes.length;

  return (
    <div className="polia-v3 min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <PainelNav navActive="/planejamento" />

      <div className="mx-auto max-w-[640px] px-6 py-10 md:px-10 md:py-14">
        <a
          href="/planejamento"
          className="mb-6 inline-flex items-center gap-1.5 text-[0.875rem] text-[var(--muted)] hover:text-[var(--ink)]"
        >
          <ArrowLeft size={15} aria-hidden="true" /> Planejamento
        </a>

        {/* Barra de progresso do módulo */}
        <div className="mb-8 h-1 w-full overflow-hidden rounded-full bg-[var(--line)]">
          <div
            className="h-full rounded-full bg-[var(--secondary)] transition-all"
            style={{ width: `${total > 0 ? ((idx < 0 ? 0 : idx) / total) * 100 : 0}%` }}
          />
        </div>

        {!secaoAtual ? (
          <div className="space-y-3">
            {[0, 1].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-[var(--radius-md)] bg-[var(--surface)]" />
            ))}
          </div>
        ) : (
          <SecaoForm
            key={secaoAtual.id}
            secao={secaoAtual}
            indice={idx}
            total={total}
            draftsIniciais={draftsDaSecao}
            onUpsert={upsertResposta}
            onConcluir={concluirSecao}
            onVoltar={voltarSecao}
            podeVoltar={idx > 0}
            ultima={idx === total - 1}
          />
        )}
      </div>
    </div>
  );
}

function SecaoForm({
  secao,
  indice,
  total,
  draftsIniciais,
  onUpsert,
  onConcluir,
  onVoltar,
  podeVoltar,
  ultima,
}: {
  secao: Secao;
  indice: number;
  total: number;
  draftsIniciais: string[];
  onUpsert: (perguntaIdx: number, campo: string, resposta: string) => Promise<void>;
  onConcluir: () => Promise<void>;
  onVoltar: () => void;
  podeVoltar: boolean;
  ultima: boolean;
}) {
  const [valores, setValores] = useState<string[]>(() =>
    secao.perguntas.map((_, i) => draftsIniciais[i] ?? ""),
  );
  const valoresRef = useRef(valores);
  valoresRef.current = valores;
  const timers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const pendentes = useRef<Set<number>>(new Set());
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [avancando, setAvancando] = useState(false);

  const salvarUm = useCallback(
    async (i: number) => {
      pendentes.current.delete(i);
      try {
        await onUpsert(i, secao.perguntas[i].campo, valoresRef.current[i]);
      } finally {
        if (pendentes.current.size === 0) setStatus("saved");
      }
    },
    [onUpsert, secao],
  );

  const flush = useCallback(async () => {
    const idxs = Array.from(pendentes.current);
    pendentes.current.clear();
    Object.values(timers.current).forEach((t) => clearTimeout(t));
    timers.current = {};
    if (idxs.length === 0) return;
    setStatus("saving");
    await Promise.all(idxs.map((i) => onUpsert(i, secao.perguntas[i].campo, valoresRef.current[i])));
    setStatus("saved");
  }, [onUpsert, secao]);

  // Flush best-effort ao desmontar (troca de seção/saída).
  useEffect(() => {
    return () => {
      const idxs = Array.from(pendentes.current);
      Object.values(timers.current).forEach((t) => clearTimeout(t));
      idxs.forEach((i) => void onUpsert(i, secao.perguntas[i].campo, valoresRef.current[i]));
    };
  }, [onUpsert, secao]);

  const onChange = (i: number, v: string) => {
    setValores((prev) => {
      const c = [...prev];
      c[i] = v;
      valoresRef.current = c;
      return c;
    });
    pendentes.current.add(i);
    setStatus("saving");
    if (timers.current[i]) clearTimeout(timers.current[i]);
    timers.current[i] = setTimeout(() => void salvarUm(i), 1000);
  };

  const concluir = async () => {
    setAvancando(true);
    try {
      await flush();
      await onConcluir();
    } finally {
      setAvancando(false);
    }
  };

  const voltar = async () => {
    await flush();
    onVoltar();
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--muted)]">
          Seção {indice + 1} de {total}
        </p>
        <span className="text-[11px] text-[var(--muted)]">
          {status === "saving" ? "Salvando…" : status === "saved" ? "Salvo" : ""}
        </span>
      </div>
      <h1 className="font-fraunces mt-1 text-[1.75rem] leading-[1.1] text-[var(--ink)]">
        {secao.titulo}
      </h1>
      <p className="mt-1 text-[0.9rem] italic text-[var(--ink-soft)]">{secao.subtitulo}</p>

      <div className="mt-8 space-y-6">
        {secao.perguntas.map((p, i) => (
          <label key={i} className="block">
            <span className="mb-2 block text-[1rem] leading-snug text-[var(--ink)]">{p.label}</span>
            <textarea
              value={valores[i]}
              onChange={(e) => onChange(i, e.target.value)}
              placeholder="Escreva aqui…"
              className="min-h-[96px] w-full resize-y rounded-[var(--radius-sm)] border border-[var(--line)] bg-white px-3 py-3 text-[15px] leading-relaxed text-[var(--ink)] focus:border-[var(--secondary)] focus:shadow-[inset_0_0_0_1px_var(--secondary)] focus:outline-none"
            />
          </label>
        ))}
      </div>

      <div className="mt-8 flex flex-col items-start gap-4">
        <button
          type="button"
          onClick={concluir}
          disabled={avancando}
          className="inline-flex w-full max-w-[400px] items-center justify-center gap-1.5 rounded-full bg-[var(--secondary)] px-6 py-3.5 font-medium text-[var(--secondary-ink)] transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {avancando ? "Salvando…" : ultima ? "Concluir módulo" : "Salvar e continuar"}
          <ArrowRight size={16} aria-hidden="true" />
        </button>
        {podeVoltar && (
          <button
            type="button"
            onClick={voltar}
            className="text-[0.875rem] text-[var(--muted)] hover:text-[var(--ink-soft)]"
          >
            ← Seção anterior
          </button>
        )}
      </div>
    </div>
  );
}
