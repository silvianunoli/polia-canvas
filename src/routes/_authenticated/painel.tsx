import { useMemo } from "react";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { PainelNav } from "@/components/painel/PainelNav";
import { CosmicSky } from "@/components/painel/CosmicSky";
import { ConstelacaoVisual } from "@/components/painel/ConstelacaoVisual";
import { pluralizeKanban } from "@/lib/kanban";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({
    meta: [
      { title: "Painel · Pólia" },
      {
        name: "description",
        content:
          "Seu painel da Pólia: jornada, tarefas, clientes e o ar do seu negócio agora.",
      },
    ],
  }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
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
  component: PainelPage,
});

// ============= Conteúdo dinâmico =============

const NOMES_ETAPAS: Record<number, { nome: string; subtitulo: string; tempoEstimado: string }> = {
  1: { nome: "Descoberta", subtitulo: "quem você é nesse negócio", tempoEstimado: "uns 12 minutos" },
  2: { nome: "Identidade", subtitulo: "sua voz, sua marca viva", tempoEstimado: "uns 20 minutos" },
  3: { nome: "Modelo", subtitulo: "como seu negócio se sustenta", tempoEstimado: "uns 25 minutos" },
  4: { nome: "Presença", subtitulo: "onde te encontram", tempoEstimado: "uns 30 minutos" },
  5: { nome: "Conteúdo", subtitulo: "o que você diz pro mundo", tempoEstimado: "uns 25 minutos" },
  6: { nome: "Gestão", subtitulo: "o ritmo da rotina", tempoEstimado: "uns 20 minutos" },
  7: { nome: "Suas vendas", subtitulo: "fechar com leveza", tempoEstimado: "uns 25 minutos" },
  8: { nome: "Seus clientes", subtitulo: "quem volta sempre", tempoEstimado: "uns 20 minutos" },
  9: { nome: "Sua audiência", subtitulo: "gente que escuta", tempoEstimado: "uns 25 minutos" },
  10: { nome: "Seu futuro", subtitulo: "pra onde isso cresce", tempoEstimado: "uns 30 minutos" },
  11: { nome: "Conexões", subtitulo: "rede que sustenta", tempoEstimado: "uns 20 minutos" },
};

const HEADLINES = [
  "Mais um dia construindo\no que é seu.",
  "Cada vez que você volta,\navança um pouco mais.",
  "Você está no lugar certo.\nVamos continuar?",
  "Seu negócio tá crescendo.\nDá pra ver.",
];

const RECADOS_POR_ETAPA: Record<number, string> = {
  1: "Antes de definir voz, lista 3 marcas que você admira e escreve o que sente lendo cada uma.\n\nNão precisa ser perfeito. Precisa ser seu.",
  2: "Sua identidade não nasce de um logo. Nasce do que você sente quando fala do seu negócio.\n\nEscreve 3 palavras agora, sem pensar muito.",
  3: "Modelo de negócio não é planilha. É clareza de como o dinheiro entra e sai.\n\nComeça pelo que você já cobra hoje.",
  4: "Presença não é estar em todo lugar. É estar bem onde sua cliente já te procura.\n\nUm canal de cada vez.",
  5: "Conteúdo bom vem de história real. A sua basta.\n\nNão tenta soar como outra pessoa.",
};

function getHeadlineSaudacao() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "Bom dia";
  if (h >= 12 && h < 18) return "Boa tarde";
  return "Boa noite";
}

function getHeadlineFrase(seed: number) {
  return HEADLINES[seed % HEADLINES.length];
}

function startOfWeek(d: Date) {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const s = new Date(d);
  s.setDate(d.getDate() + diff);
  s.setHours(0, 0, 0, 0);
  return s;
}

// ============= Página =============

