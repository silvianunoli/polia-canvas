import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, ExternalLink, Film } from "lucide-react";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { useUserMeta } from "@/hooks/useUserMeta";
import { PaginaLogada } from "@/components/layout/PaginaLogada";
import { UpgradeGate } from "@/components/layout/UpgradeGate";
import { Vazio } from "@/components/layout/Vazio";
import { BlockError } from "@/components/ui/BlockError";
import { ConfirmarAcao } from "@/components/ui/ConfirmarAcao";
import { LinkInterno } from "@/components/ui/LinkInterno";
import { BTN_ACAO, BTN_MIUDO } from "@/lib/botoes";
import { temProjete } from "@/lib/planos";
import { toastErro, toastSucesso } from "@/lib/toast";
import { cancelarPostRedes, listarPostsRedes, type PostNaLista } from "@/lib/redesPosts.functions";
import { NOME_REDE } from "../../../supabase/functions/_shared/redesSociais.ts";
import { ROTULO_STATUS_DESTINO } from "../../../supabase/functions/_shared/redesPosts.ts";
import {
  CAIXA,
  CHAVE_POSTS_REDES,
  dataDoPost,
  useStatusRedes,
} from "@/components/agenda-redes/comum";

// Agenda das redes (ONE-155): a lista dos posts agendados, com o status de cada
// rede. Só Pro; até as revisões do TikTok e da Meta, só admin vê (o servidor decide).

export const Route = createFileRoute("/_authenticated/agenda-redes/")({
  head: () => ({ meta: [{ title: "Agenda das redes · Pólia One" }] }),
  component: AgendaRedes,
});

const EYEBROW = "Agenda das redes";
const TITULO = "Os posts da marca, no horário marcado.";

