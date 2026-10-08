import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, redirect, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Lock, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { useUserMeta } from "@/hooks/useUserMeta";
import { PaginaLogada } from "@/components/layout/PaginaLogada";
import { BTN_ACAO, BTN_ACAO_CONTORNO, BTN_MIUDO, BTN_PRIMARIO } from "@/lib/botoes";
import { track } from "@/lib/analytics";
import { registrar } from "@/lib/founder-eventos";
import { CsatPrompt } from "@/components/csat/CsatPrompt";
import { useCsatTrigger } from "@/hooks/useCsatTrigger";
import { toastErro, toastInfo, toastSucesso } from "@/lib/toast";
import {
  type Secao,
  MODULOS_SEM_IA,
  SECOES,
  TOTAL_MODULOS,
  acessoDaFerramenta,
  ferramentaDe,
  moduloAtualDe,
  moduloInfo,
  moduloLiberado,
  modulosQueFaltamAntes,
  secoesDoModulo,
  textoModulosQueFaltam,
} from "@/lib/planejamento";
import {
  type VersaoResposta,
  ehConflitoDeVersao,
  salvarComVersao,
} from "@/lib/planejamentoConflito";
import { gerarRascunhoPlanejamento, usoIaPlanejamento } from "@/lib/planejamentoIa.functions";
import { avisoCotaEsgotada, pertoDoLimite } from "@/lib/usoIa";
import { limparMoedaDigitada, normalizarMoeda, posicaoDoCursor } from "@/lib/planejamentoMoeda";
import {
  enfileirarSalvamento,
  esperarSalvamentos,
  haSalvamentoEmAndamento,
  secaoTemResposta,
} from "@/lib/planejamentoSalvamento";
import { LinkInterno } from "@/components/ui/LinkInterno";
import { BlockError } from "@/components/ui/BlockError";

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
  /** Versão da resposta: a gravação só passa se o banco ainda estiver nela. */
  updated_at: string;
}
interface SecaoRow {
  secao: string;
  concluido: boolean;
}

// Conflito entre abas (07/10/2026). As duas memórias abaixo são desta aba e
// vivem fora do componente, como a fila de salvamento: sobrevivem à troca de
// seção.
//
// `escritasDestaAba`: updated_at de cada gravação que esta aba fez, por
// resposta. Se o envio de saída de uma seção volta depois que a mesma seção
// remontou com a versão anterior, a gravação é desta aba e não vira conflito.
const escritasDestaAba = new Map<string, Set<string>>();
// `conflitosGuardados`: texto que não foi salvo porque a resposta mudou em outra
// aba e a seção já tinha fechado (envio de saída). Ao voltar pra seção, o aviso
// aparece com esse texto, em vez de ele sumir.
const conflitosGuardados = new Map<string, { local: string; noBanco: VersaoResposta }>();
const chaveResposta = (userId: string, secao: string, perguntaIdx: number) =>
  `${userId}:${secao}:${perguntaIdx}`;