function PainelPage() {
  const { user } = useSupabaseSession();
  const userId = user?.id;
  const navigate = useNavigate();

  const userQuery = useQuery({
    queryKey: ["painel-dados", userId],
    enabled: !!userId,
    queryFn: async () => {
      const [profileRes, progressRes, userProfileRes, tarefasRes, entregaveisRes, conquistasRes] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("full_name, business_name, created_at, onboarding_completed")
            .eq("id", userId!)
            .maybeSingle(),
          supabase
            .from("user_progress")
            .select("etapa_atual")
            .eq("user_id", userId!)
            .maybeSingle(),
          supabase
            .from("user_profile")
            .select("segmento, nome_negocio")
            .eq("user_id", userId!)
            .maybeSingle(),
          supabase
            .from("tarefas")
            .select("id, titulo, status, created_at, etapa")
            .eq("user_id", userId!)
            .order("created_at", { ascending: false }),
          supabase
            .from("entregaveis")
            .select("id, titulo, fase, etapa, tipo, conteudo, created_at")
            .eq("user_id", userId!)
            .eq("status", "concluido")
            .order("created_at", { ascending: false })
            .limit(3),
          supabase
            .from("conquistas")
            .select("id, titulo, descricao, xp, created_at")
            .eq("user_id", userId!)
            .order("created_at", { ascending: false })
            .limit(1),
        ]);
      return {
        profile: profileRes.data,
        progress: progressRes.data,
        userProfile: userProfileRes.data,
        tarefas: tarefasRes.data ?? [],
        entregaveis: entregaveisRes.data ?? [],
        conquistas: conquistasRes.data ?? [],
      };
    },
  });

  const dados = userQuery.data;

  const displayName = useMemo(() => {
    const full = dados?.profile?.full_name ?? user?.user_metadata?.full_name ?? "";
    const first = full.trim().split(" ")[0];
    return first || "boas-vindas";
  }, [dados?.profile?.full_name, user?.user_metadata?.full_name]);

  const initial = displayName.charAt(0).toUpperCase() || "P";
  const etapaAtual = dados?.progress?.etapa_atual ?? 1;
  const etapaInfo = NOMES_ETAPAS[etapaAtual] ?? NOMES_ETAPAS[1];
  const businessType = dados?.userProfile?.segmento ?? "hibrido";
  const streak = 0; // placeholder até existir cálculo
  const diasDesdeCadastro = useMemo(() => {
    const c = dados?.profile?.created_at;
    if (!c) return 1;
    const diff = Date.now() - new Date(c).getTime();
    return Math.max(1, Math.floor(diff / 86400000));
  }, [dados?.profile?.created_at]);

  const headline = useMemo(() => {
    const seed = Math.floor(Date.now() / (1000 * 60 * 30));
    return getHeadlineFrase(seed);
  }, []);

  const tarefas = dados?.tarefas ?? [];
  const tarefasAFazer = tarefas.filter((t) => t.status === "a_fazer");
  const tarefasBrotando = tarefas.filter((t) => t.status === "brotando");
  const tarefasFloresceram = tarefas.filter((t) => t.status === "floresceu");

  // Próxima tarefa
  const proximaTarefa = tarefasAFazer[0] ?? tarefasBrotando[0];
  const tituloProxima =
    proximaTarefa?.titulo ?? `Começar ${etapaInfo.nome.toLowerCase()}`;

  // Semana
  const dias = useMemo(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const ini = startOfWeek(hoje);
    const abrevs = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(ini);
      d.setDate(ini.getDate() + i);
      const count = tarefas.filter((t) => {
        if (t.status !== "floresceu") return false;
        const td = new Date(t.created_at);
        return (
          td.getFullYear() === d.getFullYear() &&
          td.getMonth() === d.getMonth() &&
          td.getDate() === d.getDate()
        );
      }).length;
      return {
        abrev: abrevs[i],
        numero: d.getDate(),
        tarefas: count,
        isHoje: d.getTime() === hoje.getTime(),
      };
    });
  }, [tarefas]);

  const totalSemana = dias.reduce((acc, d) => acc + d.tarefas, 0);

  const recadoEtapa =
    RECADOS_POR_ETAPA[etapaAtual] ??
    "Continue de onde parou. Cada passo que você dá fica no seu céu.\n\nA Pólia tá aqui.";

  const conquistaUltima = dados?.conquistas?.[0];
  const seteDiasAtras = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const conquistaAtual =
    conquistaUltima && new Date(conquistaUltima.created_at).getTime() >= seteDiasAtras
      ? conquistaUltima
      : null;
  const conquistaAnterior = conquistaAtual ? null : conquistaUltima ?? null;

  const subtituloNegocio =
    businessType === "produto"
      ? "você vende produto, então aqui mostra o que importa pra produção."
      : businessType === "servico"
        ? "você vende serviço, então aqui mostra agenda e clientes."
        : "você vende produto e serviço, então aqui mostra os dois.";

  return (
    <div className="min-h-screen bg-polia-creme">
      <PainelNav initial={initial} streak={streak} />

      {/* SEÇÃO 1 — SAUDAÇÃO */}
      <section className="bg-polia-creme px-6 pb-10 pt-12 md:px-12">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="flex-1">
            <p className="mb-2 font-handwritten text-[24px] text-polia-terracota" suppressHydrationWarning>
              {getHeadlineSaudacao()}, {displayName}.
            </p>

            <h1 className="max-w-[640px] whitespace-pre-line font-serif text-[40px] leading-[1.1] text-polia-noite md:text-[60px]">
              {headline}
            </h1>

            {/* Stats */}
            <div className="mt-8 flex flex-col gap-6 md:flex-row md:items-start md:gap-10">
              <StatBlock
                label="DIA NA JORNADA"
                valueClass="font-serif text-[28px] text-polia-terracota"
                value={String(diasDesdeCadastro)}
                sub="de uma vida nova"
              />
              <Divider />
              <StatBlock
                label="PRÓXIMA ESTRELA"
                valueClass="font-sans text-[16px] font-semibold text-polia-noite"
                value={`${etapaInfo.nome} · ${etapaInfo.subtitulo}`}
                sub={`${etapaInfo.tempoEstimado} pro brilhar`}
                subColor="text-polia-musgo"
              />
              <Divider />
              <StatBlock
                label="HOJE"
                valueClass="font-sans text-[16px] font-semibold text-polia-noite"
                value={
                  tarefasAFazer.length + tarefasBrotando.length + tarefasFloresceram.length === 0
                    ? "nada brotando ainda"
                    : pluralizeKanban({
                        a_fazer: tarefasAFazer.length,
                        brotando: tarefasBrotando.length,
                        floresceu: tarefasFloresceram.length,
                      })
                }
                sub="seu fluxo da semana"
              />
            </div>
          </div>

          {/* Raposa + balão */}
          <div className="hidden flex-col items-end gap-3 md:flex">
            <div
              className="rounded-xl border bg-white px-4 py-3 shadow-sm"
              style={{
                borderColor: "rgba(26,26,46,0.06)",
                maxWidth: 180,
              }}
            >
              <p className="font-handwritten text-[15px] leading-snug text-polia-noite">
                aí continua de onde parou ontem?
              </p>
            </div>
            <div
              className="flex h-[200px] w-[180px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-polia-terracota"
              style={{ background: "rgba(201,107,62,0.04)" }}
            >
              <span className="font-accent text-[10px] font-bold tracking-[1px] text-polia-terracota">
                RAPOSA
              </span>
              <span className="font-sans text-[9px] text-polia-terracota opacity-70">
                ESTADO FELIZ
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* SEÇÃO 2 — CTA */}
      <section className="w-full bg-polia-terracota">
        <div className="mx-auto flex max-w-[1280px] flex-col items-start justify-between gap-6 px-6 py-8 md:flex-row md:items-center md:px-12">
          <div>
            <p className="mb-1 font-handwritten text-[18px] text-polia-creme/70">
              Sua próxima estrela...
            </p>
            <h2 className="mb-2 font-serif text-[28px] leading-tight text-polia-creme md:text-[32px]">
              {tituloProxima}
            </h2>
            <p className="font-sans text-[14px] text-polia-creme/75">
              {etapaInfo.nome} · {etapaInfo.subtitulo} · você vai gastar {etapaInfo.tempoEstimado}
            </p>
          </div>
          <div className="flex w-full flex-col items-stretch gap-2 md:w-auto md:items-end">
            <a
              href="/jornada"
              className="whitespace-nowrap rounded-xl bg-polia-creme px-8 py-3 text-center font-sans text-[16px] font-semibold text-polia-terracota transition-colors hover:bg-white"
            >
              Continuar →
            </a>
            <span className="text-center font-handwritten text-[14px] text-polia-creme/60 md:text-right">
              ou começar agora
            </span>
          </div>
        </div>
      </section>

      {/* SEÇÃO 3 + 4 — CONSTELAÇÃO (Mundo 1) */}
      <section className="relative bg-polia-noite px-6 py-16 md:px-12">
        <CosmicSky density={22} />
        <div className="relative mx-auto max-w-[1280px]">
          <p className="mb-3 font-accent text-[11px] font-bold uppercase tracking-[2px] text-polia-terracota">
            SUA CONSTELAÇÃO EM FORMAÇÃO
          </p>
          <div className="mb-2 flex flex-col items-start justify-between gap-3 md:flex-row md:items-end">
            <h2 className="font-serif text-[28px] text-polia-creme md:text-[36px]">
              Cada etapa acende uma estrela
            </h2>
            <a
              href="/jornada"
              className="font-sans text-[14px] text-polia-terracota hover:underline"
            >
              Ver constelação completa →
            </a>
          </div>
          <p className="mb-10 font-sans text-[15px] text-polia-creme/80">
            Seu céu continua crescendo com você. As ferramentas que você ganha ficam pra sempre.
          </p>

          <ConstelacaoVisual
            etapaAtual={etapaAtual}
            onStarClick={(etapa, state) => {
              if (state === "current") {
                navigate({ to: `/etapa/${etapa}` as "/etapa/1" });
              } else {
                navigate({ to: "/jornada" });
              }
            }}
          />

          {/* FERRAMENTAS QUE ENTRAM NA ÓRBITA */}
          <div className="mt-12">
            <p className="mb-3 font-accent text-[11px] uppercase tracking-[2px] text-polia-creme/80">
              FERRAMENTAS QUE ENTRAM NA ÓRBITA
            </p>
            <p className="mb-8 font-sans text-[14px] text-polia-creme/60">
              Toda fase que você completa, uma ferramenta fica grande no seu céu pra sempre.
            </p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              <OrbitCard
                title="Sua marca viva"
                tags="identidade, voz, manifesto"
                unlocked={etapaAtual > 3}
                sub={
                  etapaAtual > 3
                    ? "desbloqueada ao completar Sonho"
                    : "desbloqueie ao completar Sonho"
                }
              />
              <OrbitCard
                title="Sua vitrine"
                tags="site, redes, estoque"
                unlocked={etapaAtual > 6}
                sub="desbloqueie ao completar Construção"
              />
              <OrbitCard
                title="Suas vendas e clientes"
                tags="controle, agenda, histórico"
                unlocked={etapaAtual > 9}
                sub="desbloqueie ao completar Venda"
              />
              <OrbitCard
                title="Seu painel financeiro"
                tags="controle, metas, sonhos"
                unlocked={etapaAtual > 11}
                sub="desbloqueie ao completar Evolução"
              />
            </div>
          </div>
        </div>
      </section>

      {/* SEÇÃO 5 — HOJE NO SEU NEGÓCIO */}
      <section className="bg-polia-creme px-6 py-16 md:px-12">
        <div className="mx-auto max-w-[1280px]">
          <p className="mb-2 font-accent text-[11px] uppercase tracking-[2px] text-polia-noite opacity-50">
            HOJE NO SEU NEGÓCIO
          </p>
          <h2 className="mb-1 font-serif text-[28px] text-polia-noite md:text-[36px]">
            O ar do seu negócio agora
          </h2>
          <p className="mb-8 font-handwritten text-[16px] text-polia-terracota">
            {subtituloNegocio}
          </p>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <CardReceita />
            <CardPedidos />
            <CardAgenda />
            <CardClientes />
          </div>
        </div>
      </section>

      {/* SEÇÃO 6 — SEMANA DE COLHEITA */}
      <section className="bg-polia-creme px-6 py-12 md:px-12">
        <div className="mx-auto max-w-[1280px]">
          <p className="mb-2 font-accent text-[11px] uppercase tracking-[2px] opacity-50">
            ESSA SEMANA
          </p>
          <h2 className="mb-8 font-serif text-[28px] text-polia-noite md:text-[32px]">
            Sua semana de colheita
          </h2>
          <div className="flex flex-col items-start gap-6 md:flex-row md:items-end md:justify-between">
            <div className="grid w-full grid-cols-7 gap-1.5 sm:gap-3 md:flex-1">
              {dias.map((d, i) => (
                <div
                  key={i}
                  className={`flex min-w-0 flex-col items-center gap-1 rounded-xl px-1.5 py-3 sm:p-4 ${
                    d.isHoje ? "bg-polia-terracota" : "border border-[rgba(26,26,46,0.06)] bg-white"
                  }`}
                >
                  <span
                    className={`font-sans text-[12px] font-medium ${
                      d.isHoje ? "text-polia-creme/80" : "text-polia-noite opacity-50"
                    }`}
                  >
                    {d.abrev}
                  </span>
                  <span
                    className={`font-serif text-[22px] sm:text-[28px] ${
                      d.isHoje ? "text-polia-creme" : "text-polia-noite"
                    }`}
                  >
                    {d.numero}
                  </span>
                  <span
                    className={`font-sans text-[16px] font-semibold sm:text-[18px] ${
                      d.isHoje ? "text-polia-creme" : "text-polia-noite"
                    }`}
                  >
                    {d.tarefas}
                  </span>
                  <span
                    className={`text-center font-handwritten text-[14px] leading-none ${
                      d.isHoje ? "text-polia-creme/70" : "text-polia-noite opacity-40"
                    }`}
                  >
                    {d.isHoje ? "hoje plantei" : "sementes"}
                  </span>
                </div>
              ))}
            </div>
            <div className="text-right md:ml-6">
              <p className="mb-1 font-accent text-[10px] uppercase tracking-[1px] opacity-50">
                ESSA SEMANA
              </p>
              <p className="font-serif text-[48px] leading-none text-polia-terracota">
                {totalSemana}
              </p>
              <p className="mb-1 font-sans text-[14px] text-polia-noite opacity-60">
                sementes plantadas
              </p>
              <p className="font-handwritten text-[14px] text-polia-noite opacity-40">
                recorde anterior: {Math.max(totalSemana, 0)}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SEÇÃO 7 — TRÊS CARDS DO DIA */}
      <section className="bg-polia-creme px-6 py-12 md:px-12">
        <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Card 1 — Recado */}
          <div
            className="rounded-2xl p-6"
            style={{
              background: "rgba(201,107,62,0.06)",
              border: "1px solid rgba(201,107,62,0.15)",
            }}
          >
            <p className="mb-4 font-accent text-[10px] uppercase tracking-[1.5px] text-polia-terracota">
              UM RECADO PRA VOCÊ
            </p>
            <p className="whitespace-pre-line font-handwritten text-[18px] leading-relaxed text-polia-noite">
              {recadoEtapa}
            </p>
            <p className="mt-4 font-handwritten text-[16px] text-polia-terracota">- Pólia</p>
          </div>

          {/* Card 2 — Fluxo de hoje */}
          <div
            className="rounded-2xl bg-white p-6"
            style={{ border: "1px solid rgba(26,26,46,0.06)" }}
          >
            <p className="mb-2 font-accent text-[10px] uppercase tracking-[1.5px] opacity-50">
              SUAS TAREFAS
            </p>
            <h3 className="mb-4 font-sans text-[18px] font-semibold text-polia-noite">
              Seu fluxo de hoje
            </h3>
            <div className="grid grid-cols-3 gap-3">
              {[
                { col: "A fazer", items: tarefasAFazer },
                { col: "Brotando", items: tarefasBrotando },
                { col: "Floresceram", items: tarefasFloresceram },
              ].map((c) => (
                <div key={c.col}>
                  <p className="mb-2 font-sans text-[11px] font-semibold text-polia-noite opacity-50">
                    {c.col}
                  </p>
                  {c.items.length === 0 ? (
                    <p className="font-handwritten text-[14px] text-polia-noite opacity-30">
                      vazio
                    </p>
                  ) : (
                    c.items.slice(0, 3).map((t) => (
                      <div
                        key={t.id}
                        className="mb-1.5 rounded-lg bg-polia-cinza-claro px-2 py-1.5"
                      >
                        <p className="truncate font-sans text-[12px] leading-tight text-polia-noite">
                          {t.titulo}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              ))}
            </div>
            <a
              href="/tarefas"
              className="mt-4 inline-block font-sans text-[13px] text-polia-terracota hover:underline"
            >
              Tarefas →
            </a>
          </div>

          {/* Card 3 — Conquista */}
          <div
            className="rounded-2xl bg-white p-6"
            style={{ border: "1px solid rgba(200,169,110,0.2)" }}
          >
            <p className="mb-4 font-accent text-[10px] uppercase tracking-[1.5px] text-polia-dourado">
              CONQUISTA DA SEMANA
            </p>
            {conquistaAtual ? (
              <>
                <div
                  className="mb-4 flex h-12 w-12 items-center justify-center rounded-full"
                  style={{ background: "rgba(200,169,110,0.15)" }}
                >
                  <Star className="text-polia-dourado" size={24} fill="currentColor" />
                </div>
                <p className="mb-1 font-sans text-[18px] font-semibold text-polia-noite">
                  {conquistaAtual.titulo}
                </p>
                <p className="mb-3 font-sans text-[14px] font-semibold text-polia-musgo">
                  +{conquistaAtual.xp} XP
                </p>
                <p className="font-handwritten text-[16px] leading-snug text-polia-noite opacity-70">
                  {conquistaAtual.descricao ?? "Você plantou algo que vai dar fruto."}
                </p>
              </>
            ) : conquistaAnterior ? (
              <>
                <p className="mb-2 font-handwritten text-[14px] text-polia-dourado">
                  última conquista
                </p>
                <p className="mb-1 font-sans text-[18px] font-semibold text-polia-noite opacity-80">
                  {conquistaAnterior.titulo}
                </p>
                <p className="font-handwritten text-[16px] leading-snug text-polia-noite opacity-60">
                  {conquistaAnterior.descricao ?? "Guardada no seu céu."}
                </p>
              </>
            ) : (
              <p className="font-handwritten text-[16px] text-polia-dourado">
                sua primeira conquista mora aqui · acende uma estrela pra começar.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* SEÇÃO 8 — BIBLIOTECA */}
      <section className="bg-polia-creme px-6 py-12 md:px-12">
        <div className="mx-auto max-w-[1280px]">
          <h2 className="mb-2 font-serif text-[28px] text-polia-noite md:text-[32px]">
            Sua biblioteca de marcos
          </h2>
          <p className="mb-8 font-handwritten text-[16px] text-polia-terracota">
            Toda vez que você completa uma etapa, fica aqui. Não se perde.
          </p>

          {dados?.entregaveis && dados.entregaveis.length > 0 ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {dados.entregaveis.map((e) => (
                <EntregavelCard
                  key={e.id}
                  fase={e.fase}
                  titulo={e.titulo}
                  preview={extractPreview(e.conteudo)}
                  etapa={`Etapa ${e.etapa}`}
                  tempo={tempoRelativo(e.created_at)}
                  id={e.id}
                />
              ))}
            </div>
          ) : (
            <div
              className="rounded-2xl bg-white py-16 text-center"
              style={{ border: "1px solid rgba(26,26,46,0.06)" }}
            >
              <p className="font-handwritten text-[20px] text-polia-noite opacity-40">
                sua primeira conquista aparece aqui quando você completar a Etapa 1.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* SEÇÃO 9 — ESTRELAS QUE TE ESPERAM */}
      <section className="bg-polia-cinza-claro px-6 py-12 md:px-12">
        <div className="mx-auto max-w-[1280px]">
          <h2 className="mb-1 font-serif text-[24px] text-polia-noite md:text-[28px]">
            Estrelas que te esperam
          </h2>
          <p className="mb-8 font-sans text-[14px] text-polia-noite opacity-50">
            Os marcos do seu negócio que você vai chegar.
          </p>
          <div className="flex flex-wrap gap-4">
            {[
              "primeira contratação",
              "100 clientes ativas",
              "1 ano de negócio",
              "primeira filial",
            ].map((m) => (
              <div
                key={m}
                className="flex items-center gap-3 rounded-2xl bg-white px-6 py-4"
                style={{ border: "1px solid rgba(26,26,46,0.06)" }}
              >
                <div
                  className="h-2 w-2 rounded-full"
                  style={{ background: "#D8D2CC" }}
                />
                <span className="font-sans text-[15px] text-polia-noite">{m}</span>
              </div>
            ))}
          </div>
          <p className="mt-6 text-right font-handwritten text-[14px] text-polia-noite opacity-40">
            A Pólia torce. Você adiciona a dela no seu.
          </p>
        </div>
      </section>

      {/* SEÇÃO 10 — FOOTER MANTRA */}
      <section className="relative overflow-hidden bg-polia-noite py-16 text-center">
        <CosmicSky density={14} />
        <div className="relative">
          <div className="mb-8 flex justify-center gap-6 opacity-40">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-2 w-2 bg-polia-dourado"
                style={{ transform: "rotate(45deg)" }}
              />
            ))}
          </div>
          <p className="mb-4 font-serif text-[28px] text-polia-creme md:text-[36px]">
            A Pólia não acaba. Ela só fica mais sua.
          </p>
          <p className="font-handwritten text-[18px] text-polia-terracota opacity-80 md:text-[20px]">
            cada vez que você volta, encontra mais de você aqui
          </p>
        </div>
      </section>
    </div>
  );
}

