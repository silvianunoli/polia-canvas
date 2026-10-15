import { useRef, type ReactNode, type RefObject } from "react";
import { track } from "@/lib/analytics";
import {
  BotaoCadastro,
  CORPO,
  Rotulo,
  Secao,
  type BuscaCadastro,
} from "@/components/landing/BlocosLanding";

/**
 * VSL em motion da Pólia One (15/10/2026), só nas landings de campanha.
 * O MP4 mora no Storage público do Supabase (bucket blog-media, pasta vsl/), que
 * responde com Range: o Worker do app não responde, e sem Range o iPhone não toca.
 * Fonte, roteiro e render: polia-one-vsl/ na raiz do workspace. Trocar o vídeo =
 * subir com o mesmo nome, a URL não muda.
 *
 * Duas versões: "gratis" termina pedindo "Quero começar grátis" (landing-a/b) e
 * "premium" termina pedindo "Quero o Premium" (premium-a/b). A narração acaba com
 * "toca no botão aqui embaixo", então o botão certo fica sempre colado no vídeo.
 */
const BASE = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/blog-media/vsl`;
const ARQUIVOS = {
  gratis: { video: `${BASE}/polia-one-vsl.mp4`, capa: `${BASE}/polia-one-vsl-capa.jpg` },
  premium: {
    video: `${BASE}/polia-one-vsl-premium.mp4`,
    capa: `${BASE}/polia-one-vsl-premium-capa.jpg`,
  },
} as const;

/** Só o player, com os eventos "vsl" (play, metade, fim). */
export function PlayerVsl({
  busca,
  versao = "gratis",
  className = "",
}: {
  busca: BuscaCadastro;
  versao?: keyof typeof ARQUIVOS;
  className?: string;
}) {
  // Cada marco do vídeo vira um evento só uma vez por carregamento da página.
  const marcados = useRef(new Set<string>());
  const marcar = (marco: string) => {
    if (marcados.current.has(marco)) return;
    marcados.current.add(marco);
    track("vsl", { marco, versao, landing: busca.origem ?? null });
  };
  const { video, capa } = ARQUIVOS[versao];

  return (
    <div
      className={`overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--ink)] ${className}`}
    >
      <video
        className="block aspect-video w-full"
        src={video}
        poster={capa}
        controls
        playsInline
        preload="metadata"
        aria-label="Vídeo da Pólia One, 1 minuto e meio, com narração e legenda"
        onPlay={() => marcar("play")}
        onTimeUpdate={(e) => {
          const v = e.currentTarget;
          if (v.duration && v.currentTime / v.duration >= 0.5) marcar("metade");
        }}
        onEnded={() => marcar("fim")}
      />
    </div>
  );
}

/**
 * Topo das landings de cadastro com o VSL (15/10/2026, pedido da Sil): textos
 * centralizados, título em cima, vídeo grande embaixo e o botão logo depois, porque a narração termina com
 * "toca no botão aqui embaixo". Título, subtítulo e botão chegam no HTML do servidor.
 */
export function HeroComVideo({
  busca,
  rotulo,
  titulo,
  subtitulo,
  micro = "Sem cartão no Grátis.",
  botaoRef,
}: {
  busca: BuscaCadastro;
  rotulo: string;
  titulo: ReactNode;
  subtitulo: ReactNode;
  micro?: string;
  botaoRef?: RefObject<HTMLAnchorElement | null>;
}) {
  return (
    <Secao className="!pb-[clamp(64px,8vw,96px)] !pt-[clamp(40px,5vw,64px)]">
      {/* Topo centralizado a pedido da Sil (15/10/2026): exceção à regra de alinhar à esquerda. */}
      <div className="flex justify-center text-center">
        <Rotulo>{rotulo}</Rotulo>
      </div>
      <h1 className="mx-auto mt-4 max-w-[24ch] text-center text-[clamp(28px,3.2vw,48px)] font-bold leading-[1.08] tracking-[-0.02em] text-balance">
        {titulo}
      </h1>
      <div className={`mx-auto mt-6 text-center ${CORPO}`}>{subtitulo}</div>
      <PlayerVsl busca={busca} className="mx-auto mt-10 max-w-[1040px]" />
      <div className="mt-8 flex flex-col items-center text-center">
        <BotaoCadastro busca={busca} contexto="hero" botaoRef={botaoRef} />
        <p className="mt-3 text-[13px] text-[var(--muted)]">{micro}</p>
      </div>
    </Secao>
  );
}
