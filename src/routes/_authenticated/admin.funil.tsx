import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/funil")({
  head: () => ({
    meta: [{ title: "Funil de jornada · Pólia" }],
  }),
  component: AdminFunil,
});

const NOMES_ETAPAS = [
  "Posicionamento",
  "Voz da marca",
  "Produto",
  "Presença",
  "Rotina",
  "Vendas",
  "Cuidado",
  "Conteúdo",
  "Crescimento",
  "Rede",
  "Visão",
];

type EtapaFunil = { n: number; nome: string; concluidas: number; dropoff: number };

function AdminFunil() {
  const [etapas, setEtapas] = useState<EtapaFunil[]>([]);
  const [total, setTotal] = useState(0);
  const [seg, setSeg] = useState({ progressoras: 0, estagnadas: 0, silenciosas: 0 });

  useEffect(() => {
    (async () => {
      const { data, count } = await supabase
        .from("profiles")
        .select("etapa_atual,updated_at", { count: "exact" });
      const totalC = count ?? 0;
      setTotal(totalC);
      const arr = data ?? [];
      const contagem: number[] = Array(12).fill(0);
      arr.forEach((p) => {
        for (let i = 1; i <= (p.etapa_atual ?? 0); i++) contagem[i]++;
      });
      const out = NOMES_ETAPAS.map((nome, i) => {
        const n = i + 1;
        const concluidas = contagem[n];
        const anterior = i === 0 ? totalC : contagem[i];
        const dropoff = anterior > 0 ? Math.round(((anterior - concluidas) / anterior) * 100) : 0;
        return { n, nome, concluidas, dropoff };
      });
      setEtapas(out);

      const dias14 = Date.now() - 14 * 86400000;
      let prog = 0,
        estag = 0,
        sil = 0;
      arr.forEach((p) => {
        const ts = new Date(p.updated_at).getTime();
        if (ts < dias14) sil++;
        else if ((p.etapa_atual ?? 0) >= 2) prog++;
        else estag++;
      });
      setSeg({ progressoras: prog, estagnadas: estag, silenciosas: sil });
    })();
  }, []);

  return (
    <>
      <h1 className="font-serif text-[#1A1A2E] text-[40px] mb-8">Funil de jornada</h1>

      <div className="bg-white rounded-2xl p-8 border border-[rgba(26,26,46,0.06)] mb-6">
        <p className="font-mono text-[9px] tracking-[2px] uppercase text-[#1A1A2E] opacity-40 mb-6">
          PROGRESSO POR ETAPA
        </p>
        {etapas.map((etapa, i) => (
          <div key={etapa.n} className="mb-4">
            <div className="flex items-center justify-between mb-1">
              <p className="font-sans text-[#1A1A2E] text-[13px]">
                <span className="opacity-40 mr-2">E{etapa.n}</span> {etapa.nome}
              </p>
              <div className="flex items-center gap-4">
                <p className="font-sans text-[#1A1A2E] text-[13px] opacity-60">
                  {etapa.concluidas} usuárias
                </p>
                {i > 0 && etapa.dropoff > 40 && (
                  <span className="font-mono text-[9px] tracking-[1px] uppercase text-[#C96B3E] bg-[rgba(201,107,62,0.08)] px-2 py-0.5 rounded-full">
                    -{etapa.dropoff}% drop
                  </span>
                )}
              </div>
            </div>
            <div className="w-full h-3 bg-[#F5F5FA] rounded-full">
              <div
                className="h-3 rounded-full transition-all"
                style={{
                  width: `${total ? (etapa.concluidas / total) * 100 : 0}%`,
                  backgroundColor: etapa.dropoff > 40 ? "#C9407A" : "#C96B3E",
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          {
            label: "Progressoras Ativas",
            desc: "etapa ≥ 2 e ativas em 14 dias",
            count: seg.progressoras,
            cor: "#2D6A4F",
          },
          {
            label: "Estagnadas",
            desc: "ativas mas sem progredir",
            count: seg.estagnadas,
            cor: "#C96B3E",
          },
          {
            label: "Silenciosas",
            desc: "sem acesso há mais de 14 dias",
            count: seg.silenciosas,
            cor: "#C9407A",
          },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-white rounded-2xl p-6 border border-[rgba(26,26,46,0.06)]"
          >
            <p className="font-serif text-[48px] leading-none mb-2" style={{ color: s.cor }}>
              {s.count}
            </p>
            <p className="font-sans text-[#1A1A2E] text-[14px] font-medium mb-1">{s.label}</p>
            <p className="font-sans text-[#1A1A2E] text-[12px] opacity-40">{s.desc}</p>
          </div>
        ))}
      </div>
    </>
  );
}
