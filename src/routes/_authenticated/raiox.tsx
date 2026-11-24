import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles, CalendarClock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { useUserMeta } from "@/hooks/useUserMeta";
import { PaginaLogada } from "@/components/layout/PaginaLogada";
import { Vazio } from "@/components/layout/Vazio";
import { UpgradeGate } from "@/components/layout/UpgradeGate";
import { BTN_ACAO, BTN_ACAO_CONTORNO } from "@/lib/botoes";
import { gerarRaioX, usoRaioX } from "@/lib/raiox.functions";
import {
  LIMITE_RAIOX_MENSAL,
  avisoDoMotivoRaioX,
  restantesRaioX,
  textoLimiteAtingidoRaioX,
  textoRestantesRaioX,
  textoUltimaGeracaoRaioX,
  type MotivoRaioX,
} from "@/lib/raioxMotivo";
import { dataHoraDaGeracao, ordenarVersoes, versaoEscolhida } from "@/lib/raioxGeracoes";
import { ConfirmarAcao } from "@/components/ui/ConfirmarAcao";
import { track } from "@/lib/analytics";
import { registrar } from "@/lib/founder-eventos";
import { temNumerosDoMes, tierDosNumeros, tiersPagos } from "@/lib/planos";
import { LinkInterno } from "@/components/ui/LinkInterno";
import { AvisoConteudoIA } from "@/components/ui/AvisoConteudoIA";