// ============= Subcomponentes =============

function StatBlock({
  label,
  value,
  valueClass,
  sub,
  subColor,
}: {
  label: string;
  value: string;
  valueClass: string;
  sub: string;
  subColor?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-accent text-[10px] uppercase tracking-[1px] text-polia-noite opacity-50">
        {label}
      </span>
      <span className={valueClass}>{value}</span>
      <span
        className={`font-handwritten text-[14px] ${subColor ?? "text-polia-noite opacity-60"}`}
      >
        {sub}
      </span>
    </div>
  );
}

function Divider() {
  return (
    <div
      className="hidden h-12 w-px md:block"
      style={{ background: "rgba(26,26,46,0.1)" }}
    />
  );
}

function OrbitCard({
  title,
  tags,
  unlocked,
  sub,
}: {
  title: string;
  tags: string;
  unlocked: boolean;
  sub: string;
}) {
  return (
    <div
      className={`rounded-2xl p-6 ${unlocked ? "" : "opacity-40"}`}
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div className="mb-4 flex items-center gap-2">
        <div
          className={`relative h-8 w-8 rounded-full border-2 ${
            unlocked ? "border-polia-dourado" : "border-polia-creme/30"
          }`}
        >
          {unlocked && (
            <div
              className="absolute h-2 w-2 rounded-full bg-polia-dourado"
              style={{ top: -2, left: "50%", transform: "translateX(-50%)" }}
            />
          )}
        </div>
        {unlocked && (
          <span
            className="rounded-full px-2 py-0.5 font-sans text-[11px]"
            style={{
              background: "rgba(44,106,79,0.3)",
              color: "#5FBE8B",
            }}
          >
            1/1 ativa
          </span>
        )}
      </div>
      <p className="mb-1 font-sans text-[16px] font-semibold text-polia-creme">
        {title}
      </p>
      <p className="mb-3 font-sans text-[12px] text-polia-creme opacity-60">
        {tags}
      </p>
      <p
        className={`font-handwritten text-[14px] ${
          unlocked ? "text-polia-terracota" : "text-polia-creme opacity-50"
        }`}
      >
        {sub}
      </p>
    </div>
  );
}