/** O flush parou porque uma resposta tem conflito em aberto (não é falha de rede). */
class ConflitoAberto extends Error {
  constructor() {
    super("planejamento: conflito entre abas em aberto");
    this.name = "ConflitoAberto";
  }
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
  const meta = useUserMeta();
  // Marca, Mapa de Mercado e Financeiro são do Premium: a tela de fim de módulo
  // comemorava a ferramenta e o botão caía no paywall sem aviso. Enquanto o
  // plano carrega, nada de cadeado (quem paga não pode ver a trava piscar).
  const acessoFerramenta = acessoDaFerramenta(ferramenta, meta.plano, meta.carregando);
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
      // QA-13: saindo pro Painel e voltando rápido, o salvamento feito na saída
      // ainda estava a caminho e a leitura trazia o texto de antes dele.
      await esperarSalvamentos();
      // Respostas filtradas pelo id da seção, não pela coluna `modulo`: a seção
      // "1.0" passou do módulo 1 pro 4 e pode ter linha antiga com modulo = 1.
      // As seções concluídas vêm de TODOS os módulos: é com elas que a regra de
      // liberação (QA-21) decide se este módulo abre.
      const [draftsRes, secoesRes] = await Promise.all([
        supabase
          .from("planejamento_respostas" as never)
          .select("secao, pergunta_idx, resposta, updated_at")
          .eq("user_id", userId!)
          .in(
            "secao",
            secoes.map((s) => s.id),
          ),
        supabase
          .from("planejamento_secoes" as never)
          .select("secao, concluido")
          .eq("user_id", userId!),
      ]);
      // Leitura que falha não pode virar formulário vazio: a usuária digitava
      // por cima e o salvamento apagava o que estava guardado.
      const erroLeitura =
        (draftsRes as unknown as { error: unknown }).error ??
        (secoesRes as unknown as { error: unknown }).error;
      if (erroLeitura) throw erroLeitura;
      return {
        drafts: ((draftsRes as unknown as { data: DraftRow[] | null }).data ?? []) as DraftRow[],
        secoes: ((secoesRes as unknown as { data: SecaoRow[] | null }).data ?? []) as SecaoRow[],
      };
    },
    // O formulário lê os valores só quando monta; refazer a leitura ao voltar
    // pra aba não muda o que está na tela, só arrisca trocar o cache por uma
    // leitura que saiu antes do último salvamento.
    refetchOnWindowFocus: false,
    // Sempre relê ao abrir: o formulário espera essa leitura (leituraFresca).
    refetchOnMount: "always",
  });
  // QA-13: ao voltar pro módulo, o cache tinha a versão de antes da edição e o
  // formulário montava com ela; digitar de novo salvava o texto velho por cima.
  // O formulário só monta com uma leitura feita nesta visita.
  const leituraFresca = dadosQuery.isFetchedAfterMount && !dadosQuery.isError;

  const drafts = useMemo(() => dadosQuery.data?.drafts ?? [], [dadosQuery.data?.drafts]);
  // Ids de seção concluídos em todos os módulos (ver a leitura acima).
  const concluidas = useMemo(
    () => new Set((dadosQuery.data?.secoes ?? []).filter((s) => s.concluido).map((s) => s.secao)),
    [dadosQuery.data?.secoes],
  );
  // QA-21: o trancamento era só visual, e /planejamento/modulo/4 digitado na
  // barra abria o módulo com os anteriores em aberto. Mesma regra do mapa.
  const liberado = moduloLiberado(n, concluidas);

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
  // A versão de cada resposta que o formulário mostra ao montar: é dela que a
  // gravação parte (null = a resposta ainda não existia no banco).
  const versoesDaSecao = useMemo(() => {
    if (!secaoAtual) return [] as (VersaoResposta | null)[];
    return secaoAtual.perguntas.map((_, i) => {
      const d = drafts.find((r) => r.secao === secaoAtual.id && r.pergunta_idx === i);
      return d ? { resposta: d.resposta, updated_at: d.updated_at } : null;
    });
  }, [secaoAtual, drafts]);

  // Mantém o cache igual ao banco: trocar de seção (ou voltar ao módulo) monta
  // o formulário a partir dele, com o texto e a versão de cada resposta.
  const gravarNoCache = useCallback(
    (secaoId: string, perguntaIdx: number, versao: VersaoResposta) => {
      qc.setQueryData<{ drafts: DraftRow[]; secoes: SecaoRow[] }>(
        ["modulo", userId, n],
        (antes) => {
          if (!antes) return antes;
          const outras = antes.drafts.filter(
            (d) => !(d.secao === secaoId && d.pergunta_idx === perguntaIdx),
          );
          return {
            ...antes,
            drafts: [
              ...outras,
              {
                secao: secaoId,
                pergunta_idx: perguntaIdx,
                resposta: versao.resposta,
                updated_at: versao.updated_at,
              },
            ],
          };
        },
      );
    },
    [qc, userId, n],
  );

  // Lança em caso de erro: antes o retorno do banco era ignorado e a tela
  // mostrava "Salvo" mesmo quando a gravação falhava. Lança ConflitoDeVersao
  // quando outra aba (ou aparelho) salvou esta resposta depois da leitura:
  // aí nada é gravado e o formulário pergunta qual versão fica.
  const upsertResposta = useCallback(
    async (
      perguntaIdx: number,
      campo: string,
      resposta: string,
      lida: VersaoResposta | null,
    ): Promise<VersaoResposta> => {
      if (!userId || !secaoAtual) throw new Error("planejamento: sessão ou seção ausente");
      const secaoId = secaoAtual.id;
      const chave = chaveResposta(userId, secaoId, perguntaIdx);
      const tabela = () => supabase.from("planejamento_respostas");
      const doBanco = (d: { resposta: string | null; updated_at: string } | null | undefined) =>
        d ? { resposta: d.resposta, updated_at: d.updated_at } : null;

      const gravada = await salvarComVersao(lida, resposta, {
        ler: async () => {
          const { data, error } = await tabela()
            .select("resposta, updated_at")
            .eq("user_id", userId)
            .eq("secao", secaoId)
            .eq("pergunta_idx", perguntaIdx)
            .maybeSingle();
          if (error) throw error;
          return doBanco(data);
        },
        atualizarSe: async (updatedAtLido, texto) => {
          const { data, error } = await tabela()
            .update({ campo, modulo: n, resposta: texto, updated_at: new Date().toISOString() })
            .eq("user_id", userId)
            .eq("secao", secaoId)
            .eq("pergunta_idx", perguntaIdx)
            .eq("updated_at", updatedAtLido)
            .select("resposta, updated_at");
          if (error) throw error;
          return doBanco(data?.[0]);
        },
        inserir: async (texto) => {
          const { data, error } = await tabela()
            .insert({
              user_id: userId,
              modulo: n,
              secao: secaoId,
              pergunta_idx: perguntaIdx,
              campo,
              resposta: texto,
              updated_at: new Date().toISOString(),
            })
            .select("resposta, updated_at");
          // 23505: a linha já existe (outra aba criou primeiro).
          if (error && (error as { code?: string }).code === "23505") return null;
          if (error) throw error;
          return doBanco(data?.[0]);
        },
        ehDestaAba: (v) => escritasDestaAba.get(chave)?.has(v.updated_at) ?? false,
        gravarSemCondicao: async (texto) => {
          const { data, error } = await tabela()
            .upsert(
              {
                user_id: userId,
                modulo: n,
                secao: secaoId,
                pergunta_idx: perguntaIdx,
                campo,
                resposta: texto,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "user_id,secao,pergunta_idx" },
            )
            .select("resposta, updated_at")
            .single();
          if (error) throw error;
          return { resposta: data.resposta, updated_at: data.updated_at };
        },
      });

      const minhas = escritasDestaAba.get(chave) ?? new Set<string>();
      minhas.add(gravada.updated_at);
      escritasDestaAba.set(chave, minhas);

      gravarNoCache(secaoId, perguntaIdx, gravada);
      return gravada;
    },
    [userId, secaoAtual, n, gravarNoCache],
  );

  // "Carregar a outra versão": o formulário passa a mostrar o que está no banco.
  const carregarVersao = useCallback(
    (perguntaIdx: number, versao: VersaoResposta) => {
      if (secaoAtual) gravarNoCache(secaoAtual.id, perguntaIdx, versao);
    },
    [secaoAtual, gravarNoCache],
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
          {!acessoFerramenta.liberada && (
            <p className="mt-2 max-w-[420px] text-[0.875rem] leading-relaxed text-[var(--ink-soft)]">
              {acessoFerramenta.aviso}
            </p>
          )}
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
              <LinkInterno href={acessoFerramenta.href} className={`${BTN_ACAO_CONTORNO} mt-5`}>
                {!acessoFerramenta.liberada && <Lock size={15} aria-hidden="true" />}
                {acessoFerramenta.rotulo}
              </LinkInterno>
            </>
          ) : (
            <LinkInterno href={acessoFerramenta.href} className={`${BTN_PRIMARIO} mt-8`}>
              {!acessoFerramenta.liberada && <Lock size={16} aria-hidden="true" />}
              {acessoFerramenta.rotulo}
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

  // ── Módulo trancado (QA-21) ── no lugar do formulário, o que falta antes e
  // o botão pro módulo que está aberto. Nada de redirect mudo.
  if (leituraFresca && !liberado) {
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
        <ModuloTrancado n={n} concluidas={concluidas} />
      </PaginaLogada>
    );
  }

  const total = secoes.length;
  // QA-21: a barra usava a posição da seção aberta, e um módulo concluído
  // reaberto mostrava "0 de 5". Agora conta as seções concluídas.
  const feitasNoModulo = secoes.filter((s) => concluidas.has(s.id)).length;

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
          aria-valuenow={feitasNoModulo}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-label={`${feitasNoModulo} de ${total} seções concluídas`}
        >
          <span
            className="block h-full w-full origin-left rounded-full bg-[var(--secondary)] transition-transform duration-200 motion-reduce:transition-none"
            style={{ transform: `scaleX(${total > 0 ? feitasNoModulo / total : 0})` }}
          />
        </div>

        {usoIa && <UsoIaBarra usado={usoIa.usado} limite={usoIa.limite} />}

        {dadosQuery.isError ? (
          <BlockError
            message="A Pólia One não conseguiu abrir as suas respostas agora. Nada foi perdido, é só a leitura que falhou."
            onRetry={() => void dadosQuery.refetch()}
          />
        ) : !secaoAtual || !leituraFresca ? (
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
            versoesIniciais={versoesDaSecao}
            userId={userId!}
            onUpsert={upsertResposta}
            onCarregarVersao={carregarVersao}
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

/** Tela de módulo trancado: o que falta antes e o caminho pro módulo aberto. */
function ModuloTrancado({ n, concluidas }: { n: number; concluidas: ReadonlySet<string> }) {
  const navigate = useNavigate();
  const atual = moduloAtualDe(concluidas);
  const faltam = modulosQueFaltamAntes(n, concluidas);
  const infoAtual = moduloInfo(atual);
  const feitasNoAtual = secoesDoModulo(atual).filter((s) => concluidas.has(s.id)).length;
  return (
    <div className="max-w-[560px] rounded-[var(--radius-md)] bg-[var(--surface)] p-6">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--line)] bg-white">
        <Lock size={18} className="text-[var(--ink)]" aria-hidden="true" />
      </span>
      <h2 className="font-cabinet mt-4 text-[22px] leading-[1.15] text-[var(--ink)]">
        Este módulo ainda não abriu.
      </h2>
      <p className="mt-2 text-[15px] leading-relaxed text-[var(--ink-soft)]">
        O Módulo {n} abre depois que {textoModulosQueFaltam(faltam)}. O Planejamento abre um módulo
        de cada vez, na ordem, e o que está aberto agora é o Módulo {atual}, {infoAtual.nome}.
      </p>
      <button
        type="button"
        onClick={() =>
          void navigate({
            to: "/planejamento/modulo/$n",
            params: { n: String(atual) },
            search: { secao: undefined },
          })
        }
        className={`${BTN_ACAO} mt-6`}
      >
        {feitasNoAtual > 0 ? "Continuar" : "Começar"} o Módulo {atual}
        <ArrowRight size={16} aria-hidden="true" />
      </button>
      <div>
        <LinkInterno
          href="/planejamento"
          className="mt-2 inline-flex min-h-11 items-center text-[0.875rem] font-medium text-[var(--secondary-text)] no-underline hover:underline"
        >
          Ver o planejamento
        </LinkInterno>
      </div>
    </div>
  );
}

