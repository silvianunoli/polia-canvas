import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, redirect, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { PaginaLogada } from "@/components/layout/PaginaLogada";
import { BTN_ACAO_CONTORNO } from "@/lib/botoes";
import { track } from "@/lib/analytics";
import { CsatPrompt } from "@/components/csat/CsatPrompt";
import { useCsatTrigger } from "@/hooks/useCsatTrigger";
import {
  type Secao,
  SECOES,
  TOTAL_MODULOS,
  ferramentaDe,
  moduloInfo,
  secoesDoModulo,
} from "@/lib/planejamento";
import { gerarRascunhoPlanejamento } from "@/lib/planejamentoIa.functions";

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
  const csat = useCsatTrigger("entregavel_concluido", `modulo_${n}`, desbloqueada);

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
    track("planejamento_secao_concluida", { modulo: n, secao: secaoAtual.id });
    await qc.invalidateQueries({ queryKey: ["modulo", userId, n] });
    const proxima = secoes[idx + 1];
    if (proxima) {
      setSecaoId(proxima.id);
      if (typeof window !== "undefined") window.scrollTo({ top: 0 });
    } else {
      // Último: módulo concluído → tela de desbloqueio.
      track("planejamento_modulo_concluido", { modulo: n });
      // "Completo" não assume ordem — conta direto quantas seções (de todos os
      // módulos) estão concluídas pra essa usuária e compara com o total real.
      const { count } = await supabase
        .from("planejamento_secoes" as never)
        .select("secao", { count: "exact", head: true })
        .eq("user_id", userId!)
        .eq("concluido", true);
      if ((count ?? 0) >= SECOES.length) track("planejamento_completo");
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
        <div className="mx-auto flex min-h-[70vh] max-w-[520px] flex-col items-center justify-center px-6 py-16 text-center">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--muted)]">
            Módulo {n} concluído
          </p>
          <p className="mt-4 text-[1rem] text-[var(--ink-soft)]">Acabou de nascer a</p>
          <h1 className="font-cabinet mt-1 text-[2.5rem] leading-[1.05] text-[var(--ink)]">
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
        {csat.mostrar && (
          <CsatPrompt
            pergunta={`Como foi concluir o módulo ${n}?`}
            onFechar={csat.fechar}
            onEnviar={csat.enviar}
          />
        )}
      </div>
    );
  }

  const total = secoes.length;

  return (
    <PaginaLogada
      eyebrow={`Módulo ${n}`}
      titulo={modulo.nome}
      subtitulo={modulo.subtitulo}
      acao={
        <a href="/planejamento" className={BTN_ACAO_CONTORNO}>
          <ArrowLeft size={15} aria-hidden="true" /> Planejamento
        </a>
      }
    >
      <div>
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
              <div
                key={i}
                className="h-24 animate-pulse rounded-[var(--radius-md)] bg-[var(--surface)]"
              />
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
    </PaginaLogada>
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

  // ── Gerar com a Aimer (IA) ──
  const [rascunho, setRascunho] = useState<Record<number, string | null>>({});
  const [valorAntesDeGerar, setValorAntesDeGerar] = useState<Record<number, string>>({});
  const [gerando, setGerando] = useState<Record<number, boolean>>({});
  const [erroGeracao, setErroGeracao] = useState<Record<number, string | null>>({});
  const [cotaAtingida, setCotaAtingida] = useState<Record<number, boolean>>({});
  const [contextoInsuf, setContextoInsuf] = useState<Record<number, boolean>>({});

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
    await Promise.all(
      idxs.map((i) => onUpsert(i, secao.perguntas[i].campo, valoresRef.current[i])),
    );
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
    // Qualquer edição (inclusive "usar", que rechama isto com o mesmo valor)
    // já basta pra considerar o rascunho aceito e sumir com o selo.
    setRascunho((s) => (s[i] != null ? { ...s, [i]: null } : s));
    pendentes.current.add(i);
    setStatus("saving");
    if (timers.current[i]) clearTimeout(timers.current[i]);
    timers.current[i] = setTimeout(() => void salvarUm(i), 1000);
  };

  const gerarComAimer = async (i: number) => {
    setErroGeracao((s) => ({ ...s, [i]: null }));
    setCotaAtingida((s) => ({ ...s, [i]: false }));
    setContextoInsuf((s) => ({ ...s, [i]: false }));
    setGerando((s) => ({ ...s, [i]: true }));
    setValorAntesDeGerar((s) => ({ ...s, [i]: valoresRef.current[i] }));
    try {
      const resultado = await gerarRascunhoPlanejamento({
        data: { secao: secao.id, perguntaIdx: i },
      });
      if (resultado.ok) {
        setValores((prev) => {
          const c = [...prev];
          c[i] = resultado.texto;
          valoresRef.current = c;
          return c;
        });
        setRascunho((s) => ({ ...s, [i]: resultado.texto }));
        track("planejamento_ia_gerado", { campo: secao.perguntas[i].campo });
      } else if (resultado.motivo === "cota_atingida") {
        setCotaAtingida((s) => ({ ...s, [i]: true }));
      } else if (resultado.motivo === "contexto_insuficiente") {
        setContextoInsuf((s) => ({ ...s, [i]: true }));
      } else {
        setErroGeracao((s) => ({
          ...s,
          [i]: "Não conseguimos gerar o rascunho agora. Tenta de novo.",
        }));
      }
    } catch {
      setErroGeracao((s) => ({
        ...s,
        [i]: "Não conseguimos gerar o rascunho agora. Tenta de novo.",
      }));
    } finally {
      setGerando((s) => ({ ...s, [i]: false }));
    }
  };

  const usarRascunho = (i: number) => onChange(i, valoresRef.current[i]);

  const descartarRascunho = (i: number) => {
    const original = valorAntesDeGerar[i] ?? "";
    setValores((prev) => {
      const c = [...prev];
      c[i] = original;
      valoresRef.current = c;
      return c;
    });
    setRascunho((s) => ({ ...s, [i]: null }));
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
      <h1 className="font-cabinet mt-1 text-[1.75rem] leading-[1.1] text-[var(--ink)]">
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
              disabled={gerando[i]}
              placeholder="Escreva aqui…"
              className="min-h-[96px] w-full resize-y rounded-[var(--radius-sm)] border border-[var(--line)] bg-white px-3 py-3 text-[15px] leading-relaxed text-[var(--ink)] focus:border-[var(--secondary)] focus:shadow-[inset_0_0_0_1px_var(--secondary)] focus:outline-none disabled:bg-[var(--surface)]"
            />

            {cotaAtingida[i] ? (
              <p className="mt-2 text-[13px] text-[var(--ink-soft)]">
                Você já usou a sua geração de IA do mês. No Controle dá pra re-gerar quantas vezes
                precisar.{" "}
                <Link
                  to="/upgrade"
                  search={{ rota: "/planejamento", tier: "controle" }}
                  className="font-medium text-[var(--secondary-text)] no-underline"
                >
                  Conhecer o Controle
                </Link>
              </p>
            ) : contextoInsuf[i] ? (
              <p className="mt-2 text-[13px] text-[var(--ink-soft)]">
                Preciso saber o básico do seu negócio antes. Responda o que você vende (
                <Link
                  to="/produtos"
                  className="font-medium text-[var(--secondary-text)] no-underline"
                >
                  Produtos
                </Link>
                ) e o tipo do seu negócio (
                <Link
                  to="/configuracoes"
                  className="font-medium text-[var(--secondary-text)] no-underline"
                >
                  Configurações
                </Link>
                ) e a Aimer rascunha o resto.
              </p>
            ) : erroGeracao[i] ? (
              <p className="mt-2 text-[13px] text-[var(--danger)]">
                {erroGeracao[i]}{" "}
                <button
                  type="button"
                  onClick={() => void gerarComAimer(i)}
                  className="font-medium underline"
                >
                  Tentar de novo
                </button>
              </p>
            ) : rascunho[i] != null ? (
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--secondary-light)] px-2.5 py-1 text-[11px] font-medium text-[var(--secondary-text)]">
                  <Sparkles size={11} aria-hidden="true" />
                  rascunho de IA
                </span>
                <button
                  type="button"
                  onClick={() => usarRascunho(i)}
                  className="text-[13px] font-medium text-[var(--secondary-text)] hover:underline"
                >
                  Usar
                </button>
                <button
                  type="button"
                  onClick={() => descartarRascunho(i)}
                  className="text-[13px] text-[var(--muted)] hover:underline"
                >
                  Descartar
                </button>
                <button
                  type="button"
                  onClick={() => void gerarComAimer(i)}
                  className="text-[13px] text-[var(--muted)] hover:underline"
                >
                  Gerar outro
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => void gerarComAimer(i)}
                disabled={gerando[i]}
                className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--secondary-text)] hover:underline disabled:cursor-not-allowed disabled:text-[var(--muted)] disabled:no-underline"
              >
                <Sparkles size={13} aria-hidden="true" />
                {gerando[i] ? "A Aimer está escrevendo um rascunho…" : "Peça ajuda à Aimer"}
              </button>
            )}
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