function CardReceita() {
  return (
    <div
      className="rounded-2xl bg-white p-6 shadow-sm"
      style={{ border: "1px solid rgba(26,26,46,0.06)" }}
    >
      <p className="mb-4 font-accent text-[10px] uppercase tracking-[1.5px] opacity-50">
        RECEITA · MÊS
      </p>
      <p className="mb-1 font-serif text-[40px] leading-none text-polia-noite">
        R$ 0
      </p>
      <p className="mb-4 font-sans text-[13px] text-polia-noite opacity-50">
        ainda não tem dados aqui
      </p>
      <p className="font-handwritten text-[14px] text-polia-noite opacity-60">
        à medida que você avança, vai aparecendo
      </p>
    </div>
  );
}

function CardPedidos() {
  return (
    <div
      className="rounded-2xl bg-white p-6 shadow-sm"
      style={{ border: "1px solid rgba(26,26,46,0.06)" }}
    >
      <p className="mb-4 font-accent text-[10px] uppercase tracking-[1.5px] opacity-50">
        PEDIDOS · PRODUTOS
      </p>
      <p className="mb-4 font-serif text-[28px] text-polia-noite">nenhum pedido ainda</p>
      <p className="font-handwritten text-[14px] text-polia-noite opacity-60">
        quando seus pedidos começarem, eles aparecem aqui.
      </p>
    </div>
  );
}

