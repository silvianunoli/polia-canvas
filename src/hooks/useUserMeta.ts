import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { dataISOLocal, hojeISO } from "@/lib/data.functions";

export interface UserMeta {
  initial: string;
  displayName: string;
  businessName: string | null;
  isAdmin: boolean;
  streak: number;
  avatarUrl: string | null;
  plano: string;
  /**
   * `true` enquanto o perfil não chegou do banco. Existe porque `plano` cai no
   * padrão "confere" durante o carregamento: sem esta flag, as telas do Pro
   * (Raio-x, Projeção, Plano de conteúdo) mostravam o portão "isso é do Pro"
   * por um instante PARA QUEM JÁ PAGA o Pro, em toda abertura.
   *
   * Continua `true` quando a leitura do perfil FALHOU e ainda não há dado bom:
   * erro nunca vira "confere" (quem paga via cadeado e portão do Pro por 60s).
   */
  carregando: boolean;
  /**
   * `true` quando a última leitura do perfil falhou e não há dado bom em cache.
   * Pra quem quiser trocar o "carregando" por um aviso com "Tentar de novo".
   */
  erro: boolean;
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
    // Dia LOCAL (QA-40): o dia UTC virava "amanhã" depois das 21h de Brasília.
    const hojeKey = hojeISO();
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
      const desdeKey = dataISOLocal(desde);

      const [{ data: profile, error: erroPerfil }, { data: tarefas }, { data: presencas }] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("full_name, is_admin, business_name, plano")
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

      // Sem o perfil não dá pra saber o plano. Lança em vez de cair em "confere":
      // o React Query tenta de novo e, se já havia dado bom, ele continua valendo.
      // Tarefas/presenças só alimentam a contagem de presença: falha nelas não
      // rebaixa ninguém, então não derruba a leitura.
      if (erroPerfil) throw erroPerfil;

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
        // Dia local da conclusão, no mesmo fuso da presença (QA-40).
        if (t.status === "concluido") ativos.add(dataISOLocal(new Date(t.updated_at)));
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
        plano: (profile?.plano as string | undefined) ?? "confere",
        carregando: false,
        erro: false,
      };
    },
  });

  // Dado bom em cache vence erro de refetch: o React Query mantém `data` quando
  // uma releitura falha, então o plano de quem paga nunca cai por instabilidade.
  if (query.data) return query.data;

  return {
    initial: "P",
    displayName: "você",
    businessName: null,
    isAdmin: false,
    streak: 0,
    avatarUrl: null,
    plano: "confere",
    // Enquanto não chegou o perfil, "confere" é um chute — quem consome
    // precisa saber disso antes de barrar alguém. Também vale quando a
    // leitura falhou: erro não é "confere".
    carregando: true,
    erro: query.isError,
  };
}
