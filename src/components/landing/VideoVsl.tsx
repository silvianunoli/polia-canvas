import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { Play, VolumeX } from "lucide-react";
import { track } from "@/lib/analytics";
import {
  BotaoCadastro,
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

/**
 * Só o player. Desde 16/10/2026 (pedido da Sil) o vídeo começa sozinho e MUDO, em
 * loop: navegador nenhum deixa vídeo com som começar sem um toque. A legenda está
 * gravada no vídeo, então dá pra acompanhar sem som. Por cima fica o aviso
 * "Toque pra ouvir": o toque volta o vídeo pro começo e toca com som e controles.
 * Com "reduzir movimento" ligado (ou autoplay bloqueado, como no modo economia do
 * iPhone) o vídeo fica parado na capa e o aviso vira "Toque pra assistir".
 *
 * Eventos "vsl": autoplay (começou mudo), som (a pessoa tocou pra ouvir), metade e
 * fim (só contam assistindo com som, pra o loop mudo não inflar o número).
 */
export function PlayerVsl({
  busca,
  versao = "gratis",
  className = "",
}: {
  busca: BuscaCadastro;
  versao?: keyof typeof ARQUIVOS;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [rodandoMudo, setRodandoMudo] = useState(false);
  const [comSom, setComSom] = useState(false);
  // Cada marco do vídeo vira um evento só uma vez por carregamento da página.
  const marcados = useRef(new Set<string>());
  const marcar = (marco: string) => {
    if (marcados.current.has(marco)) return;
    marcados.current.add(marco);
    track("vsl", { marco, versao, landing: busca.origem ?? null });
  };
  const { video, capa } = ARQUIVOS[versao];

  useEffect(() => {
    const v = ref.current;
    if (!v || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // muted pela propriedade antes do play: o atributo do React não chega no HTML
    // do servidor, e sem ele o iPhone recusa o autoplay.
    v.muted = true;
    v.play()
      .then(() => {
        setRodandoMudo(true);
        marcar("autoplay");
      })
      .catch(() => {
        // Autoplay bloqueado: fica a capa com "Toque pra assistir".
      });
    // marcar só lê refs; rodar uma vez na montagem basta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ouvir = () => {
    const v = ref.current;
    if (!v) return;
    v.currentTime = 0;
    v.muted = false;
    v.loop = false;
    setComSom(true);
    marcar("som");
    void v.play().catch(() => {});
  };

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--ink)] ${className}`}
    >
      <video
        ref={ref}
        className="block aspect-video w-full"
        src={video}
        poster={capa}
        controls={comSom}
        loop={!comSom}
        playsInline
        preload="metadata"
        aria-label="Vídeo da Pólia One, 1 minuto e meio, com narração e legenda"
        onTimeUpdate={(e) => {
          const v = e.currentTarget;
          if (!v.muted && v.duration && v.currentTime / v.duration >= 0.5) marcar("metade");
        }}
        onEnded={() => {
          if (comSom) marcar("fim");
        }}
      />
      {!comSom && (
        <button
          type="button"
          onClick={ouvir}
          className="absolute inset-0 flex items-center justify-center rounded-2xl focus-visible:outline focus-visible:outline-[3px] focus-visible:-outline-offset-[6px] focus-visible:outline-[var(--secondary)]"
          aria-label={
            rodandoMudo
              ? "O vídeo está sem som. Toque pra ouvir desde o começo"
              : "Toque pra assistir o vídeo com som"
          }
        >
          <span className="inline-flex items-center gap-3 rounded-full border-2 border-[var(--ink)] bg-[var(--secondary)] px-6 py-3 text-[17px] font-semibold text-[var(--secondary-ink)] transition-transform duration-150 hover:scale-[1.03] max-sm:px-4 max-sm:py-2 max-sm:text-[15px]">
            {rodandoMudo ? (
              <VolumeX aria-hidden="true" className="h-5 w-5" strokeWidth={2} />
            ) : (
              <Play aria-hidden="true" className="h-5 w-5" strokeWidth={2} />
            )}
            {rodandoMudo ? "Toque pra ouvir" : "Toque pra assistir"}
          </span>
        </button>
      )}
    </div>
  );
}

/**
 * Topo das landings de cadastro com o VSL (15/10/2026, pedidos da Sil): centralizado,
 * só o título e, logo embaixo, o vídeo grande; sem texto de apoio. O botão vem colado
 * no vídeo porque a narração termina com "toca no botão aqui embaixo". Título e botão
 * chegam no HTML do servidor.
 */
export function HeroComVideo({
  busca,
  rotulo,
  titulo,
  micro = "Sem cartão no Grátis.",
  botaoRef,
}: {
  busca: BuscaCadastro;
  rotulo: string;
  titulo: ReactNode;
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
      <PlayerVsl busca={busca} className="mx-auto mt-10 max-w-[1040px]" />
      <div className="mt-8 flex flex-col items-center text-center">
        <BotaoCadastro busca={busca} contexto="hero" botaoRef={botaoRef} />
        <p className="mt-3 text-[13px] text-[var(--muted)]">{micro}</p>
      </div>
    </Secao>
  );
}