function CardAgenda() {
  return (
    <div
      className="rounded-2xl bg-white p-6 shadow-sm"
      style={{ border: "1px solid rgba(26,26,46,0.06)" }}
    >
      <div className="mb-4 flex items-center justify-between">
        <p className="font-accent text-[10px] uppercase tracking-[1.5px] opacity-50">
          SUA AGENDA · GOOGLE CALENDAR
        </p>
        <span className="font-sans text-[11px] text-polia-noite opacity-50">
          não conectado
        </span>
      </div>
      <p className="py-8 text-center font-handwritten text-[14px] text-polia-noite opacity-50">
        conecta seu Google Calendar aqui pra ver tudo em um lugar
      </p>
    </div>
  );
}

function CardClientes() {
  return (
    <div
      className="rounded-2xl bg-white p-6 shadow-sm"
      style={{ border: "1px solid rgba(26,26,46,0.06)" }}
    >
      <p className="mb-4 font-accent text-[10px] uppercase tracking-[1.5px] opacity-50">
        CLIENTES
      </p>
      <p className="mb-1 font-serif text-[40px] leading-none text-polia-noite">0</p>
      <p className="mb-6 font-sans text-[13px] text-polia-noite opacity-50">
        ativas esse mês
      </p>
      <p className="font-handwritten text-[14px] text-polia-noite opacity-60">
        à medida que você cadastrar, a casa começa a se preencher.
      </p>
    </div>
  );
}

