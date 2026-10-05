import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, redirect, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { PaginaLogada } from "@/components/layout/PaginaLogada";
import { BTN_ACAO, BTN_ACAO_CONTORNO, BTN_MIUDO, BTN_PRIMARIO } from "@/lib/botoes";
import { track } from "@/lib/analytics";
import { registrar } from "@/lib/founder-eventos";
import { CsatPrompt } from "@/components/csat/CsatPrompt";
import { useCsatTrigger } from "@/hooks/useCsatTrigger";
import { toastErro, toastSucesso } from "@/lib/toast";
import {
  type Secao,
  MODULOS_SEM_IA,
  SECOES,
  TOTAL_MODULOS,
  ferramentaDe,
  moduloInfo,
  secoesDoModulo,
} from "@/lib/planejamento";
import { gerarRascunhoPlanejamento, usoIaPlanejamento } from "@/lib/planejamentoIa.functions";
import { avisoCotaEsgotada, pertoDoLimite } from "@/lib/usoIa";
import { LinkInterno } from "@/components/ui/LinkInterno";

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
  },
  component: ModuloRota,
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

// `key` pelo número do módulo: do módulo 1 pro 2 o TanStack reaproveita a
// mesma instância, e a seção atual e a tela de "módulo concluído" do módulo
// anterior vazavam pro seguinte (abria seção errada, formulário vazio).
function ModuloRota() {
  const { n } = Route.useParams();
  return <ModuloPage key={n} />;
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
  // Barra de uso da IA (05/10/2026): só nos módulos que têm o botão de IA.
  const usoIaQuery = useQuery({
    queryKey: ["uso-ia-planejamento", userId],
    enabled: !!userId && !MODULOS_SEM_IA.has(n),
    staleTime: 60_000,
    queryFn: () => usoIaPlanejamento(),
  });
  const usoIa = MODULOS_SEM_IA.has(n) ? undefined : usoIaQuery.data;
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

  const drafts = useMemo(() => dadosQuery.data?.drafts ?? [], [dadosQuery.data?.drafts]);
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

  // Lança em caso de erro: antes o retorno do banco era ignorado e a tela
  // mostrava "Salvo" mesmo quando a gravação falhava.
  const upsertResposta = useCallback(
    async (perguntaIdx: number, campo: string, resposta: string) => {
      if (!userId || !secaoAtual) return;
      const { error } = await (
        supabase.from("planejamento_respostas" as never) as unknown as {
          upsert: (
            v: Record<string, unknown>,
            o: { onConflict: string },
          ) => Promise<{ error: unknown }>;
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
      if (error) throw error;
    },
    [userId, secaoAtual, n],
  );

  const concluirSecao = useCallback(async () => {
    if (!userId || !secaoAtual) return;
    const { error: erroSecao } = await (
      supabase.from("planejamento_secoes" as never) as unknown as {
        upsert: (
          v: Record<string, unknown>,
          o: { onConflict: string },
        ) => Promise<{ error: unknown }>;
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
    if (erroSecao) throw erroSecao;
    track("planejamento_secao_concluida", { modulo: n, secao: secaoAtual.id });
    await qc.invalidateQueries({ queryKey: ["modulo", userId, n] });
    const proxima = secoes[idx + 1];
    if (proxima) {
      setSecaoId(proxima.id);
      if (typeof window !== "undefined") window.scrollTo({ top: 0 });
    } else {
      // Último: módulo concluído → tela de desbloqueio.
      track("planejamento_modulo_concluido", { modulo: n });
      void registrar("feature_completed", {
        feature: "planejamento",
        propriedades: { acao: "modulo_concluido", modulo: n },
      });
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
          <p className="text-[11px] font-accent font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
            Módulo {n} concluído
          </p>
          <p className="mt-4 text-[1rem] text-[var(--ink-soft)]">{ferramenta.nasceu}</p>
          <h1 className="font-cabinet mt-1 text-[2.5rem] leading-[1.05] text-[var(--ink)]">
            {ferramenta.nome}
          </h1>
          <p className="mt-3 max-w-[420px] text-[0.9rem] leading-relaxed text-[var(--ink-soft)]">
            {ferramenta.desbloqueioSub}
          </p>
          {/* Com módulo seguinte, continuar o Planejamento é a ação principal:
              só com o botão da ferramenta parecia que o Planejamento tinha
              acabado ali (pedido da Sil, 05/10/2026). */}
          {n < TOTAL_MODULOS ? (
            <>
              <button
                type="button"
                onClick={() =>
                  void navigate({
                    to: "/planejamento/modulo/$n",
                    params: { n: String(n + 1) },
                    search: { secao: undefined },
                  })
                }
                className={`${BTN_PRIMARIO} mt-8`}
              >
                Continuar no Módulo {n + 1}
                <ArrowRight size={16} aria-hidden="true" />
              </button>
              <p className="mt-2 text-[0.8rem] text-[var(--muted)]">
                Faltam {TOTAL_MODULOS - n} {TOTAL_MODULOS - n === 1 ? "módulo" : "módulos"} pra
                fechar o Planejamento.
              </p>
              <LinkInterno href={ferramenta.rota} className={`${BTN_ACAO_CONTORNO} mt-5`}>
                {ferramenta.abrirLabel}
              </LinkInterno>
            </>
          ) : (
            <LinkInterno href={ferramenta.rota} className={`${BTN_PRIMARIO} mt-8`}>
              {ferramenta.abrirLabel}
              <ArrowRight size={16} aria-hidden="true" />
            </LinkInterno>
          )}
          <LinkInterno
            href="/planejamento"
            className="mt-2 inline-flex min-h-11 items-center px-2 text-[0.875rem] font-medium text-[var(--secondary-text)] no-underline hover:underline"
          >
            Ver o planejamento
          </LinkInterno>
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
        <LinkInterno href="/planejamento" className={BTN_ACAO_CONTORNO}>
          <ArrowLeft size={15} aria-hidden="true" /> Planejamento
        </LinkInterno>
      }
    >
      <div>
        {/* Barra de progresso do módulo */}
        <div
          className="mb-8 h-1 w-full overflow-hidden rounded-full bg-[var(--line)]"
          role="progressbar"
          aria-valuenow={idx < 0 ? 0 : idx}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-label={`${idx < 0 ? 0 : idx} de ${total} seções concluídas`}
        >
          <span
            className="block h-full w-full origin-left rounded-full bg-[var(--secondary)] transition-transform duration-200 motion-reduce:transition-none"
            style={{ transform: `scaleX(${total > 0 ? (idx < 0 ? 0 : idx) / total : 0})` }}
          />
        </div>

        {usoIa && <UsoIaBarra usado={usoIa.usado} limite={usoIa.limite} />}

        {!secaoAtual ? (
          <div className="space-y-3">
            {[0, 1].map((i) => (
              <div
                key={i}
                className="h-24 animate-pulse rounded-[var(--radius-md)] bg-[var(--surface)] motion-reduce:animate-none"
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
            plano={usoIa?.plano ?? "confere"}
            onGerou={() => void qc.invalidateQueries({ queryKey: ["uso-ia-planejamento", userId] })}
          />
        )}
      </div>
    </PaginaLogada>
  );
}

// Máscara de moeda: cada dígito digitado empurra a casa dos centavos, sem
// depender de o texto já ter "R$" ou separador (funciona também colando um
// valor pronto). Formato final: "R$ 1.234,56".
function formatarMoedaDigitada(valor: string): string {
  const digitos = valor.replace(/\D/g, "");
  if (!digitos) return "";
  const centavos = parseInt(digitos, 10);
  const reais = (centavos / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `R$ ${reais}`;
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
  plano,
  onGerou,
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
  plano: string;
  onGerou: () => void;
}) {
  // Módulos 4 (só número) e 5 (canais) não têm o botão de IA.
  const semIa = MODULOS_SEM_IA.has(secao.modulo);
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
        // Toast, não só o texto "Salvo" no topo: rolada a página, esse texto
        // some da vista e não dava pra saber se a resposta gravou.
        // Sem toast aqui: o autosave roda a cada pausa na digitação e o
        // "Salvo" pipocava toda hora. O toast fica no "Salvar e continuar".
        if (pendentes.current.size === 0) setStatus("saved");
      } catch (e) {
        console.error("planejamento: falha ao salvar resposta", e);
        // Volta pra fila: o "Salvar e continuar" tenta de novo antes de avançar.
        pendentes.current.add(i);
        setStatus("idle");
        toastErro(
          "A Pólia One não conseguiu salvar essa resposta. O texto continua aqui, tenta de novo.",
        );
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
    try {
      await Promise.all(
        idxs.map((i) => onUpsert(i, secao.perguntas[i].campo, valoresRef.current[i])),
      );
    } catch (e) {
      idxs.forEach((i) => pendentes.current.add(i));
      setStatus("idle");
      throw e;
    }
    setStatus("saved");
  }, [onUpsert, secao]);

  // Flush best-effort ao desmontar (troca de seção/saída). Lê pendentes.current
  // na hora do cleanup de propósito -- é o que há de pendente no desmonte, não
  // uma cópia congelada de quando o effect montou (pendentes é um Set mutável
  // de controle, não um nó de DOM).
  useEffect(() => {
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      const idxs = Array.from(pendentes.current);
      Object.values(timers.current).forEach((t) => clearTimeout(t));
      idxs.forEach((i) =>
        onUpsert(i, secao.perguntas[i].campo, valoresRef.current[i]).catch((e) =>
          console.error("planejamento: falha ao salvar ao sair da seção", e),
        ),
      );
    };
  }, [onUpsert, secao]);

  // O array novo é montado aqui e não dentro do updater do setState: o
  // updater só roda no próximo render, e quem salvava logo em seguida
  // (gerarComAimer) lia o valor antigo e gravava a resposta vazia.
  const definirValor = (i: number, v: string) => {
    const c = [...valoresRef.current];
    c[i] = v;
    valoresRef.current = c;
    setValores(c);
  };

  const onChange = (i: number, v: string) => {
    definirValor(i, v);
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
    // "Gerar outro" parte do texto original dela, não do rascunho anterior.
    const base = rascunho[i] != null ? (valorAntesDeGerar[i] ?? "") : valoresRef.current[i];
    if (rascunho[i] == null) setValorAntesDeGerar((s) => ({ ...s, [i]: valoresRef.current[i] }));
    try {
      const resultado = await gerarRascunhoPlanejamento({
        data: { secao: secao.id, perguntaIdx: i, textoAtual: base ?? "" },
      });
      if (resultado.ok) {
        definirValor(i, resultado.texto);
        setRascunho((s) => ({ ...s, [i]: resultado.texto }));
        track("planejamento_ia_gerado", { campo: secao.perguntas[i].campo });
        onGerou();
        // Salva na hora: o campo já aparece preenchido com o rascunho, e sem
        // isto ele só ia pro banco se a usuária clicasse "Usar" — avançando
        // direto (Salvar e continuar) o rascunho sumia sem nunca ser salvo.
        setStatus("saving");
        await salvarUm(i);
      } else if (resultado.motivo === "cota_atingida") {
        setCotaAtingida((s) => ({ ...s, [i]: true }));
        onGerou();
      } else if (resultado.motivo === "contexto_insuficiente") {
        setContextoInsuf((s) => ({ ...s, [i]: true }));
      } else {
        setErroGeracao((s) => ({
          ...s,
          [i]: "A Pólia One não conseguiu gerar o rascunho agora. Tenta de novo.",
        }));
      }
    } catch {
      setErroGeracao((s) => ({
        ...s,
        [i]: "A Pólia One não conseguiu gerar o rascunho agora. Tenta de novo.",
      }));
    } finally {
      setGerando((s) => ({ ...s, [i]: false }));
    }
  };

  const usarRascunho = (i: number) => onChange(i, valoresRef.current[i]);

  const descartarRascunho = (i: number) => {
    const original = valorAntesDeGerar[i] ?? "";
    definirValor(i, original);
    setRascunho((s) => ({ ...s, [i]: null }));
    // O rascunho foi salvo assim que a Aimer gerou (ver gerarComAimer):
    // descartar também precisa gravar a reversão, senão o banco fica com o
    // texto da IA mesmo depois de "Descartar".
    setStatus("saving");
    void salvarUm(i);
  };

  const concluir = async () => {
    setAvancando(true);
    try {
      await flush();
      await onConcluir();
      toastSucesso("Salvo");
    } catch (e) {
      console.error("planejamento: falha ao concluir seção", e);
      toastErro(
        "A Pólia One não conseguiu salvar a seção. As respostas continuam aqui, tenta de novo.",
      );
    } finally {
      setAvancando(false);
    }
  };

  const voltar = async () => {
    try {
      await flush();
      onVoltar();
    } catch {
      toastErro("A Pólia One não conseguiu salvar antes de voltar. Tenta de novo.");
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-accent font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
          Seção {indice + 1} de {total}
        </p>
        <span className="text-[11px] text-[var(--muted)]">
          {status === "saving" ? "Salvando…" : status === "saved" ? "Salvo" : ""}
        </span>
      </div>
      {/* <h2>, não <h1>: o <h1> da tela é o do PaginaLogada (o nome do módulo).
          O subtítulo é Inter reto — Inter itálico não existe no sistema e
          Fraunces é reservada a acento pontual, não a linha de apoio de form. */}
      <h2 className="font-cabinet mt-1 text-[22px] leading-[1.15] text-[var(--ink)]">
        {secao.titulo}
      </h2>
      <p className="mt-1 text-[14px] text-[var(--ink-soft)]">{secao.subtitulo}</p>

      <div className="mt-8 space-y-6">
        {secao.perguntas.map((p, i) =>
          p.tipo === "moeda" ? (
            <label key={i} className="block">
              <span className="mb-2 block text-[1rem] leading-snug text-[var(--ink)]">
                {p.label}
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={valores[i]}
                onChange={(e) => onChange(i, formatarMoedaDigitada(e.target.value))}
                placeholder="R$ 0,00"
                className="w-full rounded-[var(--radius-sm)] border border-[var(--line)] bg-white px-3 py-3 text-[15px] text-[var(--ink)] focus:border-[var(--secondary-text)] focus:shadow-[inset_0_0_0_1px_var(--secondary-text)] focus:outline-none"
              />
            </label>
          ) : (
            // <div> + <label htmlFor>, não <label> envolvendo tudo: os botões da
            // Aimer e as mensagens moram aqui dentro e entravam no nome acessível
            // do campo ("Escreva... Peça ajuda à Aimer").
            <div key={i}>
              <label
                htmlFor={`pergunta-${i}`}
                className="mb-2 block text-[1rem] leading-snug text-[var(--ink)]"
              >
                {p.label}
              </label>
              <textarea
                id={`pergunta-${i}`}
                value={valores[i]}
                onChange={(e) => onChange(i, e.target.value)}
                disabled={gerando[i]}
                placeholder="Escreva aqui…"
                aria-describedby={
                  cotaAtingida[i] || contextoInsuf[i] || erroGeracao[i]
                    ? `pergunta-${i}-mensagem`
                    : undefined
                }
                aria-invalid={erroGeracao[i] ? true : undefined}
                // Rascunho de IA ainda não aceito: borda tracejada turquesa, pra
                // não parecer texto final dela (pedido da Sil, 05/10/2026).
                className={`min-h-[96px] w-full resize-y rounded-[var(--radius-sm)] bg-white px-3 py-3 text-[15px] leading-relaxed text-[var(--ink)] focus:border-[var(--secondary-text)] focus:shadow-[inset_0_0_0_1px_var(--secondary-text)] focus:outline-none disabled:bg-[var(--surface)] ${
                  rascunho[i] != null
                    ? "border-[1.5px] border-dashed border-[var(--secondary-text)]"
                    : "border border-[var(--line)]"
                }`}
              />

              <div id={`pergunta-${i}-mensagem`} aria-live="polite">
                {cotaAtingida[i] ? (
                  <p className="mt-2 text-[13px] text-[var(--ink-soft)]">
                    {avisoCotaEsgotada(plano).texto}{" "}
                    {avisoCotaEsgotada(plano).upgrade && (
                      <Link
                        to="/upgrade"
                        search={{
                          rota: "/planejamento",
                          tier: avisoCotaEsgotada(plano).upgrade!.tier,
                        }}
                        className="font-medium text-[var(--secondary-text)] no-underline hover:underline"
                      >
                        {avisoCotaEsgotada(plano).upgrade!.rotulo}
                      </Link>
                    )}
                  </p>
                ) : contextoInsuf[i] ? (
                  <p className="mt-2 text-[13px] text-[var(--ink-soft)]">
                    A Pólia One precisa saber o básico do seu negócio antes. Responda o que você
                    vende (
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
                    ) e a Pólia One rascunha o resto.
                  </p>
                ) : erroGeracao[i] ? (
                  <p className="mt-2 text-[13px] text-[var(--danger)]">
                    {erroGeracao[i]}{" "}
                    <button
                      type="button"
                      onClick={() => void gerarComAimer(i)}
                      className="inline-flex min-h-11 items-center font-medium underline"
                    >
                      Tentar de novo
                    </button>
                  </p>
                ) : rascunho[i] != null ? (
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <p className="flex w-full items-center gap-1.5 text-[13px] text-[var(--ink-soft)]">
                      <Sparkles
                        size={13}
                        aria-hidden="true"
                        className="shrink-0 text-[var(--secondary-text)]"
                      />
                      Rascunho da Pólia One. Revise, ajuste o que quiser e confirme.
                    </p>
                    <button
                      type="button"
                      onClick={() => usarRascunho(i)}
                      className={`${BTN_MIUDO} !bg-[var(--secondary)]`}
                    >
                      Usar este rascunho
                    </button>
                    <button
                      type="button"
                      onClick={() => descartarRascunho(i)}
                      className="inline-flex min-h-11 items-center px-1 text-[13px] text-[var(--secondary-text)] hover:underline"
                    >
                      Descartar
                    </button>
                    <button
                      type="button"
                      onClick={() => void gerarComAimer(i)}
                      className="inline-flex min-h-11 items-center px-1 text-[13px] text-[var(--secondary-text)] hover:underline"
                    >
                      Gerar outro
                    </button>
                  </div>
                ) : semIa ? null : !valores[i]?.trim() && !gerando[i] ? (
                  // A IA completa o que a usuária escreveu; com o campo vazio
                  // ela inventava do zero e o texto saía estranho (05/10/2026).
                  <p className="mt-2 inline-flex items-center gap-1.5 text-[13px] text-[var(--muted)]">
                    <Sparkles size={13} aria-hidden="true" />
                    Escreve um começo, mesmo curto, e a Pólia One ajuda a completar.
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={() => void gerarComAimer(i)}
                    disabled={gerando[i]}
                    className="mt-1 inline-flex min-h-11 items-center gap-1.5 text-[13px] font-medium text-[var(--secondary-text)] hover:underline disabled:cursor-not-allowed disabled:text-[var(--muted)] disabled:no-underline"
                  >
                    <Sparkles size={13} aria-hidden="true" />
                    {gerando[i]
                      ? "A Pólia One está completando o seu texto…"
                      : "Completar com a Pólia One"}
                  </button>
                )}
              </div>
            </div>
          ),
        )}
      </div>

      <div className="mt-8 flex flex-col items-start gap-4">
        <button type="button" onClick={concluir} disabled={avancando} className={BTN_ACAO}>
          {avancando ? "Salvando…" : ultima ? "Concluir módulo" : "Salvar e continuar"}
          <ArrowRight size={16} aria-hidden="true" />
        </button>
        {podeVoltar && (
          <button
            type="button"
            onClick={voltar}
            className="inline-flex min-h-11 items-center text-[0.875rem] font-medium text-[var(--secondary-text)] hover:underline"
          >
            ← Seção anterior
          </button>
        )}
      </div>
    </div>
  );
}

/** "Completar com IA: 12 de 60 neste mês", com aviso perto do limite. */
function UsoIaBarra({ usado, limite }: { usado: number; limite: number }) {
  const pct = limite > 0 ? Math.min(100, (usado / limite) * 100) : 100;
  const restam = Math.max(0, limite - usado);
  const perto = pertoDoLimite(usado, limite);
  return (
    <div className="-mt-4 mb-8 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[var(--muted)]">
      <span className="inline-flex items-center gap-1.5">
        <Sparkles size={12} aria-hidden="true" />
        IA neste mês: {usado} de {limite}
      </span>
      <span
        className="h-1 w-24 overflow-hidden rounded-full bg-[var(--line)]"
        role="meter"
        aria-label="Uso de IA no mês"
        aria-valuenow={usado}
        aria-valuemin={0}
        aria-valuemax={limite}
      >
        <span
          className={`block h-full rounded-full ${restam === 0 ? "bg-[var(--danger)]" : "bg-[var(--secondary)]"}`}
          style={{ width: `${pct}%` }}
        />
      </span>
      {perto && (
        <span className="text-[var(--ink-soft)]">
          {restam === 1 ? "Resta 1 uso." : `Restam ${restam} usos.`} Renova no dia 1º.
        </span>
      )}
      {restam === 0 && <span className="text-[var(--danger)]">Os usos deste mês já foram.</span>}
    </div>
  );
}
