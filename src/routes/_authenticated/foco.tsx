import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { PainelNav } from "@/components/painel/PainelNav";
import { GuiaInsight } from "@/components/painel/GuiaInsight";
import { Play, Pause, Square, RotateCcw, Settings2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/foco")({
  head: () => ({
    meta: [
      { title: "Foco · Pólia" },
      { name: "description", content: "Um tempo só seu pra avançar o que importa no seu negócio." },
    ],
  }),
  component: FocoPage,
});

type Tipo = "pomodoro" | "bloco" | "livre";

interface Config {
  focoMin: number;
  pausaMin: number;
  blocoMin: number;
}

const CFG_KEY = "polia_foco_cfg";
const DEFAULT_CFG: Config = { focoMin: 25, pausaMin: 5, blocoMin: 50 };

const TIPOS: { v: Tipo; label: string; sub: string }[] = [
  { v: "pomodoro", label: "Pomodoro", sub: "foco e pausa em ciclos" },
  { v: "bloco", label: "Bloco", sub: "um período longo de uma vez" },
  { v: "livre", label: "Livre", sub: "cronômetro, sem tempo fixo" },
];

function lerConfig(): Config {
  if (typeof window === "undefined") return DEFAULT_CFG;
  try {
    const raw = window.localStorage.getItem(CFG_KEY);
    if (!raw) return DEFAULT_CFG;
    const p = JSON.parse(raw) as Partial<Config>;
    return {
      focoMin: Math.min(90, Math.max(5, p.focoMin ?? 25)),
      pausaMin: Math.min(30, Math.max(1, p.pausaMin ?? 5)),
      blocoMin: Math.min(180, Math.max(20, p.blocoMin ?? 50)),
    };
  } catch {
    return DEFAULT_CFG;
  }
}

