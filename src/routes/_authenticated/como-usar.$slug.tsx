import { createFileRoute, Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";

import { PaginaLogada } from "@/components/layout/PaginaLogada";
import { ConteudoTutorial } from "@/components/tutorial/ConteudoTutorial";
import { useUserMeta } from "@/hooks/useUserMeta";
import { BTN_ACAO, BTN_ACAO_CONTORNO } from "@/lib/botoes";
import { recursoLiberado, temProjete } from "@/lib/planos";
import { planoDoTutorial, tutorialPorSlug } from "@/lib/tutoriais";

// Um tutorial por ferramenta, dentro do app (28/10/2026). O botão do topo abre
// a tela; se o plano não cobre, leva pro upgrade com o plano certo, igual ao
// cadeado do menu. A versão pública, sem login, é /tutorial/$slug.
export const Route = createFileRoute("/_authenticated/como-usar/$slug")({
  head: ({ params }) => ({
    meta: [{ title: `${tutorialPorSlug(params.slug)?.nome ?? "Tutorial"} · Tutorial · Pólia One` }],
  }),
  component: TutorialFerramentaPage,
});

function TutorialFerramentaPage() {
  const { slug } = Route.useParams();
  const t = tutorialPorSlug(slug);
  const meta = useUserMeta();

  if (!t) {
    return (
      <PaginaLogada
        eyebrow="Tutorial"
        titulo="Esse tutorial não existe."
        subtitulo="O link pode ter mudado. A lista tem um tutorial pra cada ferramenta."
        largura="larga"
      >
        <Link to="/como-usar" className={BTN_ACAO}>
          Ver todos os tutoriais
        </Link>
      </PaginaLogada>
    );
  }

  const plano = planoDoTutorial(t);
  // Enquanto o plano não chegou, mostra o botão de abrir: o guard da rota
  // continua barrando quem não tem acesso (mesma regra do menu lateral).
  const liberado =
    meta.carregando ||
    (recursoLiberado(t.rota, meta.plano) && (plano !== "Pro" || temProjete(meta.plano)));

  const acao = liberado ? (
    <Link
      to={t.rota}
      className={BTN_ACAO}
      data-track="tutorial_abrir_tela"
      data-track-props={JSON.stringify({ slug: t.slug })}
    >
      {t.abrir}
    </Link>
  ) : (
    <Link
      to="/upgrade"
      search={{ rota: t.rota, tier: plano === "Pro" ? "projete" : "controle" }}
      className={BTN_ACAO_CONTORNO}
    >
      <Lock size={16} aria-hidden="true" />
      Abre no {plano}
    </Link>
  );

  return (
    <PaginaLogada
      eyebrow={plano === "Grátis" ? "Tutorial" : `Tutorial · ${plano}`}
      titulo={t.nome}
      subtitulo={t.resumo}
      acao={acao}
      largura="larga"
    >
      <ConteudoTutorial tutorial={t} base="/como-usar" />
    </PaginaLogada>
  );
}
