import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { PostEditor } from "@/components/blog-admin/PostEditor";

export const Route = createFileRoute("/_authenticated/blog-admin/novo")({
  head: () => ({ meta: [{ title: "Novo post · Blog · Admin · Pólia" }] }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw redirect({ to: "/auth/login" });
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", userData.user.id)
      .maybeSingle();
    if (!profile?.is_admin) throw redirect({ to: "/painel" });
  },
  component: NovoPost,
});

function NovoPost() {
  return <PostEditor post={null} />;
}
