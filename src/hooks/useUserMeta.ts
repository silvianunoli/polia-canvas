import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";

export interface UserMeta {
  initial: string;
  displayName: string;
  businessName: string | null;
  isAdmin: boolean;
  streak: number;
  avatarUrl: string | null;
}

/**
 * Source of truth pra dados do usuário no header (streak, avatar, admin).
 * Garante valores consistentes entre todas as rotas autenticadas.
 */
export function useUserMeta() {
  const { user } = useSupabaseSession();
  const userId = user?.id;
  const qc = useQueryClient();

  // Registra a presença de hoje uma vez por sessão/montagem — fora do queryFn de leitura,
  // pra um refetch (foco de janela, reconnect, retry) não disparar writes repetidos nem
  // serializar a leitura do header atrás do round-trip de escrita. Idempotente por dia.
  useEffect(() => {
    if (!userId) return;
    const hojeKey = new Date().toISOString().slice(0, 10);
    supabase
      .from("presencas")
      .upsert(
        { user_id: userId, data: hojeKey },
        { onConflict: "user_id,data", ignoreDuplicates: true },
      )
      .then(({ error }) => {
        // Sem presença registrada não quebra nada; o streak só não conta hoje.
        if (!error) qc.invalidateQueries({ queryKey: ["user-meta", userId] });
      });
  }, [userId, qc]);

  const query = useQuery<UserMeta>({
    queryKey: ["user-meta", userId],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async () => {
      const desde = new Date();
      desde.setDate(desde.getDate() - 365);
      const desdeKey = desde.toISOString().slice(0, 10);

      const [{ data: profile }, { data: tarefas }, { data: presencas }] = await Promise.all([
        supabase
          .from("profiles")
          .select("full_name, is_admin, business_name")
          .eq("id", userId!)
          .maybeSingle(),
        supabase
          .from("tarefas")
          .select("status, updated_at")
          .eq("user_id", userId!)
          .eq("status", "concluido")
          .gte("updated_at", desdeKey)
          .limit(400),
        supabase.from("presencas").select("data").eq("user_id", userId!).gte("data", desdeKey),
      ]);

      const full =
        (profile?.full_name as string | undefined) ??
        (user?.user_metadata?.full_name as string | undefined) ??
        "";
      const displayName = full.trim().split(" ")[0] || "você";
      const initial = (displayName.charAt(0) || "P").toUpperCase();

      // Presença = dias distintos em que a usuária apareceu: abriu o app (presencas)
      // ou concluiu uma tarefa (concluido). É um total que só cresce — não um streak
      // consecutivo que zera com uma falha.
      const ativos = new Set<string>();
      (presencas ?? []).forEach((p: { data: string }) => {
        if (p.data) ativos.add(p.data);
      });
      (tarefas ?? []).forEach((t: { status: string; updated_at: string }) => {
        if (t.status === "concluido") ativos.add(new Date(t.updated_at).toISOString().slice(0, 10));
      });
      const streak = ativos.size;

      const rawBusiness = (profile?.business_name as string | undefined) ?? "";
      const businessName = rawBusiness.trim() || null;

      return {
        initial,
        displayName,
        businessName,
        isAdmin: !!profile?.is_admin,
        streak,
        avatarUrl: null,
      };
    },
  });

  return (
    query.data ?? {
      initial: "P",
      displayName: "você",
      businessName: null,
      isAdmin: false,
      streak: 0,
      avatarUrl: null,
    }
  );
}
