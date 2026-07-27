import { createFileRoute, redirect } from "@tanstack/react-router";
import type { ComponentType } from "react";
import { ArrowRight, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PoliaIcon } from "@/components/brand/PoliaLogo";

// Fora do layout `_authenticated` de propósito: essa página é um seletor de
// produto que antecede a escolha de qual admin abrir, então não tem o Sidebar
// de nenhum produto específico. O guard de sessão/admin é o mesmo de
// `_authenticated/admin.tsx`, só que autocontido aqui por não herdar do
// layout autenticado.
export const Route = createFileRoute("/central")({
  head: () => ({
    meta: [{ title: "Central de administração · Pólia" }],
  }),
  beforeLoad: async ({ location }) => {
    if (typeof window === "undefined") return;
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      throw redirect({ to: "/auth/login", search: { next: location.href } });
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", userData.user.id)
      .maybeSingle();
    if (!profile?.is_admin) throw redirect({ to: "/painel" });
  },
  component: CentralAdmin,
});

type Produto = {
  nome: string;
  descricao: string;
  href: string;
  icone: ComponentType<{ className?: string }>;
};

// Ponto único de entrada dos admins de todos os produtos dela — hoje só a
// Pólia, mas a lista existe pra crescer sem mexer no layout da página.
const PRODUTOS: Produto[] = [
  {
    nome: "Pólia",
    descricao: "Usuárias, conteúdo, métricas e operação do produto.",
    href: "https://silvianunoli.com.br",
    icone: PoliaIcon,
  },
];

async function sair() {
  await supabase.auth.signOut();
  window.location.href = "/auth/login";
}

function CentralAdmin() {
  return (
    <div className="polia-v3 min-h-screen bg-[var(--bg)]">
      <header className="flex items-center justify-between border-b border-[var(--line)] px-6 py-4 md:px-10">
        {/* Provisório: sem logotipo próprio ainda pra essa central multi-produto. */}
        <span className="text-[15px] font-medium text-[var(--ink)]">silvia nunoli</span>
        <button
          type="button"
          onClick={sair}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-[14px] text-[var(--ink-soft)] hover:bg-[var(--surface)]"
        >
          <LogOut size={18} aria-hidden="true" />
          Sair
        </button>
      </header>

      <div className="px-6 py-10 md:px-10">
        <h1 className="text-[28px] font-medium text-[var(--ink)]">Central de administração</h1>
        <p className="mt-2 text-[15px] text-[var(--ink-soft)]">Escolha o produto pra gerenciar.</p>

        <div className="mt-8 grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PRODUTOS.map((produto) => {
            const Icone = produto.icone;
            return (
              <a
                key={produto.nome}
                href={produto.href}
                className="group flex flex-col gap-3 rounded-xl border border-[var(--line)] bg-white p-5 no-underline transition-colors hover:border-[var(--secondary)]"
              >
                <Icone className="h-8 w-auto text-[var(--ink)]" />
                <div>
                  <p className="text-[16px] font-medium text-[var(--ink)]">{produto.nome}</p>
                  <p className="mt-1 text-[13px] text-[var(--ink-soft)]">{produto.descricao}</p>
                </div>
                <span className="mt-auto flex items-center gap-1 text-[13px] font-medium text-[var(--secondary-text)]">
                  Entrar no admin
                  <ArrowRight
                    size={14}
                    className="transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </span>
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
}
