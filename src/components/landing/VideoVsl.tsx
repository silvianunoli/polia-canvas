import { useRef } from "react";
import { track } from "@/lib/analytics";
import {
  BotaoCadastro,
  H2,
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

/** Seção do VSL nas landings de cadastro (landing-a e landing-b). */
export function VideoVsl({ busca }: { busca: BuscaCadastro }) {
  return (
    <Secao fundo="surface-pink">
      <Rotulo>Em um minuto e meio</Rotulo>
      <h2 className={`mt-4 max-w-[26ch] ${H2}`}>
        Por que mais um app de tarefas não mostra seu lucro.
      </h2>
      <PlayerVsl busca={busca} className="mt-8 max-w-[960px]" />
      <div className="mt-8">
        <BotaoCadastro busca={busca} contexto="vsl" />
        <p className="mt-3 text-[13px] text-[var(--muted)]">Sem cartão no Grátis.</p>
      </div>
    </Secao>
  );
}
