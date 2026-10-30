import { createFileRoute, Outlet, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import vitrineCss from "@/components/loja/vitrine.css?url";
import { VitrineLoja, VitrineSimples } from "@/components/loja/VitrineLoja";
import { descricaoDaLoja, FONTES_VITRINE, metaDaLoja, type LeituraLoja } from "@/components/loja/leituraLoja";
import { lerLojaPublica } from "@/lib/loja.functions";
import { linkCanonico } from "@/lib/seo";

// Loja pública do catálogo (ONE-148): /loja/<endereço>. Este arquivo é o
// layout: carrega a loja uma vez, põe a casca (topo, carrinho, rodapé) e as
// filhas desenham a vitrine (loja.$slug.index.tsx) e a página de cada
// produto (loja.$slug.$produto.tsx), dividindo o mesmo carrinho. Sem login,
// fora do _authenticated. A marca é da cliente: sem .polia-v3.

const SLUG = /^[a-z0-9-]{3,40}$/i;

export const Route = createFileRoute("/loja/$slug")({
  loader: async ({ params }): Promise<LeituraLoja> => {
    if (!SLUG.test(params.slug)) return { ok: false, motivo: "nao_existe" };
    try {
      const r = await lerLojaPublica({ data: { slug: params.slug } });
      return r.ok ? r : { ok: false, motivo: "nao_existe" };
    } catch {
      return { ok: false, motivo: "rede" };
    }
  },
  head: ({ loaderData, params }) => {
    const loja = loaderData?.ok ? loaderData.loja : null;
    const imagem = loja ? (loja.produtos.find((p) => p.fotos.length)?.fotos[0] ?? loja.logoUrl) : null;
    return {
      meta: metaDaLoja({
        titulo: loja?.nome ?? "Loja",
        descricao: loja ? descricaoDaLoja(loja) : "Essa loja não está aberta agora.",
        imagem,
        caminho: `/loja/${params.slug}`,
        indexar: !!loja,
        marca: loja?.nome ?? "Loja",
      }),
      links: [
        { rel: "stylesheet", href: FONTES_VITRINE },
        { rel: "stylesheet", href: vitrineCss },
        ...(loja ? [linkCanonico(`/loja/${loja.slug}`)] : []),
      ],
    };
  },
  component: LojaLayout,
});

function LojaLayout() {
  const leitura = Route.useLoaderData();
  if (leitura.ok)
    return (
      <VitrineLoja key={leitura.loja.slug} loja={leitura.loja}>
        <Outlet />
      </VitrineLoja>
    );
  return <VitrineSimples>{leitura.motivo === "rede" ? <ErroDeRede /> : <LojaFechada />}</VitrineSimples>;
}

function LojaFechada() {
  return (
    <div className="estado" role="alert">
      <h1>Essa loja não está aberta agora.</h1>
      <p>
        O endereço pode ter vindo cortado, ou a loja fechou por enquanto. Fale com a marca pelo perfil onde você achou
        o link.
      </p>
    </div>
  );
}

function ErroDeRede() {
  const router = useRouter();
  const [tentando, setTentando] = useState(false);
  return (
    <div className="estado" role="alert">
      <h1>A loja não carregou</h1>
      <p>Pode ser a conexão. O endereço continua valendo.</p>
      <button
        type="button"
        className="btn sec"
        disabled={tentando}
        onClick={() => {
          setTentando(true);
          void router.invalidate().finally(() => setTentando(false));
        }}
      >
        {tentando ? "Tentando…" : "Tentar de novo"}
      </button>
    </div>
  );
}