function AgendaRedes() {
  const { user } = useSupabaseSession();
  const userId = user?.id;
  const meta = useUserMeta();
  const status = useStatusRedes(userId);
  const ehPro = temProjete(meta.plano);
  const visivel = status.data?.visivel === true;

  const posts = useQuery({
    queryKey: [CHAVE_POSTS_REDES, userId],
    enabled: !!userId && ehPro && visivel,
    queryFn: () => listarPostsRedes(),
  });

  if (meta.carregando || status.isLoading) {
    return (
      <PaginaLogada eyebrow={EYEBROW} titulo={TITULO}>
        <div className="h-40 animate-pulse rounded-xl bg-[var(--surface)] motion-reduce:animate-none" />
      </PaginaLogada>
    );
  }
  if (!ehPro) {
    return (
      <UpgradeGate
        eyebrow={EYEBROW}
        titulo="A Agenda das redes é do Pro"
        feature="Prepara o post uma vez, escolhe o horário, e a Pólia publica no Instagram e no TikTok da marca."
        rota="/agenda-redes"
      />
    );
  }
  if (!visivel) {
    return (
      <PaginaLogada eyebrow={EYEBROW} titulo={TITULO}>
        <Vazio
          icone={CalendarClock}
          titulo="A Agenda das redes ainda não abriu"
          texto="Ela abre quando o TikTok e o Instagram aprovarem a Pólia. A novidade aparece no sino."
        />
      </PaginaLogada>
    );
  }

  const conectadas = (status.data?.redes ?? []).filter((r) => r.conectada);
  const lista = posts.data?.posts ?? [];

  return (
    <PaginaLogada
      eyebrow={EYEBROW}
      titulo={TITULO}
      subtitulo="Cada post mostra como ficou em cada rede."
      acao={
        conectadas.length > 0 ? (
          <Link to="/agenda-redes/novo" className={BTN_ACAO}>
            Novo post
          </Link>
        ) : undefined
      }
    >
      {conectadas.length === 0 ? (
        <Vazio
          icone={CalendarClock}
          titulo="Conecta uma rede pra começar"
          texto="O Instagram e o TikTok da marca se conectam em Configurações, na parte de Integrações."
          acao={
            <LinkInterno href="/configuracoes" className={BTN_MIUDO}>
              Ir pra Configurações
            </LinkInterno>
          }
        />
      ) : posts.isLoading ? (
        <div className="h-40 animate-pulse rounded-xl bg-[var(--surface)] motion-reduce:animate-none" />
      ) : posts.isError || posts.data?.error ? (
        <BlockError message={posts.data?.error ?? undefined} onRetry={() => posts.refetch()} />
      ) : lista.length === 0 ? (
        <Vazio
          icone={CalendarClock}
          titulo="Nenhum post agendado"
          texto="O primeiro post sai daqui: arquivos, legenda, onde sai e o horário."
          acao={
            <Link to="/agenda-redes/novo" className={BTN_MIUDO}>
              Novo post
            </Link>
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {lista.map((p) => (
            <LinhaPost key={p.id} post={p} userId={userId} />
          ))}
        </ul>
      )}
    </PaginaLogada>
  );
}

function LinhaPost({ post, userId }: { post: PostNaLista; userId: string | undefined }) {
  const qc = useQueryClient();
  const [confirmando, setConfirmando] = useState(false);
  const cancelar = useMutation({
    mutationFn: () => cancelarPostRedes({ data: { postId: post.id } }),
    onSuccess: (r) => {
      if (!r.ok) return toastErro(r.error ?? "A Pólia One não conseguiu cancelar agora.");
      setConfirmando(false);
      qc.invalidateQueries({ queryKey: [CHAVE_POSTS_REDES, userId] });
      toastSucesso("Post cancelado.");
    },
    onError: () => toastErro("A Pólia One não conseguiu cancelar agora."),
  });

  const primeiraLinha = post.legenda.split("\n")[0]?.trim() || "Sem legenda";
  return (
    <li className={`${CAIXA} flex gap-4`}>
      <div className="flex h-20 w-16 flex-none items-center justify-center overflow-hidden rounded-lg bg-[var(--surface)]">
        {post.capaUrl ? (
          <img src={post.capaUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <Film size={20} className="text-[var(--ink-soft)]" aria-hidden="true" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-sans text-[14px] font-medium text-[var(--ink)]">
          {dataDoPost(post.agendadoPara)}
          <span className="font-normal text-[var(--muted)]">
            {" "}
            ·{" "}
            {post.tipo === "video"
              ? "vídeo"
              : post.quantidade > 1
                ? `${post.quantidade} fotos`
                : "foto"}
          </span>
        </p>
        <p className="mt-0.5 truncate font-sans text-[13px] text-[var(--ink-soft)]">
          {primeiraLinha}
        </p>
        <ul className="mt-2 flex flex-wrap gap-2">
          {post.destinos.map((d) => (
            <li
              key={d.rede}
              className="inline-flex items-center gap-1 rounded-full border border-[var(--line)] px-2.5 py-0.5 font-sans text-[12px] text-[var(--ink-soft)]"
            >
              {NOME_REDE[d.rede]}: {ROTULO_STATUS_DESTINO[d.status]}
              {d.status === "publicado" && d.url && (
                <a
                  href={d.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-0.5 text-[var(--secondary-text)] hover:underline"
                >
                  ver post <ExternalLink size={12} aria-hidden="true" />
                </a>
              )}
            </li>
          ))}
        </ul>
        {post.destinos
          .filter((d) => d.status === "erro" && d.erro)
          .map((d) => (
            <p key={d.rede} className="mt-2 font-sans text-[12px] text-[var(--danger)]">
              {NOME_REDE[d.rede]}: {d.erro}
            </p>
          ))}
      </div>
      {post.podeCancelar && (
        <div className="flex-none">
          <button type="button" onClick={() => setConfirmando(true)} className={BTN_MIUDO}>
            Cancelar
          </button>
        </div>
      )}
      <ConfirmarAcao
        open={confirmando}
        onOpenChange={setConfirmando}
        titulo="Cancelar este post?"
        descricao="Ele não sai em nenhuma rede, e os arquivos dele saem da Pólia One."
        textoConfirmar="Cancelar o post"
        textoCarregando="Cancelando..."
        textoCancelar="Manter"
        destrutivo
        carregando={cancelar.isPending}
        onConfirmar={() => cancelar.mutate()}
      />
    </li>
  );
}
