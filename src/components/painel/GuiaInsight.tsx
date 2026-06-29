import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { gerarInsight } from "@/lib/coach.functions";

function FoxMini() {
  const [erro, setErro] = useState(false);
  if (erro) {
    return (
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[rgba(201,107,62,0.15)]"
        aria-hidden="true"
      >
        <span className="text-[18px] leading-none">🦊</span>
      </span>
    );
  }
  return (
    <img
      src="/fox-orientando.png"
      alt=""
      aria-hidden="true"
      onError={() => setErro(true)}
      className="h-9 w-9 shrink-0 rounded-full object-cover"
    />
  );
}

/**
 * Insight curto da guia, contextual e cacheado (6h) na tabela coach_insights.
 * Some sozinho quando não há IA configurada ou nada a dizer.
 */
export function GuiaInsight({
  contexto,
  resumo,
  className = "",
}: {
  contexto: string;
  resumo: string;
  className?: string;
}) {
  const { user } = useSupabaseSession();
  const userId = user?.id;
  const qc = useQueryClient();
  const gerar = useServerFn(gerarInsight);
  const [gerando, setGerando] = useState(false);
  const tentou = useRef(false);

  const cacheQuery = useQuery({
    queryKey: ["insight", userId, contexto],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("coach_insights")
        .select("conteudo, expires_at")
        .eq("user_id", userId!)
        .eq("contexto", contexto)
        .maybeSingle();
      return data;
    },
  });

  const valido = !!cacheQuery.data && new Date(cacheQuery.data.expires_at).getTime() > Date.now();
  const texto = valido ? cacheQuery.data!.conteudo : null;

  useEffect(() => {
    if (!userId || !resumo.trim() || cacheQuery.isLoading || valido || tentou.current || gerando)
      return;
    tentou.current = true;
    setGerando(true);
    void (async () => {
      try {
        const r = await gerar({ data: { contexto, resumo } });
        if (r.texto) {
          const expires = new Date(Date.now() + 6 * 3600 * 1000).toISOString();
          await supabase
            .from("coach_insights")
            .upsert(
              { user_id: userId, contexto, conteudo: r.texto, expires_at: expires },
              { onConflict: "user_id,contexto" },
            );
          qc.invalidateQueries({ queryKey: ["insight", userId, contexto] });
        }
      } catch {
        /* silencioso — o card simplesmente não aparece */
      } finally {
        setGerando(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, resumo, cacheQuery.isLoading, valido]);

  if (!texto && !gerando) return null;

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-[rgba(201,107,62,0.2)] bg-[rgba(201,107,62,0.05)] p-4">
      <FoxMini />
      <div className="min-w-0">
        <p className="font-accent text-[9px] font-bold uppercase tracking-[1.5px] text-[#C96B3E] opacity-70">
          sua guia
        </p>
        {texto ? (
          <p className="mt-0.5 font-sans text-[14px] leading-relaxed text-[#1A1A2E]">{texto}</p>
        ) : (
          <p className="mt-0.5 font-sans text-[14px] italic text-[#1A1A2E] opacity-40">
            pensando no seu dia…
          </p>
        )}
      </div>
    </div>
  );
}
