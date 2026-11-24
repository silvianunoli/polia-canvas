import { createFileRoute, Link } from "@tanstack/react-router";
import { PaginaLogada } from "@/components/layout/PaginaLogada";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { CardMercadoLivre } from "@/components/configuracoes/CardMercadoLivre";
import { CardTiktokShop } from "@/components/configuracoes/CardTiktokShop";

// Marketplaces (ONE-255, 24/11/2026, pedido da Sil): era "Anúncios nos
// canais" (VND-39), que só aparecia com canal já conectado e mandava conectar
// em Configurações. Agora aparece pra todas e o canal se conecta aqui, com o
// aviso de que a conta de vendedora vem antes. Ligar os anúncios continua em
// /produtos/anuncios/mercado-livre e /produtos/anuncios/tiktok.

export const Route = createFileRoute("/_authenticated/produtos_/anuncios")({
  head: () => ({ meta: [{ title: "Marketplaces · Pólia One" }] }),
  component: Marketplaces,
});

function Marketplaces() {
  const { user } = useSupabaseSession();
  const userId = user?.id;

  return (
    <PaginaLogada
      titulo="Marketplaces"
      eyebrow="Cadastro de produtos"
      subtitulo="Conecte a loja da marca no Mercado Livre e no TikTok Shop e ligue cada anúncio a um produto da Pólia: a venda baixa o estoque certo e o lucro sai por produto."
    >
      <div className="mb-6 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
        <p className="font-sans text-[14px] font-medium text-[var(--ink)]">
          Antes de conectar, a conta de vendedora
        </p>
        <p className="mt-1 font-sans text-[13px] text-[var(--ink-soft)]">
          A marca já precisa ter conta de vendedora aprovada em cada canal. A Pólia não cria essa
          conta: ela lê os anúncios e os pedidos da loja que já existe lá.
        </p>
      </div>

      <div className="space-y-3">
        <CardMercadoLivre userId={userId} />
        <CardTiktokShop userId={userId} />
      </div>

      <p className="mt-6 font-sans text-[13px] text-[var(--ink-soft)]">
        Quer entender o passo a passo antes?{" "}
        <Link
          to="/como-usar/$slug"
          params={{ slug: "anuncios" }}
          className="font-medium text-[var(--secondary-text)] no-underline hover:underline"
        >
          Ver como funciona a conexão
        </Link>
      </p>
    </PaginaLogada>
  );
}
