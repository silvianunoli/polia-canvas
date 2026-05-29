import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";

export interface UserMeta {
  initial: string;
  displayName: string;
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

  const query = useQuery<UserMeta>({
    queryKey: ["user-meta", userId],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async () => {
      const [{ data: profile }, { data: tarefas }] = await Promise.all([
        supabase
          .from("profiles")
          .select("full_name, is_admin, avatar_url")
          .eq("id", userId!)
          .maybeSingle(),
        supabase
          .from("tarefas")
          .select("status, updated_at, created_at")
          .eq("user_id", userId!)
          .order("updated_at", { ascending: false })
          .limit(200),
      ]);

      const full =
        (profile?.full_name as string | undefined) ??
        (user?.user_metadata?.full_name as string | undefined) ??
        "";
      const displayName = full.trim().split(" ")[0] || "você";
      const initial = (displayName.charAt(0) || "P").toUpperCase();

      // Streak: dias consecutivos (do mais recente) com pelo menos uma tarefa
      // concluída (status === "floresceu") ou atualizada.
      const ativos = new Set<string>();
      (tarefas ?? []).forEach((t: { status: string; updated_at: string; created_at: string }) => {
        if (t.status === "floresceu") {
          ativos.add(new Date(t.updated_at).toISOString().slice(0, 10));
        }
      });
      let streak = 0;
      const cursor = new Date();
      cursor.setHours(0, 0, 0, 0);
      // se hoje não tem mas ontem tinha, ainda conta a partir de ontem
      let skipped = 0;
      while (skipped <= 1) {
        const key = cursor.toISOString().slice(0, 10);
        if (ativos.has(key)) {
          streak += 1;
          skipped = 0;
        } else if (streak === 0 && skipped === 0) {
          // permite começar de ontem se hoje vazio
          skipped += 1;
        } else {
          break;
        }
        cursor.setDate(cursor.getDate() - 1);
      }

      return {
        initial,
        displayName,
        isAdmin: !!profile?.is_admin,
        streak,
        avatarUrl: (profile?.avatar_url as string | null) ?? null,
      };
    },
  });

  return (
    query.data ?? {
      initial: "P",
      displayName: "você",
      isAdmin: false,
      streak: 0,
      avatarUrl: null,
    }
  );
}
