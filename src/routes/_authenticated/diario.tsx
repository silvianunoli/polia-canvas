import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { PainelNav } from "@/components/painel/PainelNav";
import { Heart } from "lucide-react";

export const Route = createFileRoute("/_authenticated/diario")({
  head: () => ({
    meta: [
      { title: "Check-in do dia · Pólia" },
      { name: "description", content: "Uma pausa pra ver como você está hoje." },
    ],
  }),
  component: DiarioPage,
});

interface Checkin {
  humor: number | null;
  sono_horas: number | null;
  agua_litros: number | null;
  estresse: number | null;
  alimentacao: number | null;
  exercicio: boolean | null;
  nota: string | null;
}

const HUMOR = [
  { v: 1, emoji: "😔", label: "muito mal" },
  { v: 2, emoji: "😕", label: "mal" },
  { v: 3, emoji: "😐", label: "regular" },
  { v: 4, emoji: "🙂", label: "bem" },
  { v: 5, emoji: "😄", label: "muito bem" },
];
const SONO = [4, 5, 6, 7, 8, 9];
const AGUA = [0.5, 1, 1.5, 2, 2.5, 3];
const ESTRESSE = ["tranquilo", "leve", "moderado", "alto", "muito alto"];
const ALIMENTACAO = ["muito ruim", "ruim", "regular", "boa", "excelente"];

function localDateKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function saudacao(): string {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function horaAgora(): string {
  return new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function DiarioPage() {
  const { user } = useSupabaseSession();
  const userId = user?.id;
  const qc = useQueryClient();
  const hoje = localDateKey();

  const checkinQuery = useQuery({
    queryKey: ["checkin", userId, hoje],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("checkins")
        .select("humor, sono_horas, agua_litros, estresse, alimentacao, exercicio, nota")
        .eq("user_id", userId!)
        .eq("data", hoje)
        .maybeSingle();
      return (data ?? null) as Checkin | null;
    },
  });

  const [humor, setHumor] = useState<number | null>(null);
  const [sono, setSono] = useState<number | null>(null);
  const [agua, setAgua] = useState<number | null>(null);
  const [estresse, setEstresse] = useState<number | null>(null);
  const [alimentacao, setAlimentacao] = useState<number | null>(null);
  const [exercicio, setExercicio] = useState(false);
  const [nota, setNota] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);

  useEffect(() => {
    const c = checkinQuery.data;
    if (c) {
      setHumor(c.humor ?? null);
      setSono(c.sono_horas ?? null);
      setAgua(c.agua_litros ?? null);
      setEstresse(c.estresse ?? null);
      setAlimentacao(c.alimentacao ?? null);
      setExercicio(c.exercicio ?? false);
      setNota(c.nota ?? "");
    }
  }, [checkinQuery.data]);

  const salvar = async () => {
    if (!userId) return;
    setSalvando(true);
    const { error } = await supabase.from("checkins").upsert(
      {
        user_id: userId,
        data: hoje,
        humor,
        sono_horas: sono,
        agua_litros: agua,
        estresse,
        alimentacao,
        exercicio,
        nota: nota.trim() || null,
      },
      { onConflict: "user_id,data" },
    );
    setSalvando(false);
    if (!error) {
      setSalvo(true);
      qc.invalidateQueries({ queryKey: ["checkin", userId, hoje] });
      qc.invalidateQueries({ queryKey: ["user-meta", userId] });
      setTimeout(() => setSalvo(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDF8F5]">
      <PainelNav navActive="/diario" />

      <main className="mx-auto max-w-[680px] px-6 py-10 sm:px-8 sm:py-12">
        <div className="mb-8">
          <h1 className="mb-2 font-serif text-[36px] leading-tight text-[#1A1A2E] sm:text-[40px]">
            {saudacao()}
          </h1>
          <p className="caveat-decorativo text-[#C96B3E]">pausa do dia · {horaAgora()}</p>
        </div>

        <div className="space-y-5">
          {/* Humor */}
          <Bloco titulo="Como você está se sentindo?">
            <div className="flex flex-wrap gap-2">
              {HUMOR.map((h) => {
                const ativo = humor === h.v;
                return (
                  <button
                    key={h.v}
                    type="button"
                    onClick={() => setHumor(ativo ? null : h.v)}
                    aria-pressed={ativo}
                    className={`flex flex-1 flex-col items-center gap-1.5 rounded-xl border px-2 py-3 transition-colors ${
                      ativo
                        ? "border-[#C96B3E] bg-[rgba(201,107,62,0.08)]"
                        : "border-[rgba(26,26,46,0.1)] hover:border-[rgba(26,26,46,0.2)]"
                    }`}
                  >
                    <span className="text-[26px] leading-none">{h.emoji}</span>
                    <span
                      className={`text-center font-sans text-[11px] ${
                        ativo ? "font-semibold text-[#C96B3E]" : "text-[#1A1A2E] opacity-55"
                      }`}
                    >
                      {h.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </Bloco>

          {/* Sono */}
          <Bloco titulo="Quanto você dormiu?">
            <Opcoes
              valores={SONO}
              selecionado={sono}
              rotulo={(v) => (v === 9 ? "9h+" : `${v}h`)}
              onSelect={setSono}
            />
          </Bloco>

          {/* Água */}
          <Bloco titulo="Quanta água você bebeu?">
            <Opcoes
              valores={AGUA}
              selecionado={agua}
              rotulo={(v) => (v === 3 ? "3L+" : `${String(v).replace(".", ",")}L`)}
              onSelect={setAgua}
            />
          </Bloco>

          {/* Estresse */}
          <Bloco titulo="Como está seu nível de estresse?">
            <Escala labels={ESTRESSE} selecionado={estresse} onSelect={setEstresse} invertido />
          </Bloco>

          {/* Alimentação */}
          <Bloco titulo="Como foi sua alimentação?">
            <Escala labels={ALIMENTACAO} selecionado={alimentacao} onSelect={setAlimentacao} />
          </Bloco>

          {/* Exercício */}
          <Bloco titulo="Você se mexeu hoje?">
            <button
              type="button"
              onClick={() => setExercicio((v) => !v)}
              aria-pressed={exercicio}
              className={`flex w-full items-center justify-between rounded-xl border px-4 py-3.5 transition-colors ${
                exercicio
                  ? "border-[#2D6A4F] bg-[rgba(45,106,79,0.06)]"
                  : "border-[rgba(26,26,46,0.1)]"
              }`}
            >
              <span className="font-sans text-[15px] text-[#1A1A2E]">
                {exercicio ? "Sim, me exercitei" : "Pratiquei exercício hoje"}
              </span>
              <span
                className="relative h-6 w-11 rounded-full transition-colors"
                style={{ background: exercicio ? "#2D6A4F" : "rgba(26,26,46,0.2)" }}
              >
                <span
                  className="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all"
                  style={{ left: exercicio ? "22px" : "2px" }}
                />
              </span>
            </button>
          </Bloco>

          {/* Nota livre */}
          <Bloco titulo="Quer registrar mais alguma coisa?">
            <textarea
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              maxLength={2000}
              rows={3}
              placeholder="opcional — um pensamento, um lembrete, como foi o dia."
              className="w-full resize-none rounded-xl border border-[rgba(26,26,46,0.12)] px-4 py-3 font-sans text-[15px] leading-relaxed text-[#1A1A2E] placeholder:text-[#1A1A2E] placeholder:opacity-30 focus:border-[#C96B3E] focus:shadow-[0_0_0_3px_rgba(201,107,62,0.08)] focus:outline-none"
            />
          </Bloco>
        </div>

        <div className="mt-8 flex items-center justify-end gap-4">
          <span
            className={`caveat-decorativo text-[14px] text-[#C96B3E] transition-opacity duration-300 ${
              salvo ? "opacity-100" : "opacity-0"
            }`}
          >
            check-in guardado.
          </span>
          <button
            type="button"
            onClick={salvar}
            disabled={salvando}
            className="flex items-center gap-2 rounded-xl bg-polia-terracota px-6 py-3 font-sans text-[14px] font-semibold text-polia-creme transition-colors hover:bg-[#B85A2D] disabled:opacity-50"
          >
            <Heart size={16} />
            {salvando ? "Salvando..." : "Salvar check-in"}
          </button>
        </div>
      </main>
    </div>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[rgba(26,26,46,0.06)] bg-white p-5">
      <h2 className="mb-3 font-serif text-[19px] leading-tight text-[#1A1A2E]">{titulo}</h2>
      {children}
    </section>
  );
}

function Opcoes({
  valores,
  selecionado,
  rotulo,
  onSelect,
}: {
  valores: number[];
  selecionado: number | null;
  rotulo: (v: number) => string;
  onSelect: (v: number | null) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {valores.map((v) => {
        const ativo = selecionado === v;
        return (
          <button
            key={v}
            type="button"
            onClick={() => onSelect(ativo ? null : v)}
            aria-pressed={ativo}
            className={`min-w-[56px] flex-1 rounded-xl border px-3 py-2.5 font-sans text-[14px] transition-colors ${
              ativo
                ? "border-[#C96B3E] bg-[rgba(201,107,62,0.08)] font-semibold text-[#C96B3E]"
                : "border-[rgba(26,26,46,0.1)] text-[#1A1A2E] opacity-70 hover:opacity-100"
            }`}
          >
            {rotulo(v)}
          </button>
        );
      })}
    </div>
  );
}

function Escala({
  labels,
  selecionado,
  onSelect,
  invertido = false,
}: {
  labels: string[];
  selecionado: number | null;
  onSelect: (v: number | null) => void;
  invertido?: boolean;
}) {
  // invertido = escala onde "1" é o bom (ex: estresse tranquilo) → cor verde no 1.
  return (
    <div className="flex flex-wrap gap-2">
      {labels.map((label, i) => {
        const v = i + 1;
        const ativo = selecionado === v;
        return (
          <button
            key={label}
            type="button"
            onClick={() => onSelect(ativo ? null : v)}
            aria-pressed={ativo}
            className={`flex-1 rounded-xl border px-2 py-3 transition-colors ${
              ativo
                ? "border-[#C96B3E] bg-[rgba(201,107,62,0.08)]"
                : "border-[rgba(26,26,46,0.1)] hover:border-[rgba(26,26,46,0.2)]"
            }`}
          >
            <span
              className="mx-auto mb-1.5 block h-1.5 rounded-full"
              style={{
                width: `${30 + i * 12}%`,
                background: ativo ? "#C96B3E" : "rgba(26,26,46,0.2)",
                transform: invertido ? "scaleX(-1)" : undefined,
              }}
            />
            <span
              className={`block text-center font-sans text-[11px] ${
                ativo ? "font-semibold text-[#C96B3E]" : "text-[#1A1A2E] opacity-55"
              }`}
            >
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