const BADGE_FASE: Record<string, string> = {
  Sonho: "bg-[rgba(201,64,122,0.1)] text-[#C9407A]",
  Construção: "bg-[rgba(26,127,173,0.1)] text-[#1A7FAD]",
  Venda: "bg-[rgba(26,143,92,0.1)] text-[#1A8F5C]",
  Evolução: "bg-[rgba(107,80,204,0.1)] text-[#6B50CC]",
};

function EntregavelCard({
  fase,
  titulo,
  preview,
  etapa,
  tempo,
  id,
}: {
  fase: string;
  titulo: string;
  preview: string;
  etapa: string;
  tempo: string;
  id: string;
}) {
  return (
    <div
      className="rounded-2xl bg-white p-6 shadow-sm"
      style={{ border: "1px solid rgba(26,26,46,0.06)" }}
    >
      <span
        className={`mb-4 inline-block rounded-full px-3 py-1 font-accent text-[10px] font-bold uppercase tracking-[1.5px] ${
          BADGE_FASE[fase] ?? BADGE_FASE.Sonho
        }`}
      >
        {fase}
      </span>
      <p className="mb-4 line-clamp-3 font-sans text-[14px] leading-relaxed text-polia-noite opacity-70">
        {preview}
      </p>
      <div className="flex items-end justify-between">
        <div>
          <p className="font-sans text-[14px] font-semibold text-polia-noite">{titulo}</p>
          <p className="font-sans text-[12px] text-polia-noite opacity-40">
            {etapa} · há {tempo}
          </p>
        </div>
        <a
          href={`/biblioteca/${id}`}
          className="font-sans text-[13px] text-polia-terracota hover:underline"
        >
          abrir →
        </a>
      </div>
    </div>
  );
}

function tempoRelativo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const dias = Math.floor(diff / 86400000);
  if (dias === 0) return "hoje";
  if (dias === 1) return "1 dia";
  if (dias < 30) return `${dias} dias`;
  const meses = Math.floor(dias / 30);
  return meses === 1 ? "1 mês" : `${meses} meses`;
}

/**
 * Extrai um preview legível de qualquer payload de entregavel
 * (string, objeto com declaracao/texto/conteudo/resumo, ou JSON arbitrário).
 */
function extractPreview(payload: unknown): string {
  if (payload == null) return "";
  if (typeof payload === "string") return payload;
  if (typeof payload !== "object") return String(payload);
  const obj = payload as Record<string, unknown>;
  const preferKeys = [
    "declaracao",
    "resumo",
    "texto",
    "descricao",
    "conteudo",
    "title",
    "titulo",
    "summary",
  ];
  for (const k of preferKeys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v;
  }
  // pega primeiro valor string que encontrar
  for (const v of Object.values(obj)) {
    if (typeof v === "string" && v.trim()) return v;
  }
  return "";
}