export const Route = createFileRoute("/_authenticated/raiox")({
  head: () => ({
    meta: [
      { title: "Raio-x do mês · Pólia One" },
      { name: "description", content: "A leitura do seu mês, pela Pólia One." },
    ],
  }),
  component: RaioXPage,
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

function opcoesDeMes(): { mes: number; ano: number; label: string }[] {
  const hoje = new Date();
  const opcoes = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    opcoes.push({
      mes: d.getMonth() + 1,
      ano: d.getFullYear(),
      label: `${MESES[d.getMonth()]} ${d.getFullYear()}`,
    });
  }
  return opcoes;
}

const ROTA_LABEL: Record<string, string> = {
  produtos: "Ver Produtos",
  financeiro: "Ver Financeiro",
  metas: "Ver Metas",
  clientes: "Ver Clientes",
};

interface RaioXRow {
  id: string;
  criado_em: string;
  placar: string;
  causas: string;
  sugestoes: { texto: string; rota: string | null }[];
  dado_ralo: boolean;
  /** QA-30: frases fixas (meta/preço de hoje no lugar do mês). Ausente antes da migração 20261008190000. */
  avisos?: string[] | null;
}

function RaioXPage() {
  const { user } = useSupabaseSession();
  const userId = user?.id;
  const meta = useUserMeta();
  const ehProjete = temNumerosDoMes(meta.plano);
  const qc = useQueryClient();

  const opcoes = useMemo(opcoesDeMes, []);
  const [selecionado, setSelecionado] = useState(opcoes[1] ?? opcoes[0]); // mês passado por padrão (já fechado)
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [motivo, setMotivo] = useState<MotivoRaioX | null>(null);
  const [forcarMesAtual, setForcarMesAtual] = useState(false);
  // Avisos da última geração, pra mostrar mesmo antes da coluna ia_raiox.avisos existir.
  const [avisosGerados, setAvisosGerados] = useState<{ mes: string; avisos: string[] } | null>(
    null,
  );
  // Versão aberta na lista "Gerações deste mês"; null = a mais recente.
  const [versaoId, setVersaoId] = useState<string | null>(null);
  // Pedido de geração esperando a confirmação da última do mês.
  const [confirmarUltima, setConfirmarUltima] = useState<{ forcar: boolean } | null>(null);

  const mesLabel = `${selecionado.ano}-${String(selecionado.mes).padStart(2, "0")}`;

  // Todas as gerações salvas do mês (07/10/2026): uma linha por geração desde
  // a migração 20261008200000. Antes dela o mês tem no máximo uma.
  const versoesQuery = useQuery({
    queryKey: ["ia-raiox", userId, mesLabel],
    enabled: !!userId && ehProjete,
    queryFn: async () => {
      // "*" de propósito: a coluna avisos só existe depois da migração
      // 20261008190000, e pedir uma coluna que não existe derruba a leitura.
      const { data, error } = await supabase
        .from("ia_raiox")
        .select("*")
        .eq("user_id", userId!)
        .eq("mes", mesLabel)
        .order("criado_em", { ascending: false })
        .order("id", { ascending: false })
        .limit(20);
      // Falha de leitura não pode virar "nenhum raio-x deste mês".
      if (error) throw error;
      return (data as unknown as RaioXRow[] | null) ?? [];
    },
  });

  // Mesma fonte que o servidor cobra (ia_uso, mês de Brasília).
  const usoQuery = useQuery({
    queryKey: ["uso-raiox", userId],
    enabled: !!userId && ehProjete,
    staleTime: 30_000,
    queryFn: () => usoRaioX(),
  });

  const gerar = async (forcar = false) => {
    setErro(null);
    setMotivo(null);
    setGerando(true);
    try {
      const resultado = await gerarRaioX({
        data: { mes: selecionado.mes, ano: selecionado.ano, forcar },
      });
      if (resultado.ok) {
        setAvisosGerados({ mes: mesLabel, avisos: resultado.avisos });
        setVersaoId(null); // a geração nova vira a versão aberta
        track("raiox_gerado", { mes: mesLabel });
        void registrar("feature_completed", { feature: "raiox", propriedades: { acao: "gerado" } });
        await qc.invalidateQueries({ queryKey: ["ia-raiox", userId, mesLabel] });
      } else {
        setMotivo(resultado.motivo);
      }
    } catch {
      setErro("A Pólia One não conseguiu ler o seu mês agora. Tenta de novo.");
    } finally {
      setGerando(false);
      // Toda tentativa pode ter mudado a contagem (ou estornado a reserva).
      void qc.invalidateQueries({ queryKey: ["uso-raiox", userId] });
    }
  };

  // Só barra depois de saber o plano de verdade — ver `carregando` em useUserMeta.
  if (meta.carregando) {
    return (
      <PaginaLogada eyebrow="Raio-x do mês" titulo="A leitura do seu mês.">
        <div className="h-40 animate-pulse rounded-xl bg-[var(--surface)]" />
      </PaginaLogada>
    );
  }

  if (!ehProjete) {
    return (
      <UpgradeGate
        eyebrow="Raio-x do mês"
        titulo={`O raio-x do mês é do ${tiersPagos()[tierDosNumeros()].titulo}`}
        feature="A Pólia One lê os seus números reais todo mês e devolve o que puxou o resultado e o que fazer diferente."
        rota="/raiox"
        tier={tierDosNumeros()}
      />
    );
  }

  const versoes = ordenarVersoes(versoesQuery.data ?? []);
  const raioX = versaoEscolhida(versoes, versaoId);
  const ehMaisRecente = !!raioX && raioX.id === versoes[0]?.id;
  const avisosDoRaioX =
    raioX && Array.isArray(raioX.avisos)
      ? raioX.avisos
      : ehMaisRecente && avisosGerados?.mes === mesLabel
        ? avisosGerados.avisos
        : [];

  const uso = usoQuery.data;
  const restantes = uso ? restantesRaioX(uso.usado, uso.limite) : null;
  const limiteAtingido = restantes === 0;
  const geracaoTravada = gerando || limiteAtingido || usoQuery.isLoading;
  const mesAtual = new Date();
  const ehMesCorrente =
    selecionado.mes === mesAtual.getMonth() + 1 && selecionado.ano === mesAtual.getFullYear();
  // QA-30: com um raio-x na tela, a recusa (teto, manutenção, plano) era
  // guardada e nunca mostrada. Agora todo motivo vira texto.
  const aviso = erro ?? (motivo ? avisoDoMotivoRaioX(motivo) : null);
  const avisoEhErro = !!erro || motivo === "falha_ia";
  const limiteEscrito = `Até ${LIMITE_RAIOX_MENSAL} gerações de raio-x por mês, somando todos os meses lidos.`;
  // Quantas restam, antes de gerar. Sem a contagem (erro de leitura) cai no
  // texto genérico; o servidor continua barrando no teto de qualquer jeito.
  const textoDoLimite = usoQuery.isLoading
    ? "Conferindo quantas gerações restam neste mês..."
    : uso && restantes != null
      ? restantes > 0
        ? `${textoRestantesRaioX(restantes, uso.periodo, uso.limite)} A contagem soma todos os meses lidos.`
        : textoLimiteAtingidoRaioX(uso.periodo, uso.limite)
      : limiteEscrito;
  const linhaDoLimite = (
    <p
      className={`mt-2 text-[12px] leading-relaxed ${limiteAtingido ? "text-[var(--ink-soft)]" : "text-[var(--muted)]"}`}
      aria-live="polite"
    >
      {textoDoLimite}
    </p>
  );
  const avisoIA = (
    <AvisoConteudoIA texto="O raio-x é gerado por inteligência artificial. Os números vêm dos dados registrados aqui; a leitura é escrita pela IA e pode errar. Vale conferir antes de decidir." />
  );
  // Rótulo de bloco dentro do cartão da leitura: DM Sans 700 em caixa alta.
  const ROTULO =
    "text-[11px] font-accent font-bold uppercase tracking-[0.14em] text-[var(--muted)]";

  // Na última geração do mês, confirma antes de gastar.
  const pedirGeracao = (forcar: boolean) => {
    if (gerando || limiteAtingido) return;
    if (restantes === 1) {
      setConfirmarUltima({ forcar });
      return;
    }
    void gerar(forcar);
  };

  // Faixas que qualificam a leitura (pouco registrado, meta de hoje no lugar
  // do mês). Saíram de cima do placar pra não empurrar a leitura pra baixo.
  const temNotas = !!raioX && (raioX.dado_ralo || avisosDoRaioX.length > 0);
  // Lista de versões só faz sentido com mais de uma.
  const temVersoes = !!raioX && versoes.length > 1;

  /*
   * Layout (ONE-243, 24/11/2026): a tela era `estreita` (640px úteis) e sobrava
   * metade da área vazia. Agora é `larga` em 2 colunas a partir do `lg`:
   * leitura à esquerda (texto travado em 68ch, a trava que justificava a tela
   * estreita) e uma coluna de 300px com mês, "Gerar de novo", notas e versões.
   * No celular vira uma coluna só, na ordem do DOM: mês, leitura, notas,
   * gerar, versões. No desktop a coluna da direita lê mês, gerar, versões e
   * notas; a última linha é 1fr pra leitura alta não abrir buraco entre elas.
   */
  return (
    <PaginaLogada
      dica="raiox"
      eyebrow="Raio-x do mês"
      titulo="A leitura do seu mês."
      subtitulo="A Pólia One lê os números do mês fechado e devolve o que puxou o resultado."
      largura="larga"
    >
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:grid-rows-[auto_auto_auto_1fr] lg:items-start lg:gap-x-8">
        <div className="lg:col-start-2 lg:row-start-1">
          <label htmlFor="raiox-mes" className="block text-[13px] font-medium text-[var(--ink)]">
            Mês do raio-x
          </label>
          <select
            id="raiox-mes"
            value={`${selecionado.mes}-${selecionado.ano}`}
            onChange={(e) => {
              const [mes, ano] = e.target.value.split("-").map(Number);
              const nova = opcoes.find((o) => o.mes === mes && o.ano === ano);
              if (nova) {
                setSelecionado(nova);
                setVersaoId(null);
                setForcarMesAtual(false);
                setMotivo(null);
                setErro(null);
              }
            }}
            className="mt-2 min-h-11 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-[14px] text-[var(--ink)] focus:border-[var(--secondary-text)] focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)] sm:max-w-xs lg:max-w-none"
          >
            {opcoes.map((o) => (
              <option key={`${o.mes}-${o.ano}`} value={`${o.mes}-${o.ano}`}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-0 lg:col-start-1 lg:row-span-4 lg:row-start-1">
          {versoesQuery.isLoading ? (
            <>
              <div className="h-64 animate-pulse rounded-xl bg-[var(--surface)]" />
              {avisoIA}
            </>
          ) : versoesQuery.isError ? (
            <>
              <div className="rounded-xl border border-[var(--line)] bg-white p-6">
                <p role="alert" className="text-[14px] text-[var(--danger)]">
                  A Pólia One não conseguiu abrir os raio-x salvos deste mês. Tenta de novo.
                </p>
                <button
                  type="button"
                  onClick={() => void versoesQuery.refetch()}
                  disabled={versoesQuery.isFetching}
                  className="mt-3 inline-flex min-h-11 items-center text-[13px] font-medium text-[var(--secondary-text)] hover:underline disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {versoesQuery.isFetching ? "Tentando de novo..." : "Tentar de novo"}
                </button>
              </div>
              {avisoIA}
            </>
          ) : raioX ? (
            <article
              aria-label={`Raio-x de ${selecionado.label}`}
              className="rounded-xl border border-[var(--line)] bg-white p-6 md:p-8"
            >
              {!ehMaisRecente && (
                <p className="mb-6 text-[13px] text-[var(--muted)]">
                  Versão gerada em {dataHoraDaGeracao(raioX.criado_em)}. A mais recente é a primeira
                  de "Gerações deste mês".
                </p>
              )}

              <section aria-labelledby="raiox-aconteceu">
                <h2 id="raiox-aconteceu" className={ROTULO}>
                  O que aconteceu
                </h2>
                <p className="mt-2 max-w-[60ch] text-[20px] font-medium leading-snug text-[var(--ink)]">
                  {raioX.placar}
                </p>
              </section>

              <section aria-labelledby="raiox-puxou" className="mt-8">
                <h2 id="raiox-puxou" className={ROTULO}>
                  O que puxou o resultado
                </h2>
                <p className="mt-2 max-w-[68ch] text-[15px] leading-relaxed text-[var(--ink-soft)]">
                  {raioX.causas}
                </p>
              </section>

              {raioX.sugestoes.length > 0 && (
                <section
                  aria-labelledby="raiox-fazer"
                  className="mt-8 border-t border-[var(--line)] pt-6"
                >
                  <h2 id="raiox-fazer" className={ROTULO}>
                    O que fazer
                  </h2>
                  <ul className="mt-3 divide-y divide-[var(--line)]">
                    {raioX.sugestoes.map((s, i) => (
                      <li
                        key={i}
                        className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
                      >
                        <p className="max-w-[68ch] text-[15px] leading-relaxed text-[var(--ink)]">
                          {s.texto}
                        </p>
                        {s.rota && ROTA_LABEL[s.rota] && (
                          <LinkInterno
                            href={`/${s.rota}`}
                            className="inline-flex min-h-11 shrink-0 items-center text-[13px] font-medium text-[var(--secondary-text)] no-underline hover:underline"
                          >
                            {ROTA_LABEL[s.rota]} →
                          </LinkInterno>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <div className="mt-8 border-t border-[var(--line)] pt-1">{avisoIA}</div>
            </article>
          ) : (
            <>
              {motivo === "mes_nao_fechado" ? (
                <Vazio
                  icone={CalendarClock}
                  titulo="O mês ainda está correndo."
                  texto="A Pólia One lê o que tem até aqui, ou dá pra escolher o mês passado, que já fechou."
                  acao={
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setForcarMesAtual(true);
                          pedirGeracao(true);
                        }}
                        disabled={geracaoTravada}
                        className={BTN_ACAO}
                      >
                        {gerando ? "A Pólia One está lendo o seu mês..." : "Ler o que tem até aqui"}
                      </button>
                      {linhaDoLimite}
                    </>
                  }
                />
              ) : motivo === "dado_insuficiente" ? (
                <Vazio
                  icone={Sparkles}
                  titulo="Esse mês tem pouco registrado pra dar leitura."
                  texto="Lance o que entrou e saiu."
                  acao={
                    <Link to="/financeiro" className={BTN_ACAO}>
                      Ir pro Financeiro
                    </Link>
                  }
                />
              ) : motivo === "teto_atingido" ? (
                <Vazio
                  icone={Sparkles}
                  titulo="As gerações de raio-x deste mês acabaram."
                  texto={`${
                    uso
                      ? textoLimiteAtingidoRaioX(uso.periodo, uso.limite)
                      : `${limiteEscrito} Renovam no dia 1º.`
                  } Dá pra reler os raio-x que já saíram escolhendo outro mês.`}
                />
              ) : (
                <Vazio
                  icone={Sparkles}
                  titulo="Nenhum raio-x deste mês ainda."
                  texto="Quando o seu mês tiver receitas e despesas registradas, a Pólia One lê pra você o que aconteceu."
                  acao={
                    <>
                      <button
                        type="button"
                        onClick={() => pedirGeracao(ehMesCorrente)}
                        disabled={geracaoTravada}
                        className={BTN_ACAO}
                      >
                        {gerando ? "A Pólia One está lendo o seu mês..." : "Gerar raio-x"}
                      </button>
                      {linhaDoLimite}
                      {aviso && (
                        <p
                          role="alert"
                          className={`mt-3 text-[13px] ${
                            avisoEhErro ? "text-[var(--danger)]" : "text-[var(--ink-soft)]"
                          }`}
                        >
                          {aviso}
                        </p>
                      )}
                    </>
                  }
                />
              )}
              {avisoIA}
            </>
          )}
        </div>

        {temNotas && raioX && (
          <aside
            aria-labelledby="raiox-notas"
            className="rounded-xl bg-[var(--surface)] px-4 py-3 lg:col-start-2 lg:row-start-4"
          >
            <h2 id="raiox-notas" className="text-[13px] font-semibold text-[var(--ink)]">
              Sobre esta leitura
            </h2>
            <div className="mt-1 space-y-1 text-[13px] leading-relaxed text-[var(--ink-soft)]">
              {raioX.dado_ralo && <p>Esse mês tem pouco registrado, a leitura é limitada.</p>}
              {avisosDoRaioX.map((a) => (
                <p key={a}>{a}</p>
              ))}
            </div>
          </aside>
        )}

        {raioX && (
          <div className="rounded-xl border border-[var(--line)] bg-white p-5 lg:col-start-2 lg:row-start-2">
            {/* Mês corrente com raio-x já na tela: ela já escolheu ler o mês
              aberto. Sem forçar, depois de um F5 o servidor respondia
              "mês não fechado" e o botão parecia não fazer nada. */}
            <button
              type="button"
              onClick={() => pedirGeracao(forcarMesAtual || ehMesCorrente)}
              disabled={geracaoTravada}
              className={`${BTN_ACAO_CONTORNO} min-h-11 w-full`}
            >
              {gerando ? "Gerando de novo..." : "Gerar de novo"}
            </button>
            <p className="mt-3 text-[12px] leading-relaxed text-[var(--ink-soft)]">
              Faz uma leitura nova de {selecionado.label}. Cada leitura usa uma geração.
            </p>
            {linhaDoLimite}
            {aviso && (
              <p
                role="alert"
                className={`mt-2 text-[13px] ${
                  avisoEhErro ? "text-[var(--danger)]" : "text-[var(--ink-soft)]"
                }`}
              >
                {aviso}
              </p>
            )}
          </div>
        )}

        {temVersoes && raioX && (
          <section aria-labelledby="raiox-geracoes" className="lg:col-start-2 lg:row-start-3">
            <h2 id="raiox-geracoes" className="text-[13px] font-semibold text-[var(--ink)]">
              Gerações deste mês
            </h2>
            <ul className="mt-2 space-y-1">
              {versoes.map((v, i) => {
                const aberta = v.id === raioX.id;
                return (
                  <li key={v.id}>
                    <button
                      type="button"
                      onClick={() => setVersaoId(i === 0 ? null : v.id)}
                      aria-current={aberta ? "true" : undefined}
                      className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border px-3 text-left text-[13px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)] ${
                        aberta
                          ? "border-[var(--line)] bg-white text-[var(--ink)]"
                          : "border-transparent text-[var(--ink-soft)] hover:bg-white"
                      }`}
                    >
                      <span>{dataHoraDaGeracao(v.criado_em)}</span>
                      <span className="text-[12px] text-[var(--muted)]">
                        {i === 0 ? "mais recente" : aberta ? "aberta" : "abrir"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>

      <ConfirmarAcao
        open={!!confirmarUltima}
        onOpenChange={(aberto) => {
          if (!aberto) setConfirmarUltima(null);
        }}
        titulo="Gerar o último raio-x do mês?"
        descricao={
          uso
            ? textoUltimaGeracaoRaioX(uso.periodo)
            : "Essa é a última geração do raio-x deste mês."
        }
        textoConfirmar="Gerar raio-x"
        textoCancelar="Agora não"
        onConfirmar={() => {
          const forcar = confirmarUltima?.forcar ?? false;
          setConfirmarUltima(null);
          void gerar(forcar);
        }}
      />
    </PaginaLogada>
  );
}
