import {
  Compass,
  AlertTriangle,
  Lock,
  Wrench,
  WifiOff,
  Clock,
  Link2Off,
  type LucideIcon,
} from "lucide-react";
import type { ErrorAction } from "@/components/layout/ErrorPage";

export type ErrorCode =
  | "404"
  | "500"
  | "403"
  | "manutencao"
  | "offline"
  | "sessao-expirada"
  | "link-expirado";

interface CopyMap {
  title: string;
  subtitle: string;
  pageTitle: string;
  icon: LucideIcon;
  primaryAction: ErrorAction;
  secondaryAction?: ErrorAction;
}

// Textos exatos da seção 3.1 do PRD de sistema de erros. Não reescrever solto
// em outro lugar — quem precisar da mesma copy (ex: banner de sessão expirada
// no login) importa ERROR_COPY em vez de duplicar a frase.
export const ERROR_COPY: Record<ErrorCode, CopyMap> = {
  "404": {
    title: "Essa página não existe.",
    subtitle: "O endereço está errado ou a página saiu do ar.",
    pageTitle: "Página não encontrada",
    icon: Compass,
    primaryAction: { label: "Ir pro início", href: "/painel" },
    secondaryAction: { label: "Falar com a gente", href: "/ajuda#contato" },
  },
  "500": {
    title: "Algo travou do nosso lado.",
    subtitle: "Não foi nada que você fez. O erro já chegou pra gente e os seus dados estão salvos.",
    pageTitle: "Erro interno",
    icon: AlertTriangle,
    // Recarregar de verdade: antes os dois botões iam pro mesmo lugar e o
    // "tentar de novo" não tentava nada.
    primaryAction: { label: "Recarregar a página", onClick: () => window.location.reload() },
    secondaryAction: { label: "Ir pro painel", href: "/painel" },
  },
  "403": {
    title: "Essa parte é de acesso restrito.",
    subtitle: "Se acha que deveria ter, fala com a gente.",
    pageTitle: "Acesso restrito",
    icon: Lock,
    primaryAction: { label: "Ir pro painel", href: "/painel" },
    secondaryAction: { label: "Falar com a gente", href: "/ajuda#contato" },
  },
  manutencao: {
    title: "A Pólia está em manutenção agora.",
    subtitle: "Os seus números estão salvos. Recarrega daqui a alguns minutos que já volta.",
    pageTitle: "Manutenção",
    icon: Wrench,
    primaryAction: { label: "Tentar de novo", href: "/painel" },
  },
  offline: {
    title: "Sem conexão com a internet agora.",
    subtitle: "Assim que a conexão voltar, tudo continua de onde parou.",
    pageTitle: "Sem conexão",
    icon: WifiOff,
    primaryAction: { label: "Tentar de novo", href: "/painel" },
  },
  "sessao-expirada": {
    title: "Sua sessão expirou.",
    subtitle:
      "Por segurança, a gente encerrou o acesso. Entra de novo pra continuar de onde parou.",
    pageTitle: "Sessão expirada",
    icon: Clock,
    primaryAction: { label: "Entrar", href: "/auth/login" },
  },
  "link-expirado": {
    title: "Esse link expirou.",
    subtitle: "Pede um link novo que a gente manda na hora.",
    pageTitle: "Link expirado",
    icon: Link2Off,
    primaryAction: { label: "Enviar novo link", href: "/auth/esqueci-senha" },
  },
};
