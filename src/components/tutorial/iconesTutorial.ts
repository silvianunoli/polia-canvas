import {
  Calculator,
  CalendarDays,
  ClipboardList,
  CreditCard,
  DoorOpen,
  LayoutDashboard,
  LayoutList,
  Link2,
  Map,
  Megaphone,
  MessageCircle,
  Notebook,
  Package,
  ShoppingBag,
  Stethoscope,
  Target,
  TrendingUp,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import type { SlugTutorial } from "@/lib/tutoriais";

// Mesmos ícones do menu lateral (components/layout/Sidebar.tsx), pra a usuária
// reconhecer a tela pelo desenho antes de ler o nome.
export const ICONE_TUTORIAL: Record<SlugTutorial, LucideIcon> = {
  "primeiro-acesso": DoorOpen,
  painel: LayoutDashboard,
  planejamento: Map,
  assistente: MessageCircle,
  planos: CreditCard,
  produtos: Package,
  calculadora: Calculator,
  anuncios: Link2,
  vendas: ShoppingBag,
  financeiro: Wallet,
  metas: Target,
  projecao: TrendingUp,
  raiox: Stethoscope,
  clientes: Users,
  planner: LayoutList,
  pedidos: ClipboardList,
  calendario: CalendarDays,
  caderno: Notebook,
  "plano-de-conteudo": Megaphone,
};