// Máscara de moeda: ver src/lib/planejamentoMoeda.ts (QA-15). O número é lido
// como reais ("3000" = R$ 3.000,00), não mais como centavos.

function SecaoForm({
  secao,
  indice,
  total,
  draftsIniciais,
  versoesIniciais,
  userId,
  onUpsert,
  onCarregarVersao,
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
  versoesIniciais: (VersaoResposta | null)[];
  userId: string;
  onUpsert: (
    perguntaIdx: number,
    campo: string,
    resposta: string,
    lida: VersaoResposta | null,
  ) => Promise<VersaoResposta>;
  onCarregarVersao: (perguntaIdx: number, versao: VersaoResposta) => void;
  onConcluir: () => Promise<void>;
  onVoltar: () => void;
  podeVoltar: boolean;
  ultima: boolean;
  plano: string;
  onGerou: () => void;
}) {
  // Módulos 4 (só número) e 5 (canais) não têm o botão de IA.
  const semIa = MODULOS_SEM_IA.has(secao.modulo);
  // Texto que ficou sem salvar por conflito quando a seção fechou (ver
  // conflitosGuardados): volta pro campo, com o aviso aberto.
  const [guardados] = useState(() =>
    secao.perguntas.map((_, i) => conflitosGuardados.get(chaveResposta(userId, secao.id, i))),
  );
  const [valores, setValores] = useState<string[]>(() =>
    secao.perguntas.map((_, i) => guardados[i]?.local ?? draftsIniciais[i] ?? ""),
  );
  const valoresRef = useRef(valores);
  valoresRef.current = valores;
  const timers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const pendentes = useRef<Set<number>>(new Set());
  const [status, setStatus] = useState<
    "idle" | "saving" | "saved" | "erro" | "offline" | "conflito"
  >("idle");
  // Versão de cada resposta que esta aba leu (ou gravou por último). A gravação
  // só passa se o banco ainda estiver nela.
  const versoes = useRef<(VersaoResposta | null)[]>(
    secao.perguntas.map((_, i) => versoesIniciais[i] ?? null),
  );
  // Respostas que outra aba alterou: guarda a versão do banco pra mostrar.
  const [conflitos, setConflitos] = useState<Record<number, VersaoResposta>>(() => {
    const c: Record<number, VersaoResposta> = {};
    guardados.forEach((g, i) => {
      if (g) c[i] = g.noBanco;
    });
    return c;
  });
  const conflitosRef = useRef(conflitos);
  conflitosRef.current = conflitos;
  // Some da memória só depois de montar (no StrictMode o inicializador roda 2x).
  useEffect(() => {
    secao.perguntas.forEach((_, i) => {
      if (guardados[i]) conflitosGuardados.delete(chaveResposta(userId, secao.id, i));
    });
    if (guardados.some(Boolean)) setStatus("conflito");
  }, [guardados, secao, userId]);
  const [avancando, setAvancando] = useState(false);
  const [semResposta, setSemResposta] = useState(false);

  // O que vai pro banco: campo em reais sai sempre normalizado ("R$ 3.000,00"),
  // mesmo que na tela ainda esteja "R$ 3000" (QA-15).
  const valorParaSalvar = useCallback(
    (i: number) => {
      const v = valoresRef.current[i] ?? "";
      return secao.perguntas[i].tipo === "moeda" ? normalizarMoeda(v) : v;
    },
    [secao],
  );

  // QA-14: um envio por campo de cada vez, lendo o valor na hora de sair. Dois
  // salvamentos do mesmo campo não chegam mais fora de ordem. Cada envio parte
  // da versão que o anterior deixou (a fila garante a ordem).
  const enviar = useCallback(
    (i: number) =>
      enfileirarSalvamento(`${secao.id}:${i}`, async () => {
        const gravada = await onUpsert(
          i,
          secao.perguntas[i].campo,
          valorParaSalvar(i),
          versoes.current[i],
        );
        versoes.current[i] = gravada;
      }),
    [onUpsert, secao, valorParaSalvar],
  );

  // Outra aba salvou esta resposta: nada foi gravado por cima. O campo sai da
  // lista de pendentes (a volta da internet não pode tentar de novo às cegas) e
  // o aviso abaixo dele pergunta qual versão fica.
  const marcarConflito = useCallback((i: number, noBanco: VersaoResposta) => {
    pendentes.current.delete(i);
    if (timers.current[i]) clearTimeout(timers.current[i]);
    // O ref muda na hora: uma tecla digitada antes do próximo render já vê o aviso.
    const proximos = { ...conflitosRef.current, [i]: noBanco };
    conflitosRef.current = proximos;
    setConflitos(proximos);
    setStatus("conflito");
  }, []);

  // ── Gerar com a Aimer (IA) ──
  const [rascunho, setRascunho] = useState<Record<number, string | null>>({});
  const [valorAntesDeGerar, setValorAntesDeGerar] = useState<Record<number, string>>({});
  const [gerando, setGerando] = useState<Record<number, boolean>>({});
  // Trava síncrona por campo: o estado `gerando` só muda no próximo render, e um
  // clique duplo em "Gerar outro" ou "Tentar de novo" disparava duas gerações
  // (duas cobranças na cota de IA do mês).
  const gerandoRef = useRef<Set<number>>(new Set());
  const [erroGeracao, setErroGeracao] = useState<Record<number, string | null>>({});
  const [cotaAtingida, setCotaAtingida] = useState<Record<number, boolean>>({});
  const [contextoInsuf, setContextoInsuf] = useState<Record<number, boolean>>({});

  const salvarUm = useCallback(
    async (i: number) => {
      pendentes.current.delete(i);
      try {
        await enviar(i);
        // Toast, não só o texto "Salvo" no topo: rolada a página, esse texto
        // some da vista e não dava pra saber se a resposta gravou.
        // Sem toast aqui: o autosave roda a cada pausa na digitação e o
        // "Salvo" pipocava toda hora. O toast fica no "Salvar e continuar".
        if (pendentes.current.size === 0)
          setStatus(Object.keys(conflitosRef.current).length > 0 ? "conflito" : "saved");
      } catch (e) {
        if (ehConflitoDeVersao(e)) {
          const jaAvisado = !!conflitosRef.current[i];
          marcarConflito(i, e.noBanco);
          if (!jaAvisado)
            toastInfo(
              "Uma resposta desta seção foi alterada em outra aba. A Pólia One não salvou por cima, escolha qual versão fica.",
            );
          return;
        }
        console.error("planejamento: falha ao salvar resposta", e);
        // Volta pra fila: o "Salvar e continuar" tenta de novo antes de avançar,
        // e a volta da internet também (ver o evento "online" mais abaixo).
        pendentes.current.add(i);
        // Sem internet, o aviso fixo ao lado do título basta: um toast a cada
        // pausa na digitação virava uma pilha de erros.
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          setStatus("offline");
          return;
        }
        setStatus("erro");
        toastErro(
          "A Pólia One não conseguiu salvar essa resposta. O texto continua aqui, tenta de novo.",
        );
      }
    },
    [enviar, marcarConflito],
  );

  const flush = useCallback(async () => {
    const idxs = Array.from(pendentes.current);
    pendentes.current.clear();
    Object.values(timers.current).forEach((t) => clearTimeout(t));
    timers.current = {};
    if (idxs.length === 0) return;
    setStatus("saving");
    const resultados = await Promise.allSettled(idxs.map((i) => enviar(i)));
    let falhou: unknown = null;
    let conflito = false;
    resultados.forEach((r, k) => {
      if (r.status === "fulfilled") return;
      const i = idxs[k];
      if (ehConflitoDeVersao(r.reason)) {
        marcarConflito(i, r.reason.noBanco);
        conflito = true;
      } else {
        pendentes.current.add(i);
        falhou = falhou ?? r.reason;
      }
    });
    if (falhou) {
      setStatus("erro");
      throw falhou;
    }
    if (conflito) throw new ConflitoAberto();
    setStatus("saved");
  }, [enviar, marcarConflito]);

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
        enviar(i).catch((e) => {
          if (ehConflitoDeVersao(e)) {
            // A seção já fechou: o texto fica guardado e o aviso abre quando
            // ela voltar pra esta seção.
            conflitosGuardados.set(chaveResposta(userId, secao.id, i), {
              local: valoresRef.current[i] ?? "",
              noBanco: e.noBanco,
            });
            toastInfo(
              `Uma resposta de "${secao.titulo}" foi alterada em outra aba e a Pólia One não salvou por cima. Abra a seção pra escolher qual versão fica.`,
            );
            return;
          }
          console.error("planejamento: falha ao salvar ao sair da seção", e);
        }),
      );
    };
  }, [enviar, secao, userId]);

  // Fechar a aba ou dar F5 no meio da pausa de 1 s perdia o que acabou de ser
  // digitado. pagehide dispara o salvamento (melhor esforço, vale no celular,
  // onde beforeunload nem sempre roda); beforeunload pede confirmação no
  // computador enquanto houver resposta sem salvar.
  useEffect(() => {
    const salvarPendentes = () => {
      const idxs = Array.from(pendentes.current);
      idxs.forEach((i) =>
        enviar(i).catch((e) =>
          console.error("planejamento: falha ao salvar ao fechar a página", e),
        ),
      );
    };
    const avisarAntesDeSair = (e: BeforeUnloadEvent) => {
      // QA-13: também avisa com salvamento a caminho. O campo saía da lista de
      // pendentes quando o envio começava, e um F5 com internet lenta cortava
      // o envio sem aviso nenhum.
      if (
        pendentes.current.size === 0 &&
        !haSalvamentoEmAndamento() &&
        Object.keys(conflitosRef.current).length === 0
      )
        return;
      salvarPendentes();
      e.preventDefault();
      e.returnValue = "";
    };
    // QA-14: a internet voltou, o que ficou sem salvar vai pro banco sozinho.
    const aoVoltarInternet = () => {
      Array.from(pendentes.current).forEach((i) => void salvarUm(i));
    };
    window.addEventListener("pagehide", salvarPendentes);
    window.addEventListener("beforeunload", avisarAntesDeSair);
    window.addEventListener("online", aoVoltarInternet);
    return () => {
      window.removeEventListener("pagehide", salvarPendentes);
      window.removeEventListener("beforeunload", avisarAntesDeSair);
      window.removeEventListener("online", aoVoltarInternet);
    };
  }, [enviar, salvarUm]);

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
    if (v.trim()) setSemResposta(false);
    // Qualquer edição (inclusive "usar", que rechama isto com o mesmo valor)
    // já basta pra considerar o rascunho aceito e sumir com o selo.
    setRascunho((s) => (s[i] != null ? { ...s, [i]: null } : s));
    // Com o aviso de outra aba aberto, o texto muda na tela mas só vai pro banco
    // quando ela escolher "Manter a desta tela" (que manda o texto de agora).
    if (conflitosRef.current[i]) return;
    pendentes.current.add(i);
    setStatus("saving");
    if (timers.current[i]) clearTimeout(timers.current[i]);
    timers.current[i] = setTimeout(() => void salvarUm(i), 1000);
  };

  const gerarComAimer = async (i: number) => {
    if (gerandoRef.current.has(i)) return;
    gerandoRef.current.add(i);
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
      gerandoRef.current.delete(i);
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

  // Campo em reais: limpa enquanto digita e devolve o cursor pro mesmo dígito.
  const onChangeMoeda = (i: number, el: HTMLInputElement) => {
    const digitado = el.value;
    const cursor = el.selectionStart ?? digitado.length;
    const limpo = limparMoedaDigitada(digitado);
    onChange(i, limpo);
    if (limpo !== digitado && typeof window !== "undefined") {
      const pos = posicaoDoCursor(digitado, cursor, limpo);
      window.requestAnimationFrame(() => {
        if (document.activeElement === el) el.setSelectionRange(pos, pos);
      });
    }
  };

  // Ao sair do campo, mostra no formato final ("R$ 3.000,00"). É o mesmo valor
  // que já vai pro banco, então não precisa salvar de novo.
  const onBlurMoeda = (i: number) => {
    const atual = valoresRef.current[i] ?? "";
    const final = normalizarMoeda(atual);
    if (final !== atual) definirValor(i, final);
  };

  // "Manter a versão desta tela": parte da versão do banco e grava por cima.
  const manterMinha = (i: number) => {
    const noBanco = conflitosRef.current[i];
    if (!noBanco) return;
    versoes.current[i] = noBanco;
    tirarConflito(i);
    setStatus("saving");
    void salvarUm(i);
  };

  // "Carregar a outra versão": o campo mostra o que está no banco, sem gravar.
  const carregarOutra = (i: number) => {
    const noBanco = conflitosRef.current[i];
    if (!noBanco) return;
    pendentes.current.delete(i);
    if (timers.current[i]) clearTimeout(timers.current[i]);
    versoes.current[i] = noBanco;
    definirValor(i, noBanco.resposta ?? "");
    setRascunho((s) => (s[i] != null ? { ...s, [i]: null } : s));
    onCarregarVersao(i, noBanco);
    const sobraConflito = tirarConflito(i);
    if (!sobraConflito) setStatus(pendentes.current.size > 0 ? "saving" : "saved");
  };

  /** Fecha o aviso do campo. Devolve se ainda há aviso aberto em outro campo. */
  const tirarConflito = (i: number) => {
    const resto = { ...conflitosRef.current };
    delete resto[i];
    conflitosRef.current = resto;
    setConflitos(resto);
    return Object.keys(resto).length > 0;
  };

  const avisoConflitoAberto = () =>
    toastInfo(
      "Uma resposta desta seção foi alterada em outra aba. Escolha qual versão fica antes de seguir.",
    );

  const concluir = async () => {
    if (!secaoTemResposta(valoresRef.current)) {
      setSemResposta(true);
      return;
    }
    if (Object.keys(conflitosRef.current).length > 0) {
      avisoConflitoAberto();
      return;
    }
    setAvancando(true);
    try {
      await flush();
      await onConcluir();
      toastSucesso("Salvo");
    } catch (e) {
      if (e instanceof ConflitoAberto) {
        avisoConflitoAberto();
        return;
      }
      console.error("planejamento: falha ao concluir seção", e);
      toastErro(
        "A Pólia One não conseguiu salvar a seção. As respostas continuam aqui, tenta de novo.",
      );
    } finally {
      setAvancando(false);
    }
  };

  const voltar = async () => {
    if (Object.keys(conflitosRef.current).length > 0) {
      avisoConflitoAberto();
      return;
    }
    try {
      await flush();
      onVoltar();
    } catch (e) {
      if (e instanceof ConflitoAberto) {
        avisoConflitoAberto();
        return;
      }
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
          {status === "saving"
            ? "Salvando…"
            : status === "saved"
              ? "Salvo"
              : status === "offline"
                ? "Sem internet. O texto fica aqui e salva quando a conexão voltar."
                : status === "erro"
                  ? "Não salvo ainda"
                  : status === "conflito"
                    ? "Resposta alterada em outra aba"
                    : ""}
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
            <div key={i}>
              <label className="block">
                <span className="mb-2 block text-[1rem] leading-snug text-[var(--ink)]">
                  {p.label}
                </span>
                <input
                  type="text"
                  // decimal, não numeric: o teclado numérico do iPhone não tem vírgula.
                  inputMode="decimal"
                  value={valores[i]}
                  onChange={(e) => onChangeMoeda(i, e.currentTarget)}
                  onBlur={() => onBlurMoeda(i)}
                  placeholder="R$ 0,00"
                  className="w-full rounded-[var(--radius-sm)] border border-[var(--line)] bg-white px-3 py-3 text-[15px] text-[var(--ink)] focus:border-[var(--secondary-text)] focus:shadow-[inset_0_0_0_1px_var(--secondary-text)] focus:outline-none"
                />
              </label>
              {conflitos[i] && (
                <AvisoConflito
                  noBanco={conflitos[i]}
                  onManter={() => manterMinha(i)}
                  onCarregar={() => carregarOutra(i)}
                />
              )}
            </div>
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

              {conflitos[i] && (
                <AvisoConflito
                  noBanco={conflitos[i]}
                  onManter={() => manterMinha(i)}
                  onCarregar={() => carregarOutra(i)}
                />
              )}

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
                      disabled={gerando[i]}
                      className="inline-flex min-h-11 items-center font-medium underline disabled:cursor-not-allowed disabled:text-[var(--muted)] disabled:no-underline"
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
                    {/* Durante a geração os três ficam desabilitados: "Gerar outro"
                        clicável gastava a cota de novo, e usar/descartar no meio
                        era sobrescrito pelo rascunho que ainda estava chegando. */}
                    <button
                      type="button"
                      onClick={() => usarRascunho(i)}
                      disabled={gerando[i]}
                      className={`${BTN_MIUDO} !bg-[var(--secondary)] disabled:cursor-not-allowed disabled:opacity-60`}
                    >
                      Usar este rascunho
                    </button>
                    <button
                      type="button"
                      onClick={() => descartarRascunho(i)}
                      disabled={gerando[i]}
                      className="inline-flex min-h-11 items-center px-1 text-[13px] text-[var(--secondary-text)] hover:underline disabled:cursor-not-allowed disabled:text-[var(--muted)] disabled:no-underline"
                    >
                      Descartar
                    </button>
                    <button
                      type="button"
                      onClick={() => void gerarComAimer(i)}
                      disabled={gerando[i]}
                      className="inline-flex min-h-11 items-center px-1 text-[13px] text-[var(--secondary-text)] hover:underline disabled:cursor-not-allowed disabled:text-[var(--muted)] disabled:no-underline"
                    >
                      {gerando[i] ? "Gerando outro…" : "Gerar outro"}
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
        {semResposta && (
          <p role="alert" className="text-[13px] text-[var(--danger)]">
            A Pólia One precisa de pelo menos uma resposta pra fechar esta seção. O resto dá pra
            completar depois.
          </p>
        )}
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

/**
 * Outra aba (ou aparelho) salvou esta resposta depois que esta tela leu. Nada
 * foi gravado por cima: ela escolhe se fica o texto desta tela ou o da outra.
 */
function AvisoConflito({
  noBanco,
  onManter,
  onCarregar,
}: {
  noBanco: VersaoResposta;
  onManter: () => void;
  onCarregar: () => void;
}) {
  const outra = (noBanco.resposta ?? "").trim();
  return (
    <div role="status" className="mt-2 rounded-[var(--radius-sm)] bg-[var(--surface)] px-4 py-3">
      <p className="text-[13px] font-medium text-[var(--ink)]">
        Essa resposta foi alterada em outra aba.
      </p>
      <p className="mt-1 text-[13px] leading-relaxed text-[var(--ink-soft)]">
        A Pólia One não salvou por cima. O texto desta tela continua no campo, e a versão da outra
        aba é esta:
      </p>
      <p className="mt-2 line-clamp-4 whitespace-pre-line rounded-[var(--radius-sm)] border border-[var(--line)] bg-white px-3 py-2 text-[13px] leading-relaxed text-[var(--ink-soft)]">
        {outra || "Em branco."}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <button type="button" onClick={onManter} className={BTN_MIUDO}>
          Manter a desta tela
        </button>
        <button
          type="button"
          onClick={onCarregar}
          className="inline-flex min-h-11 items-center px-1 text-[13px] font-medium text-[var(--secondary-text)] hover:underline"
        >
          Carregar a outra versão
        </button>
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
