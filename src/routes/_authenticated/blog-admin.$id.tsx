import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { PostEditor } from "@/components/blog-admin/PostEditor";

export const Route = createFileRoute("/_authenticated/blog-admin/$id")({
  head: () => ({ meta: [{ title: "Editar post · Blog · Admin · Pólia" }] }),
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
  loader: async ({ params }) => {
    const { data } = await supabase
      .from("blog_posts")
      .select("*")
      .eq("id", params.id)
      .maybeSingle();
    if (!data) throw redirect({ to: "/blog-admin" });
    return { post: data };
  },
  component: EditarPost,
});

function EditarPost() {
  const { post } = Route.useLoaderData();
  return <PostEditor post={post} />;
}
