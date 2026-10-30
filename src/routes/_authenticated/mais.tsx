import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BookOpen,
  CalendarDays,
  ChevronRight,
  LayoutList,
  Lock,
  Map,
  Megaphone,
  MessageCircle,
  Notebook,
  Package,
  PlayCircle,
  Settings,
  ShoppingBag,
  Store,
  Stethoscope,
  Target,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { PaginaLogada } from "@/components/layout/PaginaLogada";
import { BotaoSair } from "@/components/cosmic/SairDaConta";
import { useUserMeta } from "@/hooks/useUserMeta";
import { useFerramentasInternas } from "@/hooks/useFerramentasInternas";
import type { FerramentaInterna } from "@/lib/ferramentasInternas";
import { recursoLiberado, tierPagoDaRota, TIERS_PAGOS } from "@/lib/planos";

// Aba "Mais" do app Android (AND-07): tudo da Pólia One que não ganhou aba
// própria. Mesma regra de cadeado do menu lateral (recursoLiberado): sem o
// plano, o item leva pra tela de upgrade em vez de abrir e barrar. Planner e
// Caderno só aparecem pra quem tem a flag (conta interna, desde 28/10/2026).

export const Route = createFileRoute("/_authenticated/mais")({
  head: () => ({ meta: [{ title: "Mais · Pólia One" }] }),
  component: Mais,
});

// livre: abre em todo plano (Ajuda nem é rota logada), sem passar pela regra de cadeado.
// interna: só aparece com a flag da ferramenta (useFerramentasInternas).
type Item = {
  to: string;
  label: string;
  icon: typeof Package;
  livre?: boolean;
  interna?: FerramentaInterna;
};

const GRUPOS: { titulo: string; itens: Item[] }[] = [
  {
    titulo: "Dia a dia",
    itens: [
      { to: "/vendas", label: "Vendas", icon: ShoppingBag },
      { to: "/catalogo", label: "Catálogo", icon: Store },
      { to: "/financeiro", label: "Financeiro", icon: Wallet },
      { to: "/clientes", label: "Clientes", icon: Users },
      { to: "/produtos", label: "Produtos", icon: Package },
    ],
  },
  {
    titulo: "Planejar",
    itens: [
      { to: "/planejamento", label: "Planejamento", icon: Map },
      { to: "/metas", label: "Metas", icon: Target },
      { to: "/projecao", label: "Projeção e cenários", icon: TrendingUp },
      { to: "/raiox", label: "Raio-x do mês", icon: Stethoscope },
      { to: "/plano-conteudo", label: "Plano de conteúdo", icon: Megaphone },
      { to: "/calendario", label: "Calendário", icon: CalendarDays },
      { to: "/planner", label: "Planner", icon: LayoutList, interna: "planner" },
      { to: "/caderno", label: "Caderno", icon: Notebook, interna: "caderno" },
    ],
  },
  {
    titulo: "Conta",
    itens: [
      { to: "/aimer", label: "Assistente", icon: MessageCircle, livre: true },
      { to: "/como-usar", label: "Como usar", icon: PlayCircle, livre: true },
      { to: "/configuracoes", label: "Configurações", icon: Settings, livre: true },
      { to: "/ajuda", label: "Ajuda", icon: BookOpen, livre: true },
    ],
  },
];

const LINHA =
  "flex min-h-14 items-center gap-3 px-4 font-sans text-[15px] no-underline transition-colors hover:bg-[var(--bg)] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--ink)]";

function Mais() {
  const meta = useUserMeta();
  const internas = useFerramentasInternas();

  return (
    <PaginaLogada titulo="Mais.">
      <div className="flex flex-col gap-8">
        {GRUPOS.map((grupo) => (
          <section key={grupo.titulo} aria-labelledby={`mais-${grupo.titulo}`}>
            <h2
              id={`mais-${grupo.titulo}`}
              className="mb-2 font-accent text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--muted)]"
            >
              {grupo.titulo}
            </h2>
            <ul className="divide-y divide-[var(--line)] overflow-hidden rounded-2xl border border-[var(--line)] bg-white">
              {grupo.itens
                .filter((item) => !item.interna || internas[item.interna])
                .map((item) => {
                  const Icon = item.icon;
                  // Enquanto o plano não chega, sem cadeado (igual ao menu lateral):
                  // o guard da rota continua barrando quem não tem acesso.
                  const liberado =
                    item.livre || meta.carregando || recursoLiberado(item.to, meta.plano);
                  const tier = tierPagoDaRota(item.to);
                  return (
                    <li key={item.to}>
                      {liberado ? (
                        <Link to={item.to} className={`${LINHA} text-[var(--ink)]`}>
                          <Icon size={20} aria-hidden="true" />
                          <span className="flex-1">{item.label}</span>
                          <ChevronRight
                            size={18}
                            className="text-[var(--muted)]"
                            aria-hidden="true"
                          />
                        </Link>
                      ) : (
                        <Link
                          to="/upgrade"
                          search={{ rota: item.to, tier }}
                          className={`${LINHA} text-[var(--muted)]`}
                        >
                          <Icon size={20} aria-hidden="true" />
                          <span className="flex-1">{item.label}</span>
                          <span className="flex items-center gap-1 text-[12px]">
                            <Lock size={14} aria-hidden="true" />
                            {TIERS_PAGOS[tier].titulo}
                          </span>
                        </Link>
                      )}
                    </li>
                  );
                })}
            </ul>
          </section>
        ))}
        <BotaoSair className="self-start" />
      </div>
    </PaginaLogada>
  );
}
