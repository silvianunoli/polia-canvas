import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/feedback")({
  component: AdminFeedback,
});

function AdminFeedback() {
  const [respostas, setRespostas] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("feedback_responses")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      setRespostas(data ?? []);
    })();
  }, []);

  const porEtapa = useMemo(() => {
    const map = new Map<string, any[]>();
    respostas
      .filter((r) => r.trigger_type === "entregavel_concluido")
      .forEach((r) => {
        if (!map.has(r.context_ref)) map.set(r.context_ref, []);
        map.get(r.context_ref)!.push(r);
      });
    return Array.from(map.entries())
      .map(([ref, items]) => {
        const total = items.length;
        const s1 = items.filter((i) => i.score === 1).length;
        const s2 = items.filter((i) => i.score === 2).length;
        const s3 = items.filter((i) => i.score === 3).length;
        return {
          ref,
          total,
          score_1: s1,
          score_2: s2,
          score_3: s3,
          pct_dificil: total ? Math.round((s1 / total) * 100) : 0,
          pct_ok: total ? Math.round((s2 / total) * 100) : 0,
          pct_boa: total ? Math.round((s3 / total) * 100) : 0,
          comentarios: items.filter((i) => i.comment).map((i) => i.comment).slice(0, 3),
        };
      })
      .sort((a, b) => a.ref.localeCompare(b.ref));
  }, [respostas]);

  return (
    <>
      <h1 className="font-serif text-[#1A1A2E] text-[40px] mb-6">Feedback CSAT</h1>
      <p className="font-mono text-[9px] tracking-[2px] uppercase text-[#1A1A2E] opacity-40 mb-4">
        POR CONTEXTO · score 1=difícil 2=ok 3=boa
      </p>
      <div className="space-y-3">
        {porEtapa.length === 0 && (
          <p className="font-sans text-[#1A1A2E] text-[13px] opacity-50">Nenhum CSAT registrado ainda.</p>
        )}
        {porEtapa.map((item) => (
          <div key={item.ref} className="bg-white rounded-2xl p-5 border border-[rgba(26,26,46,0.06)]">
            <div className="flex items-center justify-between mb-3">
              <p className="font-sans text-[#1A1A2E] text-[14px] font-medium">{item.ref}</p>
              <p className={`font-mono text-[10px] tracking-[1px] uppercase ${item.pct_dificil > 30 ? "text-[#C9407A]" : "text-[#2D6A4F]"}`}>
                {item.pct_dificil}% difícil
              </p>
            </div>
            <div className="flex gap-2 mb-3">
              {[
                { label: "Difícil", count: item.score_1, pct: item.pct_dificil, cor: "#C9407A" },
                { label: "Ok", count: item.score_2, pct: item.pct_ok, cor: "#C96B3E" },
                { label: "Boa", count: item.score_3, pct: item.pct_boa, cor: "#2D6A4F" },
              ].map((s) => (
                <div key={s.label} className="flex-1">
                  <div className="h-2 rounded-full" style={{ backgroundColor: s.cor + "30" }}>
                    <div className="h-2 rounded-full transition-all" style={{ width: `${s.pct}%`, backgroundColor: s.cor }} />
                  </div>
                  <p className="font-sans text-[#1A1A2E] text-[11px] opacity-40 mt-1">
                    {s.label} · {s.count}
                  </p>
                </div>
              ))}
            </div>
            {item.comentarios.map((c, i) => (
              <p key={i} className="font-sans text-[#1A1A2E] text-[12px] opacity-50 italic mb-1">
                "{c}"
              </p>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}