function fmt(seg: number): string {
  const s = Math.max(0, Math.floor(seg));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

function inicioDoDiaISO(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

interface MetaOpcao {
  id: string;
  titulo: string;
}

function FocoPage() {
  const { user } = useSupabaseSession();
  const userId = user?.id;
  const qc = useQueryClient();

  const [config, setConfig] = useState<Config>(DEFAULT_CFG);
  const [configAberta, setConfigAberta] = useState(false);
  const [tipo, setTipo] = useState<Tipo>("pomodoro");
  const [fase, setFase] = useState<"foco" | "pausa">("foco");
  const [rodando, setRodando] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [rotulo, setRotulo] = useState("");
  const [metaId, setMetaId] = useState<string>("");
  const inicioRef = useRef<number>(0);
  const baseRef = useRef<number>(0);

  useEffect(() => {
    setConfig(lerConfig());
  }, []);

  const totalSegundos = (): number => {
    if (tipo === "livre") return Infinity;
    if (tipo === "bloco") return config.blocoMin * 60;
    return (fase === "foco" ? config.focoMin : config.pausaMin) * 60;
  };

  const metasQuery = useQuery({
    queryKey: ["metas-ativas-foco", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("metas")
        .select("id, titulo")
        .eq("user_id", userId!)
        .eq("status", "ativa")
        .order("created_at", { ascending: false });
      return (data ?? []) as MetaOpcao[];
    },
  });

  const hojeQuery = useQuery({
    queryKey: ["foco-hoje", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("foco_sessoes")
        .select("duracao_min")
        .eq("user_id", userId!)
        .eq("tipo", "foco")
        .gte("created_at", inicioDoDiaISO());
      const sessoes = data ?? [];
      return {
        count: sessoes.length,
        minutos: sessoes.reduce((a, s) => a + (s.duracao_min ?? 0), 0),
      };
    },
  });

  const registrarSessao = async (min: number, modo: Tipo) => {
    if (!userId || min < 1) return;
    await supabase.from("foco_sessoes").insert({
      user_id: userId,
      duracao_min: min,
      tipo: "foco",
      modo,
      rotulo: rotulo.trim() || null,
      meta_id: metaId || null,
      concluida: true,
    });
    qc.invalidateQueries({ queryKey: ["foco-hoje", userId] });
  };

  const completar = () => {
    setRodando(false);
    baseRef.current = 0;
    setElapsed(0);
    if (tipo === "pomodoro") {
      if (fase === "foco") {
        void registrarSessao(config.focoMin, "pomodoro");
        setFase("pausa");
      } else {
        setFase("foco");
      }
    } else if (tipo === "bloco") {
      void registrarSessao(config.blocoMin, "bloco");
    }
  };

  useEffect(() => {
    if (!rodando) return;
    const id = window.setInterval(() => {
      const e = baseRef.current + (Date.now() - inicioRef.current) / 1000;
      setElapsed(e);
      const total = totalSegundos();
      if (total !== Infinity && e >= total) {
        window.clearInterval(id);
        completar();
      }
    }, 250);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rodando, tipo, fase, config]);

  const iniciar = () => {
    inicioRef.current = Date.now();
    setRodando(true);
  };
  const pausar = () => {
    baseRef.current += (Date.now() - inicioRef.current) / 1000;
    setElapsed(baseRef.current);
    setRodando(false);
  };
  const resetar = () => {
    setRodando(false);
    baseRef.current = 0;
    setElapsed(0);
  };
  const pararLivre = () => {
    const total = baseRef.current + (rodando ? (Date.now() - inicioRef.current) / 1000 : 0);
    void registrarSessao(Math.round(total / 60), "livre");
    resetar();
  };
  const trocarTipo = (t: Tipo) => {
    setRodando(false);
    setTipo(t);
    setFase("foco");
    baseRef.current = 0;
    setElapsed(0);
  };

  const salvarConfig = (c: Config) => {
    setConfig(c);
    try {
      window.localStorage.setItem(CFG_KEY, JSON.stringify(c));
    } catch {
      /* ignore */
    }
    if (!rodando) {
      baseRef.current = 0;
      setElapsed(0);
    }
  };

  const total = totalSegundos();
  const ehLivre = tipo === "livre";
  const ehPausa = tipo === "pomodoro" && fase === "pausa";
  const mostrado = ehLivre ? elapsed : Math.max(0, total - elapsed);
  const progresso = ehLivre ? 1 : total > 0 ? Math.min(1, elapsed / total) : 0;
  const acento = ehPausa ? "#2D6A4F" : "#C96B3E";
  const hoje = hojeQuery.data ?? { count: 0, minutos: 0 };
  const resumoFoco =
    hoje.count > 0
      ? `Hoje ela fez ${hoje.count} ${hoje.count === 1 ? "sessão" : "sessões"} de foco, somando ${hoje.minutos} min.`
      : "";

  const R = 130;
  const C = 2 * Math.PI * R;

  return (
    <div className="min-h-screen bg-[#FDF8F5]">
      <PainelNav navActive="/foco" />

      <main className="mx-auto max-w-[560px] px-6 py-10 text-center sm:py-12">
        <div className="mb-7">
          <h1 className="mb-2 font-serif text-[36px] leading-tight text-[#1A1A2E] sm:text-[40px]">
            Foco
          </h1>
          <p className="caveat-decorativo text-[#C96B3E]">
            um tempo só seu pra avançar o que importa.
          </p>
        </div>

        {/* Seletor de modo */}
        <div className="mx-auto mb-6 grid max-w-[420px] grid-cols-3 gap-2">
          {TIPOS.map((t) => {
            const ativo = tipo === t.v;
            return (
              <button
                key={t.v}
                type="button"
                onClick={() => trocarTipo(t.v)}
                className={`rounded-xl border px-2 py-2.5 transition-colors ${
                  ativo
                    ? "border-[#C96B3E] bg-[rgba(201,107,62,0.08)]"
                    : "border-[rgba(26,26,46,0.1)] hover:border-[rgba(26,26,46,0.2)]"
                }`}
              >
                <span
                  className={`block font-sans text-[14px] font-semibold ${
                    ativo ? "text-[#C96B3E]" : "text-[#1A1A2E]"
                  }`}
                >
                  {t.label}
                </span>
                <span className="mt-0.5 hidden text-[11px] text-[#1A1A2E] opacity-45 sm:block">
                  {t.sub}
                </span>
              </button>
            );
          })}
        </div>

        {/* Rótulo da sessão */}
        <div className="mx-auto mb-6 max-w-[420px]">
          <input
            type="text"
            value={rotulo}
            onChange={(e) => setRotulo(e.target.value)}
            maxLength={120}
            placeholder="Em que vou focar agora?"
            className="w-full rounded-xl border border-[rgba(26,26,46,0.12)] bg-white px-4 py-2.5 text-center font-sans text-[15px] text-[#1A1A2E] placeholder:text-[#1A1A2E] placeholder:opacity-35 focus:border-[#C96B3E] focus:outline-none"
          />
        </div>

        {/* Anel do timer */}
        <div className="relative mx-auto mb-8 h-[300px] w-[300px]">
          <svg className="h-full w-full -rotate-90" viewBox="0 0 300 300">
            <circle
              cx="150"
              cy="150"
              r={R}
              fill="none"
              stroke="rgba(26,26,46,0.07)"
              strokeWidth="10"
            />
            <circle
              cx="150"
              cy="150"
              r={R}
              fill="none"
              stroke={acento}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - progresso)}
              style={{ transition: "stroke-dashoffset 0.3s linear" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-serif text-[64px] leading-none tabular-nums text-[#1A1A2E]">
              {fmt(mostrado)}
            </span>
            <span
              className="mt-2 font-sans text-[13px] uppercase tracking-[2px] opacity-50"
              style={{ color: acento }}
            >
              {ehLivre ? "tempo livre" : ehPausa ? "respira" : "em foco"}
            </span>
          </div>
        </div>

        {/* Meta vinculada (não na pausa) */}
        {!ehPausa && (metasQuery.data?.length ?? 0) > 0 && (
          <div className="mx-auto mb-6 max-w-[360px]">
            <select
              value={metaId}
              onChange={(e) => setMetaId(e.target.value)}
              className="w-full rounded-xl border border-[rgba(26,26,46,0.12)] bg-white px-4 py-2.5 font-sans text-[14px] text-[#1A1A2E] focus:border-[#C96B3E] focus:outline-none"
            >
              <option value="">ligar a uma meta? (opcional)</option>
              {metasQuery.data!.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.titulo}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Controles */}
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={resetar}
            aria-label="Reiniciar"
            className="flex h-12 w-12 items-center justify-center rounded-full border border-[rgba(26,26,46,0.12)] text-[#1A1A2E] opacity-60 transition-colors hover:bg-white hover:opacity-100"
          >
            <RotateCcw size={18} />
          </button>
          <button
            type="button"
            onClick={rodando ? (ehLivre ? pararLivre : pausar) : iniciar}
            className="flex h-16 w-16 items-center justify-center rounded-full text-white shadow-md transition-transform hover:scale-105"
            style={{ background: acento }}
            aria-label={rodando ? (ehLivre ? "Parar e registrar" : "Pausar") : "Começar"}
          >
            {rodando ? (
              ehLivre ? (
                <Square size={24} />
              ) : (
                <Pause size={26} />
              )
            ) : (
              <Play size={26} className="ml-1" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setConfigAberta((v) => !v)}
            aria-label="Configurar tempos"
            aria-expanded={configAberta}
            className="flex h-12 w-12 items-center justify-center rounded-full border border-[rgba(26,26,46,0.12)] text-[#1A1A2E] opacity-60 transition-colors hover:bg-white hover:opacity-100"
          >
            <Settings2 size={18} />
          </button>
        </div>

        {/* Botão extra: registrar sessão livre em andamento (parar) já é o botão principal.
            Mostra "parar agora" como dica quando livre está rodando. */}
        {ehLivre && rodando && (
          <p className="mt-4 font-sans text-[12px] text-[#1A1A2E] opacity-40">
            toque no quadrado pra registrar essa sessão
          </p>
        )}

        {/* Config */}
        {configAberta && (
          <div className="mx-auto mt-6 max-w-[360px] rounded-2xl border border-[rgba(26,26,46,0.06)] bg-white p-5 text-left">
            <p className="mb-4 font-accent text-[9px] font-bold uppercase tracking-[1.5px] text-[#1A1A2E] opacity-50">
              Seus tempos
            </p>
            <Stepper
              label="Tempo de foco (Pomodoro)"
              valor={config.focoMin}
              min={5}
              max={90}
              passo={5}
              onChange={(v) => salvarConfig({ ...config, focoMin: v })}
            />
            <div className="my-3 h-px bg-[rgba(26,26,46,0.06)]" />
            <Stepper
              label="Tempo de pausa"
              valor={config.pausaMin}
              min={1}
              max={30}
              passo={1}
              onChange={(v) => salvarConfig({ ...config, pausaMin: v })}
            />
            <div className="my-3 h-px bg-[rgba(26,26,46,0.06)]" />
            <Stepper
              label="Tempo de bloco"
              valor={config.blocoMin}
              min={20}
              max={180}
              passo={10}
              onChange={(v) => salvarConfig({ ...config, blocoMin: v })}
            />
          </div>
        )}

        {/* Dica da guia (Coach transversal) */}
        <GuiaInsight
          contexto="foco"
          resumo={resumoFoco}
          className="mx-auto mt-8 max-w-[420px] text-left"
        />

        {/* Resumo de hoje */}
        <p className="mt-6 caveat-decorativo text-[15px] text-[#1A1A2E] opacity-60">
          {hoje.count === 0
            ? "nenhum foco ainda hoje — comece quando quiser."
            : `hoje: ${hoje.count} ${hoje.count === 1 ? "foco" : "focos"} · ${hoje.minutos} min concentrada.`}
        </p>
      </main>
    </div>
  );
}

function Stepper({
  label,
  valor,
  min,
  max,
  passo,
  onChange,
}: {
  label: string;
  valor: number;
  min: number;
  max: number;
  passo: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="font-sans text-[14px] text-[#1A1A2E]">{label}</span>
      <div className="flex shrink-0 items-center gap-3">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, valor - passo))}
          aria-label={`Diminuir ${label}`}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-[rgba(26,26,46,0.12)] text-[18px] text-[#1A1A2E] hover:bg-[rgba(26,26,46,0.04)]"
        >
          −
        </button>
        <span className="w-[56px] text-center font-sans text-[15px] font-semibold tabular-nums text-[#1A1A2E]">
          {valor} min
        </span>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, valor + passo))}
          aria-label={`Aumentar ${label}`}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-[rgba(26,26,46,0.12)] text-[18px] text-[#1A1A2E] hover:bg-[rgba(26,26,46,0.04)]"
        >
          +
        </button>
      </div>
    </div>
  );
}
