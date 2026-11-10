import { createFileRoute } from "@tanstack/react-router";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { useUserMeta } from "@/hooks/useUserMeta";
import { PaginaLogada } from "@/components/layout/PaginaLogada";
import { UpgradeGate } from "@/components/layout/UpgradeGate";
import { Vazio } from "@/components/layout/Vazio";
import { LinkInterno } from "@/components/ui/LinkInterno";
import { BTN_MIUDO } from "@/lib/botoes";
import { temProjete } from "@/lib/planos";
import { useStatusRedes } from "@/components/agenda-redes/comum";
import { FormNovoPost } from "@/components/agenda-redes/FormNovoPost";

// Novo post da Agenda das redes (ONE-155). Mesmas travas da lista: Pro, e só
// quem o servidor deixa ver; sem rede conectada, manda pra Configurações.

export const Route = createFileRoute("/_authenticated/agenda-redes/novo")({
  head: () => ({ meta: [{ title: "Novo post · Agenda das redes · Pólia One" }] }),
  component: NovoPost,
});

const EYEBROW = "Agenda das redes";

function NovoPost() {
  const { user } = useSupabaseSession();
  const userId = user?.id;
  const meta = useUserMeta();
  const status = useStatusRedes(userId);

  if (meta.carregando || status.isLoading || !userId) {
    return (
      <PaginaLogada eyebrow={EYEBROW} titulo="Novo post">
        <div className="h-40 animate-pulse rounded-xl bg-[var(--surface)] motion-reduce:animate-none" />
      </PaginaLogada>
    );
  }
  if (!temProjete(meta.plano)) {
    return (
      <UpgradeGate
        eyebrow={EYEBROW}
        titulo="A Agenda das redes é do Pro"
        feature="Prepara o post uma vez, escolhe o horário, e a Pólia publica no Instagram e no TikTok da marca."
        rota="/agenda-redes"
      />
    );
  }
  const redes = status.data?.visivel ? status.data.redes : [];
  if (!status.data?.visivel || !redes.some((r) => r.conectada)) {
    return (
      <PaginaLogada eyebrow={EYEBROW} titulo="Novo post">
        <Vazio
          titulo={
            status.data?.visivel
              ? "Conecta uma rede pra começar"
              : "A Agenda das redes ainda não abriu"
          }
          texto={
            status.data?.visivel
              ? "O Instagram e o TikTok da marca se conectam em Configurações, na parte de Integrações."
              : "Ela abre quando o TikTok e o Instagram aprovarem a Pólia."
          }
          acao={
            status.data?.visivel ? (
              <LinkInterno href="/configuracoes" className={BTN_MIUDO}>
                Ir pra Configurações
              </LinkInterno>
            ) : undefined
          }
        />
      </PaginaLogada>
    );
  }

  return (
    <PaginaLogada
      eyebrow={EYEBROW}
      titulo="Novo post"
      subtitulo="Um post, uma ou duas redes, um horário."
    >
      <FormNovoPost userId={userId} redes={redes} />
    </PaginaLogada>
  );
}
