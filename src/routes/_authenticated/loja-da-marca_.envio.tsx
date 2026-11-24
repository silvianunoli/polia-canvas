import { createFileRoute } from "@tanstack/react-router";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { PaginaLogada } from "@/components/layout/PaginaLogada";
import { Vazio } from "@/components/layout/Vazio";
import { BlockError } from "@/components/ui/BlockError";
import { LinkInterno } from "@/components/ui/LinkInterno";
import { BTN_ACAO } from "@/lib/botoes";
import { CardEnvioLoja } from "@/components/configuracoes/CardEnvioLoja";
import { useTemLojaDaMarca } from "@/components/lojaDaMarca/dados";

// Envio da loja (Melhor Envio, ONE-189). Saiu de Configurações > Integrações e
// virou subnível da Loja da marca no menu lateral (24/11/2026, pedido da Sil):
// o frete e a etiqueta só existem pra loja da marca. O "_" no nome do arquivo
// tira a tela de dentro do layout de /loja-da-marca.

export const Route = createFileRoute("/_authenticated/loja-da-marca_/envio")({
  head: () => ({
    meta: [
      { title: "Envio da loja · Pólia One" },
      {
        name: "description",
        content: "Melhor Envio, CEP de origem, caixa padrão e retirada da loja da marca.",
      },
    ],
  }),
  component: EnvioDaLojaPage,
});

const CABECALHO = {
  eyebrow: "Loja da marca",
  titulo: "Envio da loja.",
  subtitulo:
    "O Melhor Envio cota o frete pelo CEP da compradora e a etiqueta sai pela Pólia One, com o saldo da conta do Melhor Envio.",
} as const;

function EnvioDaLojaPage() {
  const { user } = useSupabaseSession();
  const userId = user?.id;
  const temLoja = useTemLojaDaMarca(userId);

  if (temLoja.isError)
    return (
      <PaginaLogada {...CABECALHO}>
        <BlockError
          message="A Pólia One não conseguiu abrir o envio da loja agora."
          onRetry={() => void temLoja.refetch()}
        />
      </PaginaLogada>
    );
  if (!userId || temLoja.isLoading)
    return (
      <PaginaLogada {...CABECALHO}>
        <div className="h-40 animate-pulse rounded-xl bg-[var(--surface)] motion-reduce:animate-none" />
      </PaginaLogada>
    );
  if (temLoja.data !== true)
    return (
      <PaginaLogada {...CABECALHO}>
        <Vazio
          titulo="Esta conta não tem loja da marca."
          texto="O envio pelo Melhor Envio é da loja da marca, que o Pólia Lab monta. A entrega da Vitrine online se ajusta na página dela."
          acao={
            <LinkInterno href="/catalogo" className={BTN_ACAO}>
              Abrir a Vitrine online
            </LinkInterno>
          }
        />
      </PaginaLogada>
    );

  return (
    <PaginaLogada {...CABECALHO}>
      <CardEnvioLoja userId={userId} />
    </PaginaLogada>
  );
}
